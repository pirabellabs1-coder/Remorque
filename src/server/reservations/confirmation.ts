import "server-only";

import { randomInt } from "node:crypto";

import { eq } from "drizzle-orm";

import { db } from "@/server/db";
import { reservation } from "@/server/db/schema";
import { emettreFacture } from "@/server/documents/facture";

import { changerStatut } from "./transitions";

/**
 * Confirmation d'une réservation payée.
 *
 * La machine à états décrit cette étape : « contrat généré, attestation
 * d'assurance émise, code de retrait communiqué ». Elle attendait depuis le
 * début que quelque chose l'émette — la réservation s'arrêtait à « payée ».
 *
 * Les trois choses promises sont faites ici, et dans cet ordre : ce qui
 * conditionne la confirmation est écrit **avant** la transition, pour qu'une
 * réservation confirmée n'existe jamais sans son code ni ses documents.
 */

/**
 * Code de retrait à quatre chiffres, échangé de vive voix au moment de la
 * remise du matériel (M05).
 *
 * `randomInt` du module de chiffrement, non `Math.random` : le code atteste
 * qu'on est bien devant la bonne personne, et un générateur prévisible le
 * réduirait à une formalité. Quatre chiffres suffisent parce qu'il ne protège
 * rien à distance — il se présente en face, une fois.
 */
function engendrerCodeRetrait(): string {
  return String(randomInt(0, 10_000)).padStart(4, "0");
}

/**
 * Les documents ne sont pas fabriqués ici : ils sont composés à la demande,
 * depuis la base, par `/api/documents/…`. Ce qu'on inscrit est donc l'adresse
 * stable où les trouver — un fichier figé deviendrait faux à la première
 * correction, et il faudrait le régénérer partout.
 */
function adresseDocument(type: "contrat" | "attestation", id: string): string {
  return `/api/documents/${type}/${id}`;
}

export type ResultatConfirmation =
  | { ok: true; codeRetrait: string }
  | { ok: false; motif: string };

export async function confirmerReservation(
  reservationId: string,
  acteur: "systeme" | "administrateur" = "systeme",
  acteurId?: string,
): Promise<ResultatConfirmation> {
  const [dossier] = await db
    .select({ statut: reservation.statut, codeRetrait: reservation.codeRetrait })
    .from(reservation)
    .where(eq(reservation.id, reservationId))
    .limit(1);

  if (!dossier) return { ok: false, motif: "Réservation introuvable." };

  // Un code déjà attribué n'est jamais remplacé : le locataire l'a peut-être
  // noté, et le changer ferait échouer le retrait sans que personne comprenne.
  const code = dossier.codeRetrait ?? engendrerCodeRetrait();

  await db
    .update(reservation)
    .set({
      codeRetrait: code,
      contratUrl: adresseDocument("contrat", reservationId),
      attestationAssuranceUrl: adresseDocument("attestation", reservationId),
      modifieLe: new Date(),
    })
    .where(eq(reservation.id, reservationId));

  // La transition vient après : c'est elle qui trace et qui notifie, et elle
  // ne doit pas annoncer une confirmation dont les pièces manqueraient.
  const resultat = await changerStatut({
    reservationId,
    evenement: "confirmer",
    acteur,
    acteurId,
    motif: "Contrat et attestation émis, code de retrait attribué",
  });

  if (!resultat.ok) return { ok: false, motif: resultat.motif };

  // Le reçu est émis après la transition : il consigne un fait acquis. Émis
  // avant, il documenterait une confirmation que la machine pourrait refuser.
  await emettreFacture(reservationId);

  return { ok: true, codeRetrait: code };
}
