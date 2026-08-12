import "server-only";

import { and, desc, eq, inArray } from "drizzle-orm";

import {
  avancement,
  manquesPourPublier,
  manquesPourReserver,
  piecesRequises,
  type EtatVerification,
  type Manque,
  type Piece,
  type StatutVerification,
} from "@/domain/verification/dossier";
import { db } from "@/server/db";
import { pieceVerification, utilisateur } from "@/server/db/schema";
import { lireParametres } from "@/server/administration/parametres";

/**
 * Lecture du dossier de vérification d'un compte.
 *
 * Les règles sont dans le domaine ; ce fichier ne fait que les alimenter et
 * porter la seule décision qui dépende de la base — la vérification est-elle
 * exigée sur cette plateforme.
 */

export type DossierVerification = {
  etat: EtatVerification;
  /** Pièces attendues de ce compte, selon les profils qu'il porte. */
  requises: Piece[];
  manquesPublication: Manque[];
  manquesReservation: Manque[];
  avancement: { faits: number; total: number };
  /** Faux si l'administration a levé l'obligation. */
  exigee: boolean;
};

/**
 * La vérification est-elle exigée ?
 *
 * Le réglage existait dans l'écran d'administration et ne pilotait rien. Il
 * pilote désormais les deux portes — mais **son absence vaut « exigée »**, et
 * non l'inverse. Une plateforme qui laisserait passer tout le monde parce
 * qu'une ligne manque en base serait ouverte par accident, ce qui est la pire
 * façon de l'être : personne ne s'en apercevrait.
 */
async function verificationExigee(): Promise<boolean> {
  const reglages = await lireParametres();
  return reglages.verificationObligatoire !== "false";
}

/** Le dossier d'un compte, tel qu'il doit être montré et appliqué. */
export async function dossierDe(
  utilisateurId: string,
): Promise<DossierVerification | null> {
  const [ligne] = await db
    .select({
      emailVerifie: utilisateur.emailVerifie,
      identiteStatut: utilisateur.identiteStatut,
      permisStatut: utilisateur.permisStatut,
      permisExpireLe: utilisateur.permisExpireLe,
      profilLocataire: utilisateur.profilLocataire,
      profilProprietaire: utilisateur.profilProprietaire,
    })
    .from(utilisateur)
    .where(eq(utilisateur.id, utilisateurId))
    .limit(1);

  if (!ligne) return null;

  const etat: EtatVerification = {
    emailVerifie: ligne.emailVerifie,
    identiteStatut: ligne.identiteStatut as StatutVerification,
    permisStatut: ligne.permisStatut as StatutVerification,
    permisExpireLe: ligne.permisExpireLe,
  };

  const requises = piecesRequises(ligne);

  return {
    etat,
    requises,
    manquesPublication: manquesPourPublier(etat),
    manquesReservation: manquesPourReserver(etat, new Date()),
    avancement: avancement(etat, requises),
    exigee: await verificationExigee(),
  };
}

/**
 * Le compte peut-il publier ?
 *
 * Rend la liste des manques plutôt qu'un booléen : la porte du serveur doit
 * pouvoir dire *pourquoi* elle refuse, sans quoi l'intéressé se retrouve
 * devant un mur sans poignée.
 */
export async function blocagePublication(
  utilisateurId: string,
): Promise<Manque[]> {
  const dossier = await dossierDe(utilisateurId);
  if (!dossier || !dossier.exigee) return [];
  return dossier.manquesPublication;
}

/** Le compte peut-il demander une location ? */
export async function blocageReservation(
  utilisateurId: string,
): Promise<Manque[]> {
  const dossier = await dossierDe(utilisateurId);
  if (!dossier || !dossier.exigee) return [];
  return dossier.manquesReservation;
}

export type PieceDeposee = {
  id: string;
  type: Piece;
  face: "recto" | "verso";
  statut: "en_attente" | "acceptee" | "refusee";
  motif: string | null;
  deposeeLe: Date;
};

/**
 * Les pièces déposées par un compte.
 *
 * Les refusées sont conservées et rendues : leur motif est la seule chose qui
 * dise à l'intéressé quoi reprendre. Les masquer laisserait un dossier bloqué
 * sans explication visible.
 */
