import "server-only";

import { and, eq, sql } from "drizzle-orm";

import { composerFacture } from "@/domain/paiement/facture";
import { db } from "@/server/db";
import { annonce, facture, pays, reservation, utilisateur } from "@/server/db/schema";

/**
 * Émission du reçu du locataire.
 *
 * Émis à la confirmation, une seule fois, et jamais modifié ensuite : une
 * facture se corrige par un avoir, pas par une réécriture. C'est aussi
 * pourquoi les montants y sont **recopiés** plutôt que joints — le jour où un
 * barème change, le reçu doit continuer de dire ce qui a été payé.
 *
 * Le PDF, lui, est composé à la demande depuis cette ligne : le document
 * n'existe qu'en tant que rendu d'un fait déjà consigné.
 */

export type LigneFacture = {
  cle: string;
  montantTtc: number;
  montantTva: number;
};

/**
 * Numéro séquentiel, par année civile.
 *
 * Une numérotation continue et sans trou est une exigence comptable. Le
 * compte est fait dans la transaction qui insère, ce qui suffit tant qu'un
 * seul processus émet ; à plusieurs, il faudra une séquence dédiée en base —
 * le jour où ce sera le cas, c'est ici qu'il faudra regarder.
 */
async function numeroSuivant(
  executeur: Parameters<Parameters<typeof db.transaction>[0]>[0],
  annee: number,
): Promise<string> {
  const [ligne] = await executeur
    .select({ total: sql<number>`count(*)::int` })
    .from(facture)
    .where(sql`${facture.numero} like ${`FA-${annee}-%`}`);

  return `FA-${annee}-${String((ligne?.total ?? 0) + 1).padStart(5, "0")}`;
}

export async function emettreFacture(reservationId: string): Promise<void> {
  const [dossier] = await db
    .select({
      id: reservation.id,
      locataireId: reservation.locataireId,
      devise: reservation.devise,
      loyer: reservation.loyer,
      fraisService: reservation.fraisService,
      totalLocataire: reservation.totalLocataire,
      tvaCommissionBp: pays.tvaCommissionBp,
    })
    .from(reservation)
    .innerJoin(pays, eq(pays.id, reservation.paysId))
    .where(eq(reservation.id, reservationId))
    .limit(1);

  if (!dossier) return;

  const composition = composerFacture(dossier);
  // Composantes incohérentes : on n'émet pas de reçu plutôt que d'en émettre
  // un faux. L'anomalie se verra à l'absence, qui se corrige ; une facture
  // erronée, elle, part chez le client.
  if (!composition) return;

  await db.transaction(async (tx) => {
    const [existante] = await tx
      .select({ id: facture.id })
      .from(facture)
      .where(
        and(eq(facture.reservationId, reservationId), eq(facture.type, "recu_locataire")),
      )
      .limit(1);

    if (existante) return;

    await tx.insert(facture).values({
      reservationId: dossier.id,
      destinataireId: dossier.locataireId,
      type: "recu_locataire",
      numero: await numeroSuivant(tx, new Date().getFullYear()),
      devise: composition.devise,
      montantHt: composition.montantHt,
      montantTva: composition.montantTva,
      montantTtc: composition.montantTtc,
      tauxTvaBp: composition.tauxTvaBp,
      lignes: composition.lignes as unknown as Record<string, unknown>[],
    });
  });
}

export type FactureDocument = {
  numero: string;
  emiseLe: Date;
  devise: string;
  montantHt: number;
  montantTva: number;
  montantTtc: number;
  tauxTvaBp: number;
  lignes: readonly LigneFacture[];
  reference: string;
  annonceTitre: string;
  destinataireNom: string;
};

/**
 * La facture d'une réservation, si le compte connecté en est le destinataire.
 *
 * Le contrôle est dans la clause : une facture nomme son destinataire et porte
 * des montants, elle ne s'ouvre pas sur un identifiant recopié.
 */
export async function factureDuDossier(
  reservationId: string,
  compteId: string,
): Promise<FactureDocument | null> {
  const [ligne] = await db
    .select({
      numero: facture.numero,
      emiseLe: facture.emiseLe,
      devise: facture.devise,
      montantHt: facture.montantHt,
      montantTva: facture.montantTva,
      montantTtc: facture.montantTtc,
      tauxTvaBp: facture.tauxTvaBp,
      lignes: facture.lignes,
      reference: reservation.numero,
      annonceTitre: annonce.titre,
      prenom: utilisateur.prenom,
      nom: utilisateur.nom,
    })
    .from(facture)
    .innerJoin(reservation, eq(reservation.id, facture.reservationId))
    .innerJoin(annonce, eq(annonce.id, reservation.annonceId))
    .innerJoin(utilisateur, eq(utilisateur.id, facture.destinataireId))
    .where(
      and(
        eq(facture.reservationId, reservationId),
        eq(facture.destinataireId, compteId),
      ),
    )
    .limit(1);

  if (!ligne) return null;

  return {
    numero: ligne.numero,
    emiseLe: ligne.emiseLe,
    devise: ligne.devise,
    montantHt: ligne.montantHt,
    montantTva: ligne.montantTva,
    montantTtc: ligne.montantTtc,
    tauxTvaBp: ligne.tauxTvaBp,
    lignes: (ligne.lignes ?? []) as unknown as LigneFacture[],
    reference: ligne.reference,
    annonceTitre: ligne.annonceTitre,
    destinataireNom: [ligne.prenom, ligne.nom].filter(Boolean).join(" "),
  };
}
