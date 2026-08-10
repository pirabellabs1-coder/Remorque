import "server-only";

import { and, eq, sql as raw } from "drizzle-orm";

import { CATEGORIES, type SlugCategorie } from "@/config/categories";
import { trouverVille } from "@/config/villes";
import { db } from "@/server/db";
import {
  annonce as tableAnnonce,
  annoncePhoto,
  categorie as tableCategorie,
  pays as tablePays,
  tarif,
  utilisateur,
} from "@/server/db/schema";

import { type AnnonceDetail, type AnnonceResume, trouverAnnonce } from "./catalogue";
import { chercher, versResume } from "./requetes";

/**
 * Dépôt des annonces — écritures et lectures de l'espace loueur.
 *
 * Il écrivait dans un tableau porté par `globalThis`, ce qui avait deux
 * conséquences que le passage en base supprime : une annonce publiée
 * disparaissait au redémarrage du serveur, et — plus grave depuis que le
 * catalogue public lit PostgreSQL — elle n'apparaissait nulle part côté
 * visiteur. Publier remplissait une mémoire que plus personne ne lisait.
 *
 * Deux tests l'ont attrapé : ils vérifient précisément qu'une annonce publiée
 * devient visible dans le catalogue public, et qu'une annonce supprimée en
 * disparaît. C'est exactement ce que ces tests existent pour empêcher.
 */

export type BrouillonAnnonce = {
  titre: string;
  categorie: SlugCategorie;
  villeSlug: string;
  description: string;
  /** Prix par jour, en centimes. */
  prixJour: number;
  caution: number;
  ptacKg: number;
  poidsVideKg: number;
  longueurUtileMm: number;
  largeurUtileMm: number;
  freinee: boolean;
  reservationInstantanee: boolean;
  equipements: string[];
  politiqueAnnulation: "souple" | "moderee" | "stricte";
};