export async function piecesDe(
  utilisateurId: string,
): Promise<PieceDeposee[]> {
  const lignes = await db
    .select({
      id: pieceVerification.id,
      type: pieceVerification.type,
      face: pieceVerification.face,
      statut: pieceVerification.statut,
      motif: pieceVerification.motif,
      deposeeLe: pieceVerification.creeLe,
    })
    .from(pieceVerification)
    .where(eq(pieceVerification.utilisateurId, utilisateurId))
    .orderBy(desc(pieceVerification.creeLe));

  return lignes as PieceDeposee[];
}

/**
 * Qui a le droit de lire les octets d'une pièce.
 *
 * Deux réponses seulement : son déposant, et un contrôleur. Pas le
 * propriétaire d'une annonce que l'intéressé veut louer, pas le support
 * généraliste — une carte d'identité n'est pas une information de service
 * client.
 */
export async function pieceLisiblePar(
  pieceId: string,
  demandeur: { id: string; role: string | null },
): Promise<{ chemin: string; typeMime: string } | null> {
  const [ligne] = await db
    .select({
      chemin: pieceVerification.chemin,
      typeMime: pieceVerification.typeMime,
      utilisateurId: pieceVerification.utilisateurId,
    })
    .from(pieceVerification)
    .where(eq(pieceVerification.id, pieceId))
    .limit(1);

  if (!ligne) return null;

  const controleur =
    demandeur.role === "moderateur" ||
    demandeur.role === "super_administrateur";

  if (ligne.utilisateurId !== demandeur.id && !controleur) return null;

  return { chemin: ligne.chemin, typeMime: ligne.typeMime };
}

export type DossierEnAttente = {
  utilisateurId: string;
  email: string;
  prenom: string | null;
  nom: string | null;
  pieces: {
    id: string;
    type: Piece;
    face: "recto" | "verso";
    deposeeLe: Date;
  }[];
};

/**
 * La file de contrôle, groupée par compte.
 *
 * Groupée, et non pièce par pièce : on ne décide pas d'un recto sans avoir vu
 * le verso, et un contrôleur qui traite une file de faces isolées prend deux
 * fois la même décision sur le même dossier.
 */
export async function dossiersEnAttente(
  limite = 50,
): Promise<DossierEnAttente[]> {
  const lignes = await db
    .select({
      pieceId: pieceVerification.id,
      type: pieceVerification.type,
      face: pieceVerification.face,
      deposeeLe: pieceVerification.creeLe,
      utilisateurId: utilisateur.id,
      email: utilisateur.email,
      prenom: utilisateur.prenom,
      nom: utilisateur.nom,
    })
    .from(pieceVerification)
    .innerJoin(utilisateur, eq(utilisateur.id, pieceVerification.utilisateurId))
    .where(eq(pieceVerification.statut, "en_attente"))
    .orderBy(pieceVerification.creeLe)
    .limit(limite);

  const parCompte = new Map<string, DossierEnAttente>();

  for (const ligne of lignes) {
    const existant = parCompte.get(ligne.utilisateurId) ?? {
      utilisateurId: ligne.utilisateurId,
      email: ligne.email,
      prenom: ligne.prenom,
      nom: ligne.nom,
      pieces: [],
    };

    existant.pieces.push({
      id: ligne.pieceId,
      type: ligne.type as Piece,
      face: ligne.face,
      deposeeLe: ligne.deposeeLe,
    });

    parCompte.set(ligne.utilisateurId, existant);
  }

  return [...parCompte.values()];
}

/** Nombre de dossiers en attente, pour la pastille de la navigation. */
export async function nombreEnAttente(): Promise<number> {
  const lignes = await db
    .selectDistinct({ utilisateurId: pieceVerification.utilisateurId })
    .from(pieceVerification)
    .where(eq(pieceVerification.statut, "en_attente"));

  return lignes.length;
}

/** Les pièces d'un compte pour un type donné, dans l'ordre de dépôt. */
export async function piecesDuType(
  utilisateurId: string,
  type: Piece,
): Promise<{ id: string; face: string; statut: string }[]> {
  return db
    .select({
      id: pieceVerification.id,
      face: pieceVerification.face,
      statut: pieceVerification.statut,
    })
    .from(pieceVerification)
    .where(
      and(
        eq(pieceVerification.utilisateurId, utilisateurId),
        eq(pieceVerification.type, type),
        inArray(pieceVerification.statut, ["en_attente", "acceptee"]),
      ),
    );
}
