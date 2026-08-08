import "server-only";

import { and, desc, eq, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import type { MotifLitige, StatutLitige } from "@/domain/litige/machine";
import { compteConnecte } from "@/server/authentification/session";
import { db } from "@/server/db";
import { annonce, litige, reservation, utilisateur } from "@/server/db/schema";

/**
 * Lecture des litiges, restreinte aux parties.
 *
 * Un litige nomme deux personnes, chiffre une réclamation et porte une
 * décision : il ne s'ouvre qu'à ceux qu'il concerne. La garde est dans la
 * clause, comme partout ailleurs — le dossier d'autrui n'est pas rapporté.
 */

export type LitigeDossier = {
  id: string;
  statut: StatutLitige;
  motif: MotifLitige;
  description: string | null;
  devise: string;
  montantReclame: number | null;
  montantPropose: number | null;
  montantAccorde: number | null;
  decisionMotif: string | null;
  ouvertLe: Date;
  resoluLe: Date | null;
  /** Le compte connecté est-il à l'origine du litige ? */
  ouvertParMoi: boolean;
  reservationId: string;
  reference: string;
  annonceTitre: string;
  caution: number;
  interlocuteur: string;
  /** Rôle du compte connecté sur ce dossier. */
  monRole: "locataire" | "proprietaire" | "administrateur";
  /**
   * Ce que le litige a **réellement** immobilisé.
   *
   * Ouvrir un litige gèle ce qui peut l'être — pas ce qui est déjà parti. Sur
   * une location close depuis longtemps, la caution est libérée et le
   * reversement envoyé : le dossier reste instruisable, mais annoncer des
   * fonds immobilisés serait faux.
   */
  cautionGelee: boolean;
  reversementGele: boolean;
};

const colonnes = {
  id: litige.id,
  statut: litige.statut,
  motif: litige.motif,
  description: litige.description,
  devise: litige.devise,
  montantReclame: litige.montantReclame,
  montantPropose: litige.montantPropose,
  montantAccorde: litige.montantAccorde,
  decisionMotif: litige.decisionMotif,
  ouvertLe: litige.creeLe,
  resoluLe: litige.resoluLe,
  ouvertParId: litige.ouvertParId,
  reservationId: litige.reservationId,
  reference: reservation.numero,
  annonceTitre: annonce.titre,
  caution: reservation.caution,
  locataireId: reservation.locataireId,
  proprietaireId: reservation.proprietaireId,
  cautionStatut: sql<string | null>`(
    select c.statut from caution c where c.reservation_id = ${reservation.id} limit 1
  )`,
  reversementStatut: sql<string | null>`(
    select v.statut from reversement v where v.reservation_id = ${reservation.id} limit 1
  )`,
};

function composer(
  ligne: Record<string, unknown>,
  moiId: string,
  estAdmin: boolean,
  nomLocataire: string,
  nomProprietaire: string,
): LitigeDossier {
  const monRole =
    ligne.locataireId === moiId
      ? "locataire"
      : ligne.proprietaireId === moiId
        ? "proprietaire"
        : "administrateur";

  return {
    id: ligne.id as string,
    statut: ligne.statut as StatutLitige,
    motif: ligne.motif as MotifLitige,
    description: (ligne.description as string | null) ?? null,
    devise: ligne.devise as string,
    montantReclame: (ligne.montantReclame as number | null) ?? null,
    montantPropose: (ligne.montantPropose as number | null) ?? null,
    montantAccorde: (ligne.montantAccorde as number | null) ?? null,
    decisionMotif: (ligne.decisionMotif as string | null) ?? null,
    ouvertLe: ligne.ouvertLe as Date,
    resoluLe: (ligne.resoluLe as Date | null) ?? null,
    ouvertParMoi: ligne.ouvertParId === moiId,
    reservationId: ligne.reservationId as string,
    reference: ligne.reference as string,
    annonceTitre: ligne.annonceTitre as string,
    caution: ligne.caution as number,
    // L'interlocuteur est l'autre partie ; pour l'administration, le locataire,
    // qui est celui que le dossier vise le plus souvent.
    interlocuteur: monRole === "locataire" ? nomProprietaire : nomLocataire,
    monRole: estAdmin && monRole === "administrateur" ? "administrateur" : monRole,
    cautionGelee: ligne.cautionStatut === "contestee",
    reversementGele: ligne.reversementStatut === "gele",
  };
}

/** Le litige d'une réservation, s'il existe et si l'on y est partie. */
export async function litigeDeLaReservation(
  reservationId: string,
): Promise<LitigeDossier | null> {
  const moi = await compteConnecte();
  if (!moi) return null;

  const locataire = alias(utilisateur, "locataire");
  const proprietaire = alias(utilisateur, "proprietaire");

  const [ligne] = await db
    .select({
      ...colonnes,
      nomLocataire: locataire.prenom,
      nomProprietaire: proprietaire.prenom,
    })
    .from(litige)
    .innerJoin(reservation, eq(reservation.id, litige.reservationId))
    .innerJoin(annonce, eq(annonce.id, reservation.annonceId))
    .innerJoin(locataire, eq(locataire.id, reservation.locataireId))
    .innerJoin(proprietaire, eq(proprietaire.id, reservation.proprietaireId))
    .where(
      and(
        eq(litige.reservationId, reservationId),
        moi.role
          ? undefined
          : or(
              eq(reservation.locataireId, moi.id),
              eq(reservation.proprietaireId, moi.id),
            ),
      ),
    )
    .orderBy(desc(litige.creeLe))
    .limit(1);

  if (!ligne) return null;

  return composer(
    ligne,
    moi.id,
    Boolean(moi.role),
    ligne.nomLocataire ?? "",
    ligne.nomProprietaire ?? "",
  );
}

/** Le litige par son identifiant — pour l'administration, qui arbitre. */
export async function litigeParIdentifiant(
  litigeId: string,
): Promise<LitigeDossier | null> {
  const moi = await compteConnecte();
  if (!moi) return null;

  const locataire = alias(utilisateur, "locataire");
  const proprietaire = alias(utilisateur, "proprietaire");

  const [ligne] = await db
    .select({
      ...colonnes,
      nomLocataire: locataire.prenom,
      nomProprietaire: proprietaire.prenom,
    })
    .from(litige)
    .innerJoin(reservation, eq(reservation.id, litige.reservationId))
    .innerJoin(annonce, eq(annonce.id, reservation.annonceId))
    .innerJoin(locataire, eq(locataire.id, reservation.locataireId))
    .innerJoin(proprietaire, eq(proprietaire.id, reservation.proprietaireId))
    .where(
      and(
        eq(litige.id, litigeId),
        moi.role
          ? undefined
          : or(
              eq(reservation.locataireId, moi.id),
              eq(reservation.proprietaireId, moi.id),
            ),
      ),
    )
    .limit(1);

  if (!ligne) return null;

  return composer(
    ligne,
    moi.id,
    Boolean(moi.role),
    ligne.nomLocataire ?? "",
    ligne.nomProprietaire ?? "",
  );
}

/** Le contexte d'une réservation, pour ouvrir un litige dessus. */
export async function contexteOuverture(reservationId: string): Promise<{
  reference: string;
  annonceTitre: string;
  caution: number;
  devise: string;
  statut: string;
  interlocuteur: string;
} | null> {
  const moi = await compteConnecte();
  if (!moi) return null;

  const locataire = alias(utilisateur, "locataire");
  const proprietaire = alias(utilisateur, "proprietaire");

  const [ligne] = await db
    .select({
      reference: reservation.numero,
      annonceTitre: annonce.titre,
      caution: reservation.caution,
      devise: reservation.devise,
      statut: reservation.statut,
      locataireId: reservation.locataireId,
      nomLocataire: locataire.prenom,
      nomProprietaire: proprietaire.prenom,
    })
    .from(reservation)
    .innerJoin(annonce, eq(annonce.id, reservation.annonceId))
    .innerJoin(locataire, eq(locataire.id, reservation.locataireId))
    .innerJoin(proprietaire, eq(proprietaire.id, reservation.proprietaireId))
    .where(
      and(
        eq(reservation.id, reservationId),
        or(
          eq(reservation.locataireId, moi.id),
          eq(reservation.proprietaireId, moi.id),
        ),
      ),
    )
    .limit(1);

  if (!ligne) return null;

  return {
    reference: ligne.reference,
    annonceTitre: ligne.annonceTitre,
    caution: ligne.caution,
    devise: ligne.devise,
    statut: ligne.statut,
    interlocuteur:
      ligne.locataireId === moi.id
        ? (ligne.nomProprietaire ?? "")
        : (ligne.nomLocataire ?? ""),
  };
}
