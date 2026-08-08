import "server-only";

import { desc, eq, sql } from "drizzle-orm";
import { cache } from "react";

import { compteConnecte } from "@/server/authentification/session";
import { db } from "@/server/db";
import { annonce, etatDesLieux, reservation, utilisateur } from "@/server/db/schema";

/**
 * États des lieux.
 *
 * L'écran du loueur les déduisait du statut des réservations : « confirmée
 * donc départ à faire, restituée donc retour à faire ». C'était une
 * approximation utile tant que la table était vide, et un mensonge dès qu'elle
 * ne l'est plus — un constat déjà signé continuait d'apparaître comme à faire.
 */

export type Constat = {
  id: string;
  reservationId: string;
  reference: string;
  annonceTitre: string;
  interlocuteur: string;
  type: "depart" | "retour";
  date: Date;
  finalise: boolean;
  /** Un point de contrôle au moins est en défaut. */
  reserve: boolean;
  commentaire: string | null;
};

const nomAffiche = sql<string>`
  ${utilisateur.prenom} || coalesce(' ' || left(${utilisateur.nom}, 1) || '.', '')
`;

/** Les constats des locations du loueur connecté, les plus récents d'abord. */
export const mesConstats = cache(async (): Promise<Constat[]> => {
  const moi = await compteConnecte();
  if (!moi) return [];

  const lignes = await db
    .select({
      id: etatDesLieux.id,
      reservationId: etatDesLieux.reservationId,
      reference: reservation.numero,
      annonceTitre: annonce.titre,
      interlocuteur: nomAffiche,
      type: etatDesLieux.type,
      date: etatDesLieux.creeLe,
      finaliseLe: etatDesLieux.finaliseLe,
      controles: etatDesLieux.controles,
      commentaire: etatDesLieux.commentaire,
    })
    .from(etatDesLieux)
    .innerJoin(reservation, eq(reservation.id, etatDesLieux.reservationId))
    .innerJoin(annonce, eq(annonce.id, reservation.annonceId))
    .innerJoin(utilisateur, eq(utilisateur.id, reservation.locataireId))
    .where(eq(reservation.proprietaireId, moi.id))
    .orderBy(desc(etatDesLieux.creeLe));

  return lignes.map((ligne) => {
    const controles = (ligne.controles ?? {}) as Record<string, boolean>;

    return {
      id: ligne.id,
      reservationId: ligne.reservationId,
      reference: ligne.reference,
      annonceTitre: ligne.annonceTitre,
      interlocuteur: ligne.interlocuteur,
      type: ligne.type as "depart" | "retour",
      date: ligne.date,
      finalise: ligne.finaliseLe !== null,
      // Un point de contrôle en défaut vaut réserve : c'est ce qui distingue
      // une restitution sans histoire d'un dossier à instruire.
      reserve: Object.values(controles).some((valeur) => valeur === false),
      commentaire: ligne.commentaire,
    };
  });
});

/**
 * Constats restant à réaliser.
 *
 * Déduits du statut, mais **en écartant ceux qui existent déjà** — c'est
 * exactement ce que l'ancienne version ne faisait pas.
 */
export const constatsAfaire = cache(async () => {
  const moi = await compteConnecte();
  if (!moi) return [];

  const lignes = await db
    .select({
      reservationId: reservation.id,
      reference: reservation.numero,
      annonceTitre: annonce.titre,
      interlocuteur: nomAffiche,
      statut: reservation.statut,
      debut: reservation.debut,
      fin: reservation.fin,
      aDepart: sql<boolean>`exists (
        select 1 from etat_des_lieux e
        where e.reservation_id = ${reservation.id} and e.type = 'depart'
      )`,
      aRetour: sql<boolean>`exists (
        select 1 from etat_des_lieux e
        where e.reservation_id = ${reservation.id} and e.type = 'retour'
      )`,
    })
    .from(reservation)
    .innerJoin(annonce, eq(annonce.id, reservation.annonceId))
    .innerJoin(utilisateur, eq(utilisateur.id, reservation.locataireId))
    .where(
      sql`${reservation.proprietaireId} = ${moi.id}
          and ${reservation.statut} in ('confirmee','en_cours','restituee')`,
    )
    .orderBy(reservation.debut);

  return lignes
    .map((ligne) => {
      // Le départ d'abord : on ne constate pas un retour avant d'être parti.
      if (!ligne.aDepart) return { ...ligne, type: "depart" as const };
      if (!ligne.aRetour && ligne.statut !== "confirmee") {
        return { ...ligne, type: "retour" as const };
      }
      return null;
    })
    .filter((entree): entree is NonNullable<typeof entree> => entree !== null);
});
