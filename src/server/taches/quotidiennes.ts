import "server-only";

import { and, eq, inArray, isNull, lt, sql } from "drizzle-orm";

import { db } from "@/server/db";
import { caution, reservation } from "@/server/db/schema";
import { poserRappels, type BilanRappels } from "@/server/notifications/rappels";
import { changerStatut } from "@/server/reservations/transitions";

/**
 * Tâches quotidiennes — ce que l'horloge décide à la place des gens.
 *
 * Deux promesses de l'interface n'étaient tenues par personne :
 *
 *  - « La demande expire si le propriétaire ne répond pas. » L'échéance était
 *    écrite (`expire_le`), le courriel d'expiration rédigé, la transition
 *    prévue par la machine avec l'acteur `systeme`... et rien ne l'émettait.
 *    Une demande sans réponse restait « demandée » pour toujours, bloquant le
 *    calendrier de l'annonce au passage.
 *
 *  - « Libération sous soixante-douze heures après la restitution. » La date
 *    était calculée (`liberation_prevue_le`), affichée au locataire — et
 *    jamais honorée.
 *
 * Chaque expiration passe par `changerStatut`, une par une : c'est plus lent
 * qu'un UPDATE de masse, et c'est le prix de la règle 4 — chaque transition
 * tracée, chaque notification enfilée. Un lot qui contournerait la machine
 * pour aller vite expirerait sans prévenir personne.
 */

export type BilanQuotidien = {
  demandesExpirees: number;
  expirationsRefusees: number;
  cautionsLiberees: number;
  rappels: BilanRappels;
};

/** Demandes dont l'échéance de réponse est passée. */
async function expirerLesDemandes(): Promise<{ faites: number; refusees: number }> {
  const echues = await db
    .select({ id: reservation.id })
    .from(reservation)
    .where(
      and(
        eq(reservation.statut, "demandee"),
        lt(reservation.expireLe, new Date()),
      ),
    );

  let faites = 0;
  let refusees = 0;

  for (const demande of echues) {
    const resultat = await changerStatut({
      reservationId: demande.id,
      evenement: "expirer",
      acteur: "systeme",
      motif: "Délai de réponse écoulé sans décision du propriétaire",
    });

    // Un refus de la machine n'arrête pas la tournée : les autres demandes
    // n'ont pas à attendre qu'un cas litigieux soit compris.
    if (resultat.ok) faites += 1;
    else refusees += 1;
  }

  return { faites, refusees };
}

/**
 * Cautions arrivées à échéance de libération.
 *
 * Trois conditions, aucune n'est de trop : l'échéance passée, la location
 * réellement close, et aucun dossier ouvert — le gel prime, règle 6, et il
 * est vérifié en base au moment d'agir, pas au moment où la date fut posée.
 */
async function libererLesCautions(): Promise<number> {
  const lignes = await db
    .update(caution)
    .set({ statut: "liberee", libereeLe: new Date() })
    .where(
      and(
        // La caution partiellement débitée est du lot : la retenue a pris ce
        // que la décision accordait, le **solde** appartient au locataire et
        // se libère à l'échéance comme n'importe quelle caution. L'exclure
        // la ferait sortir du circuit pour toujours — « retenue » (tout est
        // pris) reste dehors : il n'y a plus rien à rendre.
        inArray(caution.statut, ["constituee", "debitee_partiellement"]),
        isNull(caution.libereeLe),
        lt(caution.liberationPrevueLe, new Date()),
        sql`exists (
          select 1 from reservation r
          where r.id = ${caution.reservationId}
            and r.statut = 'cloturee'
            and r.fonds_geles = false
        )`,
        sql`not exists (
          select 1 from litige l
          where l.reservation_id = ${caution.reservationId}
            and l.statut not in ('resolu', 'clos_sans_suite')
        )`,
        sql`not exists (
          select 1 from sinistre s
          where s.reservation_id = ${caution.reservationId}
            and s.statut in ('declare', 'transmis', 'en_cours')
        )`,
      ),
    )
    .returning({ id: caution.id });

  return lignes.length;
}

export async function executerTachesQuotidiennes(): Promise<BilanQuotidien> {
  const expirations = await expirerLesDemandes();
  const cautionsLiberees = await libererLesCautions();
  const rappels = await poserRappels();

  return {
    demandesExpirees: expirations.faites,
    expirationsRefusees: expirations.refusees,
    cautionsLiberees,
    rappels,
  };
}
