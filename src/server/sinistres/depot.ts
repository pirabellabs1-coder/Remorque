import "server-only";

import { and, desc, eq, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import type { StatutSinistre } from "@/domain/sinistre/machine";
import { compteConnecte } from "@/server/authentification/session";
import { db } from "@/server/db";
import { annonce, reservation, sinistre, utilisateur } from "@/server/db/schema";

/**
 * Lecture des sinistres, restreinte aux parties.
 *
 * Un sinistre décrit un dommage, chiffre une estimation et finira chez un
 * assureur : il ne se lit qu'entre ceux qu'il concerne — et l'administration,
 * qui le transmet. La garde est dans la clause, comme pour les litiges.
 */

export type SinistreDossier = {
  id: string;
  statut: StatutSinistre;
  description: string;
  devise: string;
  montantEstime: number | null;
  montantIndemnise: number | null;
  referenceAssureur: string | null;
  refusMotif: string | null;
  declareLe: Date;
  transmisLe: Date | null;
  clotureLe: Date | null;
  /** Le compte connecté est-il à l'origine de la déclaration ? */
  declareParMoi: boolean;
  reservationId: string;
  reference: string;
  annonceTitre: string;
  interlocuteur: string;
  /** Rôle du compte connecté sur ce dossier. */
  monRole: "locataire" | "proprietaire" | "administrateur";
};

const colonnes = {
  id: sinistre.id,
  statut: sinistre.statut,
  description: sinistre.description,
  devise: sinistre.devise,
  montantEstime: sinistre.montantEstime,
  montantIndemnise: sinistre.montantIndemnise,
  referenceAssureur: sinistre.referenceAssureur,
  refusMotif: sinistre.refusMotif,
  declareLe: sinistre.creeLe,
  transmisLe: sinistre.transmisLe,
  clotureLe: sinistre.clotureLe,
  declareParId: sinistre.declareParId,
  reservationId: sinistre.reservationId,
  reference: reservation.numero,
  annonceTitre: annonce.titre,
  locataireId: reservation.locataireId,
  proprietaireId: reservation.proprietaireId,
};

function composer(
  ligne: Record<string, unknown>,
  moiId: string,
  estAdmin: boolean,
  nomLocataire: string,
  nomProprietaire: string,
): SinistreDossier {
  const monRole =
    ligne.locataireId === moiId
      ? "locataire"
      : ligne.proprietaireId === moiId
        ? "proprietaire"
        : "administrateur";

  return {
    id: ligne.id as string,
    statut: ligne.statut as StatutSinistre,
    description: ligne.description as string,
    devise: ligne.devise as string,
    montantEstime: (ligne.montantEstime as number | null) ?? null,
    montantIndemnise: (ligne.montantIndemnise as number | null) ?? null,
    referenceAssureur: (ligne.referenceAssureur as string | null) ?? null,
    refusMotif: (ligne.refusMotif as string | null) ?? null,
    declareLe: ligne.declareLe as Date,
    transmisLe: (ligne.transmisLe as Date | null) ?? null,
    clotureLe: (ligne.clotureLe as Date | null) ?? null,
    declareParMoi: ligne.declareParId === moiId,
    reservationId: ligne.reservationId as string,
    reference: ligne.reference as string,
    annonceTitre: ligne.annonceTitre as string,
    interlocuteur: monRole === "locataire" ? nomProprietaire : nomLocataire,
    monRole: estAdmin && monRole === "administrateur" ? "administrateur" : monRole,
  };
}

/** Le sinistre d'une réservation, s'il existe et si l'on y est partie. */
export async function sinistreDeLaReservation(
  reservationId: string,
): Promise<SinistreDossier | null> {
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
    .from(sinistre)
    .innerJoin(reservation, eq(reservation.id, sinistre.reservationId))
    .innerJoin(annonce, eq(annonce.id, reservation.annonceId))
    .innerJoin(locataire, eq(locataire.id, reservation.locataireId))
    .innerJoin(proprietaire, eq(proprietaire.id, reservation.proprietaireId))
    .where(
      and(
        eq(sinistre.reservationId, reservationId),
        moi.role
          ? undefined
          : or(
              eq(reservation.locataireId, moi.id),
              eq(reservation.proprietaireId, moi.id),
            ),
      ),
    )
    .orderBy(desc(sinistre.creeLe))
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

/** Le sinistre par son identifiant — pour l'administration, qui instruit. */
export async function sinistreParIdentifiant(
  sinistreId: string,
): Promise<SinistreDossier | null> {
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
    .from(sinistre)
    .innerJoin(reservation, eq(reservation.id, sinistre.reservationId))
    .innerJoin(annonce, eq(annonce.id, reservation.annonceId))
    .innerJoin(locataire, eq(locataire.id, reservation.locataireId))
    .innerJoin(proprietaire, eq(proprietaire.id, reservation.proprietaireId))
    .where(
      and(
        eq(sinistre.id, sinistreId),
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

/** Le contexte d'une réservation, pour déclarer un sinistre dessus. */
export async function contexteDeclaration(reservationId: string): Promise<{
  reference: string;
  annonceTitre: string;
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
    devise: ligne.devise,
    statut: ligne.statut,
    interlocuteur:
      ligne.locataireId === moi.id
        ? (ligne.nomProprietaire ?? "")
        : (ligne.nomLocataire ?? ""),
  };
}
