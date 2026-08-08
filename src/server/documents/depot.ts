import "server-only";

import { and, eq, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { compteConnecte } from "@/server/authentification/session";
import { db } from "@/server/db";
import {
  annonce,
  etatDesLieux,
  pays,
  reservation,
  utilisateur,
} from "@/server/db/schema";

/**
 * Les faits que portent les documents.
 *
 * Une seule lecture, et **elle vaut contrôle d'accès** : la requête ne rend une
 * ligne que si le compte connecté est partie à la réservation. Un contrat de
 * location nomme les deux parties, cite une adresse et des montants — c'est
 * exactement ce qu'un identifiant recopié dans une adresse ne doit pas ouvrir.
 */

export type DossierDocument = {
  numero: string;
  statut: string;
  debut: Date;
  fin: Date;
  nombreJours: number;
  devise: string;
  loyer: number;
  fraisService: number;
  totalLocataire: number;
  caution: number;
  annonceTitre: string;
  annonceVille: string;
  ptacKg: number | null;
  chargeUtileKg: number | null;
  locataireNom: string;
  proprietaireNom: string;
  paysNom: string;
  assureurNom: string | null;
  confirmeeLe: Date | null;
  /** Le compte connecté est-il le locataire ? Sinon, il est le propriétaire. */
  jeSuisLocataire: boolean;
};

export async function dossierDocument(
  reservationId: string,
): Promise<DossierDocument | null> {
  const moi = await compteConnecte();
  if (!moi) return null;

  const locataire = alias(utilisateur, "locataire");
  const proprietaire = alias(utilisateur, "proprietaire");

  const [ligne] = await db
    .select({
      numero: reservation.numero,
      statut: reservation.statut,
      debut: reservation.debut,
      fin: reservation.fin,
      nombreJours: reservation.nombreJours,
      devise: reservation.devise,
      loyer: reservation.loyer,
      fraisService: reservation.fraisService,
      totalLocataire: reservation.totalLocataire,
      caution: reservation.caution,
      confirmeeLe: reservation.confirmeeLe,
      locataireId: reservation.locataireId,
      annonceTitre: annonce.titre,
      annonceVille: annonce.ville,
      ptacKg: annonce.ptacKg,
      chargeUtileKg: annonce.chargeUtileKg,
      paysNom: pays.nom,
      assureurNom: pays.assureurNom,
      locatairePrenom: locataire.prenom,
      locataireNomFamille: locataire.nom,
      proprietairePrenom: proprietaire.prenom,
      proprietaireNomFamille: proprietaire.nom,
    })
    .from(reservation)
    .innerJoin(annonce, eq(annonce.id, reservation.annonceId))
    .innerJoin(pays, eq(pays.id, reservation.paysId))
    .innerJoin(locataire, eq(locataire.id, reservation.locataireId))
    .innerJoin(proprietaire, eq(proprietaire.id, reservation.proprietaireId))
    .where(
      and(
        eq(reservation.id, reservationId),
        // Le contrôle d'accès est dans la clause, non après la lecture : le
        // dossier d'autrui n'est même pas rapporté du serveur.
        or(
          eq(reservation.locataireId, moi.id),
          eq(reservation.proprietaireId, moi.id),
        ),
      ),
    )
    .limit(1);

  if (!ligne) return null;

  const jeSuisLocataire = ligne.locataireId === moi.id;

  const assembler = (prenom: string | null, nom: string | null) =>
    [prenom, nom].filter(Boolean).join(" ");

  return {
    numero: ligne.numero,
    statut: ligne.statut,
    debut: ligne.debut,
    fin: ligne.fin,
    nombreJours: ligne.nombreJours,
    devise: ligne.devise,
    loyer: ligne.loyer,
    fraisService: ligne.fraisService,
    totalLocataire: ligne.totalLocataire,
    caution: ligne.caution,
    annonceTitre: ligne.annonceTitre,
    annonceVille: ligne.annonceVille,
    ptacKg: ligne.ptacKg,
    chargeUtileKg: ligne.chargeUtileKg,
    locataireNom: assembler(ligne.locatairePrenom, ligne.locataireNomFamille),
    proprietaireNom: assembler(
      ligne.proprietairePrenom,
      ligne.proprietaireNomFamille,
    ),
    paysNom: ligne.paysNom,
    assureurNom: ligne.assureurNom,
    confirmeeLe: ligne.confirmeeLe,
    jeSuisLocataire,
  };
}

export type ConstatDocument = {
  type: "depart" | "retour";
  controles: Record<string, boolean>;
  kilometrage: number | null;
  commentaire: string | null;
  signatureLocataireLe: Date | null;
  signatureProprietaireLe: Date | null;
  finaliseLe: Date | null;
};

/** Les constats d'une réservation, dans l'ordre où ils ont été signés. */
export async function constatsDuDossier(
  reservationId: string,
): Promise<ConstatDocument[]> {
  const lignes = await db
    .select({
      type: etatDesLieux.type,
      controles: etatDesLieux.controles,
      kilometrage: etatDesLieux.kilometrage,
      commentaire: etatDesLieux.commentaire,
      signatureLocataireLe: etatDesLieux.signatureLocataireLe,
      signatureProprietaireLe: etatDesLieux.signatureProprietaireLe,
      finaliseLe: etatDesLieux.finaliseLe,
    })
    .from(etatDesLieux)
    .where(eq(etatDesLieux.reservationId, reservationId))
    .orderBy(etatDesLieux.creeLe);

  return lignes.map((ligne) => ({
    type: ligne.type as "depart" | "retour",
    controles: (ligne.controles ?? {}) as Record<string, boolean>,
    kilometrage: ligne.kilometrage,
    commentaire: ligne.commentaire,
    signatureLocataireLe: ligne.signatureLocataireLe,
    signatureProprietaireLe: ligne.signatureProprietaireLe,
    finaliseLe: ligne.finaliseLe,
  }));
}