export function slugifier(valeur: string): string {
  return valeur
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Rend le slug unique dans la ville.
 *
 * L'unicité est de toute façon garantie par l'index `annonce_slug_unique` :
 * cette fonction évite d'aller heurter la contrainte, elle ne la remplace pas.
 * Deux « benne 750 kg » à Bruxelles donnent donc `benne-750-kg` et
 * `benne-750-kg-2`.
 */
export async function slugDisponible(
  villeSlug: string,
  base: string,
): Promise<string> {
  const existants = new Set(
    (
      await db
        .select({ slug: tableAnnonce.slug })
        .from(tableAnnonce)
        .where(eq(tableAnnonce.villeSlug, villeSlug))
    ).map((ligne) => ligne.slug),
  );

  if (!existants.has(base)) return base;
  let suffixe = 2;
  while (existants.has(`${base}-${suffixe}`)) suffixe += 1;
  return `${base}-${suffixe}`;
}

const altDe = (slug: string) =>
  CATEGORIES.find((entree) => entree.slug === slug)?.alt ?? "";

/** Toutes les annonces publiées, en résumé. */
export async function listerAnnonces(): Promise<AnnonceResume[]> {
  const lignes = await chercher({ tri: "note" });
  return lignes.map((ligne) => versResume(ligne, altDe(ligne.categorie)));
}

/**
 * Annonces avec leur propriétaire et leur caution.
 *
 * L'administration a besoin de savoir *chez qui* une annonce est publiée et
 * quelle caution elle exige — deux informations que le résumé public n'expose
 * pas, et qui n'ont rien à faire dans une carte de recherche.
 */
export async function listerAnnoncesDetaillees() {
  const resumes = await listerAnnonces();

  // Une seule requête pour les cautions et les propriétaires, et non une par
  // annonce. La première version appelait `trouverAnnonce` dans une boucle :
  // huit annonces produisaient huit allers-retours, et le millième en
  // produirait mille. C'est le défaut classique dit « N+1 », qui ne se voit
  // pas sur un jeu d'essai et écroule la production.
  const complements = new Map(
    (
      await db
        .select({
          id: tableAnnonce.id,
          caution: tableAnnonce.caution,
          prenom: utilisateur.prenom,
          professionnel: raw<boolean>`${utilisateur.typeCompte} = 'professionnel'`,
        })
        .from(tableAnnonce)
        .innerJoin(utilisateur, eq(utilisateur.id, tableAnnonce.proprietaireId))
    ).map((ligne) => [ligne.id, ligne]),
  );

  return resumes.map((resume) => {
    const complement = complements.get(resume.id);
    return {
      ...resume,
      caution: complement?.caution ?? 0,
      proprietaire: complement
        ? { prenom: complement.prenom ?? "", professionnel: complement.professionnel }
        : undefined,
    };
  });
}

export async function trouverParSlug(
  villeSlug: string,
  slug: string,
): Promise<AnnonceDetail | null> {
  return trouverAnnonce(villeSlug, slug);
}

/**
 * Compte propriétaire par défaut, en attendant la session.
 *
 * Il est créé au besoin plutôt que supposé : sans lui, l'insertion échouerait
 * sur la clé étrangère, et le message d'erreur ne dirait pas pourquoi.
 */
async function proprietaireParDefaut(paysId: string): Promise<string> {
  const email = "moi@demonstration.flexitrailer.eu";

  const [existant] = await db
    .select({ id: utilisateur.id })
    .from(utilisateur)
    .where(eq(utilisateur.email, email))
    .limit(1);

  if (existant) return existant.id;

  const [cree] = await db
    .insert(utilisateur)
    .values({
      email,
      emailVerifie: true,
      prenom: "Vous",
      typeCompte: "particulier",
      paysId,
      langue: "fr",
      profilProprietaire: true,
      identiteStatut: "verifie",
    })
    .returning({ id: utilisateur.id });

  return cree.id;
}

export async function ajouterAnnonce(
  brouillon: BrouillonAnnonce,
): Promise<AnnonceDetail> {
  const ville = trouverVille(brouillon.villeSlug);
  if (!ville) throw new Error(`Ville inconnue : ${brouillon.villeSlug}`);

  const categorieChoisie = CATEGORIES.find(
    (entree) => entree.slug === brouillon.categorie,
  );
  if (!categorieChoisie) {
    throw new Error(`Catégorie inconnue : ${brouillon.categorie}`);
  }

  const [paysLigne] = await db
    .select({ id: tablePays.id, devise: tablePays.devise })
    .from(tablePays)
    .where(eq(tablePays.code, ville.pays))
    .limit(1);

  if (!paysLigne) {
    throw new Error(
      `Pays absent de la base : ${ville.pays}. Lancez « npm run db:demo ».`,
    );
  }

  const [categorieLigne] = await db
    .select({ id: tableCategorie.id })
    .from(tableCategorie)
    .where(eq(tableCategorie.slug, brouillon.categorie))
    .limit(1);

  if (!categorieLigne) {
    throw new Error(
      `Catégorie absente de la base : ${brouillon.categorie}. Lancez « npm run db:seed ».`,
    );
  }

  const proprietaireId = await proprietaireParDefaut(paysLigne.id);
  const slug = await slugDisponible(ville.slug, slugifier(brouillon.titre));

  const [creee] = await db
    .insert(tableAnnonce)
    .values({
      proprietaireId,
      categorieId: categorieLigne.id,
      paysId: paysLigne.id,
      titre: brouillon.titre,
      description: brouillon.description,
      slug,
      statut: "publiee",
      etapePublication: 6,
      ptacKg: brouillon.ptacKg,
      poidsVideKg: brouillon.poidsVideKg,
      // La charge utile est dérivée, jamais saisie : c'est le PTAC moins le
      // poids à vide. La demander au propriétaire serait lui laisser
      // l'occasion de la contredire.
      chargeUtileKg: brouillon.ptacKg - brouillon.poidsVideKg,
      longueurUtileMm: brouillon.longueurUtileMm,
      largeurUtileMm: brouillon.largeurUtileMm,
      freinee: brouillon.freinee,
      typeAttelage: "Boule Ø 50 mm",
      faisceauBroches: 13,
      equipements: brouillon.equipements,
      caracteristiques: { quartier: ville.province },
      ville: ville.nom,
      villeSlug: ville.slug,
      // Sans géocodage de l'adresse, la position est le centre de la commune.
      // C'est exact au rayon d'imprécision près, qui est de toute façon tout
      // ce que le public voit avant confirmation.
      position: { longitude: ville.longitude, latitude: ville.latitude },
      reservationInstantanee: brouillon.reservationInstantanee,
      politiqueAnnulation: brouillon.politiqueAnnulation,
      devise: paysLigne.devise,
      caution: brouillon.caution,
      publieeLe: new Date(),
    })
    .returning({ id: tableAnnonce.id });

  await db.insert(annoncePhoto).values({
    annonceId: creee.id,
    url: categorieChoisie.photo,
    ordre: 0,
  });

  await db.insert(tarif).values({
    annonceId: creee.id,
    prixJour: brouillon.prixJour,
  });

  const detail = await trouverAnnonce(ville.slug, slug);
  if (!detail) {
    throw new Error("L'annonce vient d'être créée mais reste introuvable.");
  }
  return detail;
}

/**
 * Supprime une annonce.
 *
 * Photos et tarifs partent en cascade. Une annonce qui porte des réservations
 * ne peut pas être supprimée — la clé étrangère l'interdit, et c'est voulu :
 * l'effacer effacerait l'historique des locations qui s'y rattachent. Le geste
 * attendu dans ce cas est l'archivage, non la suppression.
 */
export async function supprimerAnnonce(id: string): Promise<boolean> {
  const supprimees = await db
    .delete(tableAnnonce)
    .where(eq(tableAnnonce.id, id))
    .returning({ id: tableAnnonce.id });

  return supprimees.length > 0;
}

/** Nombre d'annonces publiées. */
export async function compterAnnonces(): Promise<number> {
  const [ligne] = await db
    .select({ nombre: raw<number>`count(*)::int` })
    .from(tableAnnonce)
    .where(and(eq(tableAnnonce.statut, "publiee")));

  return ligne?.nombre ?? 0;
}
