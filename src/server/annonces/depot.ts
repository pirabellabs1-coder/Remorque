import "server-only";

import { CATEGORIES, type SlugCategorie } from "@/config/categories";
import { trouverVille } from "@/config/villes";

import { JEU_DE_DEMONSTRATION, type AnnonceDetail } from "./catalogue";

/**
 * Dépôt des annonces.
 *
 * Une seule porte d'entrée pour lire et écrire le catalogue, quel que soit le
 * support. Aujourd'hui les annonces vivent en mémoire du serveur ; demain elles
 * viendront de PostgreSQL. Les écrans et les actions ne connaissent que cette
 * interface : brancher la base ne demandera qu'une seconde implémentation, pas
 * une reprise de l'espace loueur.
 *
 * ⚠ La mémoire ne survit pas au redémarrage du serveur. C'est suffisant pour
 * concevoir et recetter un parcours de bout en bout — publier une annonce et
 * la voir apparaître dans le catalogue public — et c'est délibérément
 * insuffisant pour la production, que le garde-fou de `catalogue.ts` protège
 * déjà.
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

/**
 * Le stock est porté par `globalThis` : en développement, Next.js recharge les
 * modules à chaque modification, et une simple variable de module repartirait
 * de zéro à la première sauvegarde de fichier.
 */
const global_ = globalThis as unknown as {
  __flexitrailerAnnonces?: AnnonceDetail[];
};

function stock(): AnnonceDetail[] {
  global_.__flexitrailerAnnonces ??= [...JEU_DE_DEMONSTRATION];
  return global_.__flexitrailerAnnonces;
}

function slugifier(valeur: string): string {
  return valeur
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Rend le slug unique dans la ville : deux « benne 750 kg » à Bruxelles. */
function slugDisponible(villeSlug: string, base: string): string {
  const existants = new Set(
    stock()
      .filter((annonce) => annonce.villeSlug === villeSlug)
      .map((annonce) => annonce.slug),
  );

  if (!existants.has(base)) return base;
  let suffixe = 2;
  while (existants.has(`${base}-${suffixe}`)) suffixe += 1;
  return `${base}-${suffixe}`;
}

export function listerAnnonces(): AnnonceDetail[] {
  return stock();
}

export function annoncesDuProprietaire(): AnnonceDetail[] {
  // Tant que l'authentification n'est pas branchée, le loueur voit tout le
  // catalogue. Le filtre sur l'identifiant du propriétaire viendra avec la
  // session — c'est une ligne, à l'endroit prévu.
  return stock();
}

export function trouverParSlug(
  villeSlug: string,
  slug: string,
): AnnonceDetail | undefined {
  return stock().find(
    (annonce) => annonce.villeSlug === villeSlug && annonce.slug === slug,
  );
}

export function ajouterAnnonce(brouillon: BrouillonAnnonce): AnnonceDetail {
  const ville = trouverVille(brouillon.villeSlug);
  if (!ville) throw new Error(`Ville inconnue : ${brouillon.villeSlug}`);

  const categorie = CATEGORIES.find(
    (entree) => entree.slug === brouillon.categorie,
  );
  if (!categorie) throw new Error(`Catégorie inconnue : ${brouillon.categorie}`);

  const annonce: AnnonceDetail = {
    id: `a${Date.now().toString(36)}`,
    slug: slugDisponible(ville.slug, slugifier(brouillon.titre)),
    titre: brouillon.titre,
    categorie: brouillon.categorie,
    ville: ville.nom,
    villeSlug: ville.slug,
    quartier: ville.province,
    // Sans géocodage ni point de recherche, la distance n'a pas de sens : on
    // ne l'invente pas, on la met à zéro et la fiche ne l'affiche pas.
    distanceM: 0,
    prixJour: brouillon.prixJour,
    devise: "EUR",
    photo: categorie.photo,
    photoAlt: categorie.alt,
    // Une annonce neuve n'a ni note ni avis. Zéro serait faux : c'est
    // « pas encore noté », et l'interface doit pouvoir les distinguer.
    note: null,
    nombreAvis: 0,
    reservationInstantanee: brouillon.reservationInstantanee,
    ptacKg: brouillon.ptacKg,
    poidsVideKg: brouillon.poidsVideKg,
    chargeUtileKg: brouillon.ptacKg - brouillon.poidsVideKg,
    longueurUtileMm: brouillon.longueurUtileMm,
    largeurUtileMm: brouillon.largeurUtileMm,
    hauteurUtileMm: null,
    freinee: brouillon.freinee,
    typeAttelage: "Boule Ø 50 mm",
    faisceauBroches: 13,
    caution: brouillon.caution,
    equipements: brouillon.equipements,
    politiqueAnnulation: brouillon.politiqueAnnulation,
    description: brouillon.description,
    proprietaire: {
      prenom: "Vous",
      depuis: String(new Date().getFullYear()),
      tauxReponse: 100,
      professionnel: false,
    },
  };

  // En tête de liste : ce que l'on vient de publier doit se voir sans chercher.
  stock().unshift(annonce);
  return annonce;
}

export function supprimerAnnonce(id: string): boolean {
  const liste = stock();
  const index = liste.findIndex((annonce) => annonce.id === id);
  if (index === -1) return false;
  liste.splice(index, 1);
  return true;
}
