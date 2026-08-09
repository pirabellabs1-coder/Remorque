import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";

import { db } from "@/server/db";
import {
  caution,
  facture,
  notification,
  paiement,
  reservation,
  reservationTransition,
  reversement,
} from "@/server/db/schema";

import { confirmerReservation } from "./confirmation";
import { changerStatut } from "./transitions";

/**
 * Ce que ces tests protègent : qu'une réservation confirmée porte toujours ce
 * que la confirmation promet.
 *
 * La machine à états décrit l'étape ainsi : « contrat généré, attestation
 * d'assurance émise, code de retrait communiqué ». Une confirmation sans code
 * bloque le retrait sur le terrain, et personne ne comprend pourquoi.
 */

const REFERENCE = "FT-2026-0008";
let identifiant: string | null = null;

async function dossier() {
  const [ligne] = await db
    .select({
      id: reservation.id,
      statut: reservation.statut,
      codeRetrait: reservation.codeRetrait,
      contratUrl: reservation.contratUrl,
      attestationUrl: reservation.attestationAssuranceUrl,
    })
    .from(reservation)
    .where(eq(reservation.numero, REFERENCE))
    .limit(1);

  return ligne ?? null;
}

/**
 * Efface tout ce qu'une confirmation laisse derrière elle.
 *
 * La liste suit ce que la transition vers « payée » crée réellement, et elle
 * doit être révisée quand cette transition change : le reversement y est entré
 * le jour où il a cessé de naître à la demande. Un mouvement oublié ici ne
 * casse pas ce test — il casse les invariants de `gel-des-fonds`, qui
 * découvrent une dette accrochée à une demande jamais payée.
 */
async function nettoyer(id: string): Promise<void> {
  await db.delete(facture).where(eq(facture.reservationId, id));
  await db.delete(caution).where(eq(caution.reservationId, id));
  await db.delete(reversement).where(eq(reversement.reservationId, id));
  await db.delete(paiement).where(eq(paiement.reservationId, id));
  await db
    .delete(reservationTransition)
    .where(eq(reservationTransition.reservationId, id));

  // Les notifications de l'essai partent aussi : sans cela, `npm run
  // courriels` afficherait à chaque passage une paire « payée / confirmée »
  // de plus, sur une réservation qui est retournée à l'état de demande.
  await db
    .delete(notification)
    .where(sql`${notification.donnees}->>'reference' = ${REFERENCE}`);

  await db
    .update(reservation)
    .set({
      statut: "demandee",
      accepteeLe: null,
      payeeLe: null,
      confirmeeLe: null,
      codeRetrait: null,
      contratUrl: null,
      attestationAssuranceUrl: null,
    })
    .where(eq(reservation.id, id));
}

beforeAll(async () => {
  // Le point de départ est posé explicitement, jamais hérité : un test qui
  // suppose l'état laissé par un autre passe une fois puis échoue.
  const ligne = await dossier();
  if (!ligne) return;
  identifiant = ligne.id;

  await nettoyer(ligne.id);
  await db
    .update(reservation)
    .set({ statut: "acceptee", accepteeLe: new Date() })
    .where(eq(reservation.id, ligne.id));
});

afterAll(async () => {
  // Le jeu d'essai est partagé, et d'autres fichiers vérifient des invariants
  // sur l'ensemble des données : tout ce qui a été créé doit disparaître,
  // sans quoi une caution resterait attachée à une demande jamais payée.
  if (!identifiant) return;
  await nettoyer(identifiant);
});

describe("confirmation d'une réservation", () => {
  it("attribue un code de retrait et les adresses des documents", async () => {
    const avant = await dossier();
    if (!avant) return;

    // On part d'une réservation payée : c'est le seul état d'où la machine
    // autorise « confirmer ».
    await changerStatut({
      reservationId: avant.id,
      evenement: "encaisser",
      acteur: "systeme",
      motif: "Recette de la confirmation",
    });

    const resultat = await confirmerReservation(avant.id);
    expect(resultat.ok).toBe(true);
    if (!resultat.ok) return;

    // Quatre chiffres, zéros de tête compris : « 0042 » est un code valide,
    // et le tronquer en « 42 » le rendrait refusé au retrait.
    expect(resultat.codeRetrait).toMatch(/^\d{4}$/);

    const apres = await dossier();
    expect(apres?.statut).toBe("confirmee");
    expect(apres?.codeRetrait).toBe(resultat.codeRetrait);
    expect(apres?.contratUrl).toContain("/api/documents/contrat/");
    expect(apres?.attestationUrl).toContain("/api/documents/attestation/");
  });

  it("ne remplace jamais un code déjà attribué", async () => {
    const avant = await dossier();
    if (!avant?.codeRetrait) return;

    // Une seconde confirmation est refusée par la machine — la réservation
    // n'est plus « payée » — mais le code doit rester intact quoi qu'il
    // arrive : le locataire l'a peut-être déjà noté.
    await confirmerReservation(avant.id);

    const apres = await dossier();
    expect(apres?.codeRetrait).toBe(avant.codeRetrait);
  });
});
