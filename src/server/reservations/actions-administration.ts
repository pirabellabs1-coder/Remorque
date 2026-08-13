"use server";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import type { Evenement } from "@/domain/reservation/machine";
import { evenementsAdministrateur } from "@/domain/reservation/transitions-administrateur";
import { compteConnecte } from "@/server/authentification/session";
import { db } from "@/server/db";
import { journalAudit, reservation } from "@/server/db/schema";

import { confirmerReservation } from "./confirmation";
import { changerStatut } from "./transitions";

/**
 * Transitions forcées depuis l'administration.
 *
 * Séparée de `franchir`, qui sert le locataire et le propriétaire. Ce n'est pas
 * un doublon : `franchir` déduit l'acteur de la session et refuse quiconque
 * n'est pas partie à la réservation — c'est ce qui empêche un locataire
 * d'accepter sa propre demande, et il ne faut surtout pas l'assouplir. Le
 * chemin administrateur est un autre chemin, avec ses propres conditions.
 *
 * **Trois conditions, et elles tiennent ensemble.** Un rôle interne habilité ;
 * une transition que la machine ouvre réellement à l'administrateur depuis
 * l'état courant ; un motif écrit. Le motif n'est pas une formalité : une
 * transition forcée sort du cours normal, et « pourquoi cette réservation
 * est-elle passée en payée sans paiement » est exactement la question qu'on
 * posera six mois plus tard, devant un litige ou un contrôle.
 *
 * L'écriture au journal d'audit est faite ici plutôt que dans `changerStatut` :
 * une transition ordinaire laisse déjà sa trace dans `reservation_transition`,
 * et n'a rien à faire dans le journal des actes administratifs. Ce qui mérite
 * d'y figurer, c'est l'intervention — pas le mouvement.
 */

export type Reponse = { ok: true } | { ok: false; cle: string };

const ROLES_HABILITES = ["gestionnaire_financier", "super_administrateur"];

export async function forcerTransition(donnees: FormData): Promise<Reponse> {
  const moi = await compteConnecte();
  // Volontairement plus étroit que l'accès à l'administration : un agent de
  // support consulte les réservations, il ne déplace pas de l'argent.
  if (!moi || !moi.role || !ROLES_HABILITES.includes(moi.role)) {
    return { ok: false, cle: "droitsInsuffisants" };
  }

  const reservationId = String(donnees.get("reservation") ?? "");
  const evenement = String(donnees.get("evenement") ?? "") as Evenement;
  const motif = String(donnees.get("motif") ?? "").trim();

  if (!reservationId || !evenement) return { ok: false, cle: "requeteInvalide" };
  if (motif.length < 5) return { ok: false, cle: "motifRequis" };

  const [avant] = await db
    .select({ statut: reservation.statut, numero: reservation.numero })
    .from(reservation)
    .where(eq(reservation.id, reservationId))
    .limit(1);

  if (!avant) return { ok: false, cle: "introuvable" };

  // Le contrôle du domaine avant l'appel : `changerStatut` le referait, mais
  // le refus remonterait alors sous forme de phrase, là où l'interface a
  // besoin d'une clé traduisible.
  if (!evenementsAdministrateur(avant.statut as never).includes(evenement)) {
    return { ok: false, cle: "transitionImpossible" };
  }

  // `confirmer` ne se réduit pas à un changement de statut.
  //
  // C'est cette transition qui attribue le code de retrait, émet le contrat,
  // l'attestation d'assurance et la facture. Tout cela vit dans
  // `confirmerReservation`, appelée jusqu'ici par le seul webhook Stripe.
  // Passer par `changerStatut` produisait une confirmation creuse : la
  // réservation affichait « confirmée » et le locataire n'avait rien à
  // présenter au retrait. Pire que l'absence de bouton, puisque l'écran
  // affirmait le contraire.
  //
  // Constaté en menant une réservation de bout en bout : statut `confirmee`,
  // `code_retrait` nul.
  const resultat =
    evenement === "confirmer"
      ? await confirmerReservation(reservationId, "administrateur", moi.id)
      : await changerStatut({
          reservationId,
          evenement,
          acteur: "administrateur",
          acteurId: moi.id,
          motif,
        });

  if (!resultat.ok) return { ok: false, cle: "refusee" };

  const [apres] = await db
    .select({ statut: reservation.statut })
    .from(reservation)
    .where(eq(reservation.id, reservationId))
    .limit(1);

  const entetes = await headers();

  await db.insert(journalAudit).values({
    auteurId: moi.id,
    auteurEmail: moi.email,
    action: `reservation_${evenement}`,
    entite: "reservation",
    entiteId: reservationId,
    motif,
    avant: { numero: avant.numero, statut: avant.statut },
    apres: { numero: avant.numero, statut: apres?.statut ?? null },
    adresseIp: entetes.get("x-forwarded-for"),
  });

  revalidatePath("/", "layout");
  return { ok: true };
}
