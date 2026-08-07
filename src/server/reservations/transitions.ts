import "server-only";

import { and, eq, sql } from "drizzle-orm";

import {
  evaluerTransition,
  type Acteur,
  type Evenement,
  type StatutReservation,
} from "@/domain/reservation/machine";
import { db } from "@/server/db";
import { caution, reservation, reservationTransition, reversement } from "@/server/db/schema";

/**
 * Le seul chemin par lequel une réservation change d'état — règle 4.
 *
 * « Toute transition passe par `src/domain/reservation/machine.ts`, est tracée
 * dans `reservation_transition` et déclenche ses notifications. Aucun `UPDATE`
 * direct sur `reservation.statut`. »
 *
 * Cette fonction est la mise en œuvre de cette phrase. Le domaine décide seul
 * si la transition est permise ; ce module se charge de ce que le domaine ne
 * peut pas savoir — lire l'état courant, vérifier le gel des fonds en base,
 * écrire la trace — puis d'appliquer le tout en une transaction.
 *
 * **Rien n'est écrit hors transaction.** Un statut modifié sans sa trace
 * rendrait le journal menteur ; une trace sans changement de statut ferait
 * croire à une action qui n'a pas eu lieu. Les deux tombent ensemble ou pas du
 * tout.
 */

export type ResultatChangement =
  | { ok: true; statut: StatutReservation }
  | { ok: false; motif: string };

/**
 * Un dossier ouvert gèle-t-il cette réservation ?
 *
 * Lu en base et non passé en paramètre : l'appelant pourrait l'oublier, et
 * l'oubli signifierait clôturer une location dont le litige est en cours.
 */
async function fondsGeles(reservationId: string): Promise<boolean> {
  const [ligne] = await db
    .select({ gele: sql<boolean>`
      exists (
        select 1 from litige l
        where l.reservation_id = ${reservationId}
          and l.statut not in ('resolu', 'clos_sans_suite')
      ) or exists (
        select 1 from sinistre s
        where s.reservation_id = ${reservationId}
          and s.statut in ('declare', 'transmis', 'en_cours')
      )
    ` })
    .from(reservation)
    .where(eq(reservation.id, reservationId))
    .limit(1);

  return ligne?.gele ?? false;
}

/**
 * Horodatage à renseigner selon l'état atteint.
 *
 * La table porte une colonne par étape franchie — `acceptee_le`, `payee_le`,
 * `cloturee_le`… Les renseigner ici plutôt qu'au cas par cas chez l'appelant
 * garantit qu'une transition ne peut pas laisser sa date vide.
 */
const HORODATAGE: Partial<Record<StatutReservation, string>> = {
  acceptee: "acceptee_le",
  payee: "payee_le",
  confirmee: "confirmee_le",
  en_cours: "retrait_le",
  restituee: "restituee_le",
  cloturee: "cloturee_le",
  annulee: "annulee_le",
};

export async function changerStatut(entree: {
  reservationId: string;
  evenement: Evenement;
  acteur: Acteur;
  acteurId?: string;
  motif?: string;
}): Promise<ResultatChangement> {
  const [courante] = await db
    .select({
      statut: reservation.statut,
      locataireId: reservation.locataireId,
      proprietaireId: reservation.proprietaireId,
    })
    .from(reservation)
    .where(eq(reservation.id, entree.reservationId))
    .limit(1);

  if (!courante) return { ok: false, motif: "Réservation introuvable." };

  const statut = courante.statut as StatutReservation;

  // Vérification d'habilitation *sur cette réservation précise*. Le domaine
  // sait qu'un « propriétaire » peut accepter ; il ne sait pas si celui qui
  // demande est le propriétaire de celle-ci.
  if (entree.acteurId && entree.acteur !== "administrateur") {
    const attendu =
      entree.acteur === "locataire" ? courante.locataireId : courante.proprietaireId;
    if (attendu !== entree.acteurId) {
      return { ok: false, motif: "Vous n'êtes pas partie à cette réservation." };
    }
  }

  const verdict = evaluerTransition(entree.evenement, {
    statut,
    acteur: entree.acteur,
    fondsGeles: await fondsGeles(entree.reservationId),
  });

  if (!verdict.autorise) return { ok: false, motif: verdict.motif };

  const suivant = verdict.statutSuivant;
  const colonne = HORODATAGE[suivant];

  await db.transaction(async (tx) => {
    await tx.execute(sql`
      update reservation
      set statut = ${suivant}::statut_reservation,
          modifie_le = now()
          ${colonne ? sql`, ${sql.raw(colonne)} = now()` : sql``}
      where id = ${entree.reservationId}
    `);

    await tx.insert(reservationTransition).values({
      reservationId: entree.reservationId,
      statutPrecedent: statut,
      statutSuivant: suivant,
      acteur: entree.acteur,
      acteurId: entree.acteurId,
      motif: entree.motif,
    });

    // Les mouvements d'argent suivent l'état, dans la même transaction : une
    // location annulée dont la caution resterait immobilisée est un appel au
    // support garanti.
    // L'empreinte est prise au paiement, jamais avant : c'est le moment où la
    // carte du locataire est réellement engagée.
    if (suivant === "payee") {
      const [existante] = await tx
        .select({ id: caution.id })
        .from(caution)
        .where(eq(caution.reservationId, entree.reservationId))
        .limit(1);

      if (!existante) {
        const [montants] = await tx
          .select({ caution: reservation.caution, devise: reservation.devise, fin: reservation.fin })
          .from(reservation)
          .where(eq(reservation.id, entree.reservationId))
          .limit(1);

        await tx.insert(caution).values({
          reservationId: entree.reservationId,
          statut: "constituee",
          devise: montants.devise,
          montant: montants.caution,
          liberationPrevueLe: montants.fin,
        });
      }
    }

    if (suivant === "annulee" || suivant === "refusee") {
      await tx
        .update(caution)
        .set({ statut: "liberee", libereeLe: new Date() })
        .where(
          and(
            eq(caution.reservationId, entree.reservationId),
            eq(caution.statut, "constituee"),
          ),
        );
    }

    if (suivant === "cloturee") {
      // Le gel a déjà été vérifié par le domaine : arriver ici signifie
      // qu'aucun dossier n'est ouvert.
      await tx
        .update(reversement)
        .set({ statut: "paye", envoyeLe: new Date() })
        .where(
          and(
            eq(reversement.reservationId, entree.reservationId),
            eq(reversement.statut, "planifie"),
          ),
        );
    }
  });

  return { ok: true, statut: suivant };
}

/**
 * Historique des transitions d'une réservation.
 *
 * C'est ce qui permet de répondre à « pourquoi ma réservation est-elle dans cet
 * état ? » — la question que reçoit le support, et à laquelle un statut seul ne
 * répond jamais.
 */
export async function historique(reservationId: string) {
  return db
    .select({
      id: reservationTransition.id,
      statutPrecedent: reservationTransition.statutPrecedent,
      statutSuivant: reservationTransition.statutSuivant,
      acteur: reservationTransition.acteur,
      motif: reservationTransition.motif,
      date: reservationTransition.creeLe,
    })
    .from(reservationTransition)
    .where(eq(reservationTransition.reservationId, reservationId))
    .orderBy(reservationTransition.creeLe);
}
