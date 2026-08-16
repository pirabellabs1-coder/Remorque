import "server-only";

import { and, desc, eq, sql } from "drizzle-orm";
import { cache } from "react";

import { porteReserve } from "@/domain/location/constat";
import { compteConnecte } from "@/server/authentification/session";
import { db } from "@/server/db";
import {
  annonce,
  etatDesLieux,
  etatDesLieuxPhoto,
  reservation,
  utilisateur,
} from "@/server/db/schema";

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
      reserve: porteReserve(controles),
      commentaire: ligne.commentaire,
    };
  });
});

export type ConstatDetail = {
  id: string;
  type: "depart" | "retour";
  controles: Record<string, boolean>;
  kilometrage: number | null;
  commentaire: string | null;
  signatureLocataireLe: Date | null;
  signatureProprietaireLe: Date | null;
  finaliseLe: Date | null;
  reserve: boolean;
};

export type ContexteConstat = {
  reservation: {
    id: string;
    reference: string;
    annonceTitre: string;
    interlocuteur: string;
    statut: string;
    debut: Date;
    fin: Date;
    /** Nom complet du locataire, proposé au relevé du conducteur. */
    locataireNom: string;
    /** Catégories déjà vérifiées à son dossier — vide s'il n'a rien déposé. */
    locataireCategories: string[];
  };
  depart: ConstatDetail | null;
  retour: ConstatDetail | null;
};

/**
 * Tout ce qu'il faut pour afficher ou saisir un constat sur une location.
 *
 * Les deux constats sont rendus ensemble, même quand un seul est demandé :
 * le constat de retour se lit **par rapport** à celui de départ — un feu déjà
 * cassé au départ n'est pas un dommage du locataire.
 */
export async function contexteConstat(
  reservationId: string,
): Promise<ContexteConstat | null> {
  const moi = await compteConnecte();
  if (!moi) return null;

  const [dossier] = await db
    .select({
      id: reservation.id,
      reference: reservation.numero,
      annonceTitre: annonce.titre,
      interlocuteur: nomAffiche,
      statut: reservation.statut,
      debut: reservation.debut,
      fin: reservation.fin,
      locatairePrenom: utilisateur.prenom,
      locataireNomFamille: utilisateur.nom,
      // Les catégories ne sont proposées que si le permis a été *vérifié* :
      // suggérer celles d'une pièce refusée ou en attente ferait valider par
      // défaut ce qu'aucun contrôleur n'a accepté.
      locataireCategories: sql<string[]>`case
        when ${utilisateur.permisStatut} = 'verifie'
        then ${utilisateur.permisCategories}
        else '[]'::jsonb end`,
    })
    .from(reservation)
    .innerJoin(annonce, eq(annonce.id, reservation.annonceId))
    .innerJoin(utilisateur, eq(utilisateur.id, reservation.locataireId))
    .where(
      sql`${reservation.id} = ${reservationId}
          and ${reservation.proprietaireId} = ${moi.id}`,
    )
    .limit(1);

  if (!dossier) return null;

  const constats = await db
    .select({
      id: etatDesLieux.id,
      type: etatDesLieux.type,
      controles: etatDesLieux.controles,
      kilometrage: etatDesLieux.kilometrage,
      commentaire: etatDesLieux.commentaire,
      signatureLocataireLe: etatDesLieux.signatureLocataireLe,
      signatureProprietaireLe: etatDesLieux.signatureProprietaireLe,
      finaliseLe: etatDesLieux.finaliseLe,
    })
    .from(etatDesLieux)
    .where(eq(etatDesLieux.reservationId, reservationId));

  const detail = (type: "depart" | "retour"): ConstatDetail | null => {
    const ligne = constats.find((constat) => constat.type === type);
    if (!ligne) return null;

    const controles = (ligne.controles ?? {}) as Record<string, boolean>;
    return {
      id: ligne.id,
      type,
      controles,
      kilometrage: ligne.kilometrage,
      commentaire: ligne.commentaire,
      signatureLocataireLe: ligne.signatureLocataireLe,
      signatureProprietaireLe: ligne.signatureProprietaireLe,
      finaliseLe: ligne.finaliseLe,
      reserve: porteReserve(controles),
    };
  };

  return {
    reservation: {
      ...dossier,
      locataireNom:
        [dossier.locatairePrenom, dossier.locataireNomFamille]
          .filter(Boolean)
          .join(" ") || dossier.interlocuteur,
      locataireCategories: dossier.locataireCategories ?? [],
    },
    depart: detail("depart"),
    retour: detail("retour"),
  };
}

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

/**
 * Les pièces déjà déposées sur un constat, brouillon compris.
 *
 * Rend une liste vide quand le constat n'existe pas encore : c'est le cas
 * ordinaire à la première ouverture de l'écran, et non une erreur. La création
 * de la ligne appartient au dépôt, pas à la lecture — une lecture qui écrit
 * laisserait des constats vides derrière chaque page ouverte par curiosité.
 */
export async function mediasDuConstat(
  reservationId: string,
  type: "depart" | "retour",
): Promise<
  { id: string; url: string; media: "photo" | "video" }[]
> {
  const [constat] = await db
    .select({ id: etatDesLieux.id })
    .from(etatDesLieux)
    .where(
      and(
        eq(etatDesLieux.reservationId, reservationId),
        eq(etatDesLieux.type, type),
      ),
    )
    .limit(1);

  if (!constat) return [];

  return db
    .select({
      id: etatDesLieuxPhoto.id,
      url: etatDesLieuxPhoto.url,
      media: etatDesLieuxPhoto.media,
    })
    .from(etatDesLieuxPhoto)
    .where(eq(etatDesLieuxPhoto.etatDesLieuxId, constat.id))
    .orderBy(etatDesLieuxPhoto.creeLe);
}
