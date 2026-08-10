"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { CATEGORIES } from "@/config/categories";
import { VILLES } from "@/config/villes";
import type { Market } from "@/config/markets";
import { rangDe } from "@/domain/annonce/publication";
import { redirect } from "@/i18n/navigation";
import { compteConnecte } from "@/server/authentification/session";

import {
  ajouterPhotos,
  deplacerPhoto,
  retirerPhoto,
} from "./photos";
import {
  creerBrouillon,
  enregistrerCaracteristiques,
  enregistrerMateriel,
  enregistrerRetrait,
  enregistrerTarifs,
  publierBrouillon,
} from "./publication";

/**
 * Actions de l'assistant de publication.
 *
 * Chaque étape est un formulaire ordinaire qui renvoie vers l'étape suivante,
 * ou revient sur elle-même avec `?erreur=` quand la saisie ne passe pas. Ce
 * choix n'est pas de la nostalgie : il rend les six écrans utilisables sans
 * une ligne de JavaScript, ce qui compte quand l'état des lieux et la mise en
 * ligne se font depuis une cour, sur un réseau qui va et vient. Seule l'étape
 * des photos a besoin du navigateur, et elle le dit.
 *
 * La validation est refaite ici, côté serveur, même si le formulaire la fait
 * déjà : une action serveur est une adresse publique, et `required` en HTML se
 * contourne en trois secondes.
 *
 * Les montants arrivent en euros — c'est ce que saisit un humain — et sont
 * convertis en centimes à cette frontière. Aucun euro flottant ne la franchit.
 */

const SLUGS_CATEGORIES = CATEGORIES.map((entree) => entree.slug) as [
  string,
  ...string[],
];
const SLUGS_VILLES = VILLES.map((ville) => ville.slug) as [string, ...string[]];

/** L'adresse d'une étape de l'assistant, avec ses paramètres. */
function adresseEtape(
  locale: string,
  query: Record<string, string>,
): never {
  redirect({
    href: { pathname: "/proprietaire/annonces/publier", query },
    locale: locale as Market,
  });
  // `redirect` lève : cette ligne n'est jamais atteinte, elle rassure le
  // vérificateur de types.
  throw new Error("inatteignable");
}

/**
 * Sortie vers la liste des annonces, brouillon conservé.
 *
 * Chaque étape enregistre avant de rediriger : s'arrêter ne perd donc jamais
 * ce qui vient d'être saisi. Le bouton n'existe que pour dire *où l'on va* —
 * sans lui, quitter l'assistant demandait de deviner qu'on pouvait fermer
 * l'onglet sans rien perdre.
 */
function adresseListe(locale: string): never {
  redirect({
    href: "/proprietaire/annonces",
    locale: locale as Market,
  });
  throw new Error("inatteignable");
}

/** L'usager a-t-il demandé à s'arrêter là plutôt qu'à continuer ? */
const finirPlusTard = (donnees: FormData) => donnees.get("finir") === "oui";

/** Le compte connecté, ou retour à l'accueil de l'espace. */
async function exigerCompte(locale: string): Promise<string> {
  const compte = await compteConnecte();

  if (!compte?.profilProprietaire) {
    redirect({ href: "/proprietaire", locale: locale as Market });
    throw new Error("inatteignable");
  }

  return compte.id;
}

const nombre = (valeur: FormDataEntryValue | null) =>
  valeur === null || valeur === "" ? undefined : Number(valeur);

const coche = (valeur: FormDataEntryValue | null) => valeur === "on";

/* -------------------------------------------------------------------------- */
/*  Étape 1 — la catégorie                                                     */
/* -------------------------------------------------------------------------- */

export async function choisirCategorie(donnees: FormData): Promise<void> {
  const locale = String(donnees.get("locale") ?? "");
  await exigerCompte(locale);

  const analyse = z.enum(SLUGS_CATEGORIES).safeParse(donnees.get("categorie"));

  if (!analyse.success) {
    adresseEtape(locale, { etape: "1", erreur: "categorie" });
  }

  adresseEtape(locale, { etape: "2", categorie: analyse.data });
}

/* -------------------------------------------------------------------------- */
/*  Étape 2 — le matériel                                                      */
/* -------------------------------------------------------------------------- */

const schemaMateriel = z.object({
  titre: z.string().trim().min(5).max(80),
  description: z.string().trim().min(20).max(2000),
  villeSlug: z.enum(SLUGS_VILLES),
});

export async function enregistrerEtapeMateriel(
  donnees: FormData,
): Promise<void> {
  const locale = String(donnees.get("locale") ?? "");
  const proprietaireId = await exigerCompte(locale);

  const annonceId = String(donnees.get("annonce") ?? "");
  const categorie = String(donnees.get("categorie") ?? "");

  const analyse = schemaMateriel.safeParse({
    titre: donnees.get("titre"),
    description: donnees.get("description"),
    villeSlug: donnees.get("villeSlug"),
  });

  if (!analyse.success) {
    adresseEtape(locale, {
      etape: "2",
      erreur: analyse.error.issues[0].path.join("."),
      ...(annonceId ? { annonce: annonceId } : { categorie }),
    });
  }

  // Première venue : la ligne n'existe pas encore. C'est ici qu'elle naît, et
  // non à l'étape de la catégorie — voir `creerBrouillon` pour la raison.
  if (!annonceId) {
    const categorieAnalysee = z.enum(SLUGS_CATEGORIES).safeParse(categorie);
    if (!categorieAnalysee.success) {
      adresseEtape(locale, { etape: "1", erreur: "categorie" });
    }

    const cree = await creerBrouillon(proprietaireId, {
      categorie: categorieAnalysee.data as never,
      ...analyse.data,
    });

    if (finirPlusTard(donnees)) adresseListe(locale);
    adresseEtape(locale, { etape: "3", annonce: cree });
  }

  const enregistre = await enregistrerMateriel(
    annonceId,
    proprietaireId,
    analyse.data,
  );

  if (!enregistre) adresseEtape(locale, { etape: "1", erreur: "introuvable" });

  if (finirPlusTard(donnees)) adresseListe(locale);
  adresseEtape(locale, { etape: "3", annonce: annonceId });
}

/* -------------------------------------------------------------------------- */
/*  Étape 3 — les caractéristiques                                             */
/* -------------------------------------------------------------------------- */

const schemaCaracteristiques = z
  .object({
    ptacKg: z.number().int().min(100).max(3500),
    poidsVideKg: z.number().int().min(20).max(3400),
    longueurUtileMm: z.number().int().min(500).max(10000),
    largeurUtileMm: z.number().int().min(500).max(3000),
    hauteurUtileMm: z.number().int().min(100).max(3000).optional(),
    nombreEssieux: z.number().int().min(1).max(3),
    typeAttelage: z.string().trim().min(3).max(60),
    faisceauBroches: z.number().int().refine((valeur) => valeur === 7 || valeur === 13),
    adaptateurFourni: z.boolean(),
    freinee: z.boolean(),
    equipements: z.string().optional(),
  })
  // La charge utile est dérivée du PTAC moins le poids à vide : un poids à vide
  // supérieur donnerait une charge utile négative, c'est-à-dire une annonce qui
  // affiche une impossibilité physique.
  .refine((valeurs) => valeurs.poidsVideKg < valeurs.ptacKg, {
    path: ["poidsVideKg"],
  });

export async function enregistrerEtapeCaracteristiques(
  donnees: FormData,
): Promise<void> {
  const locale = String(donnees.get("locale") ?? "");
  const proprietaireId = await exigerCompte(locale);
  const annonceId = String(donnees.get("annonce") ?? "");

  const analyse = schemaCaracteristiques.safeParse({
    ptacKg: nombre(donnees.get("ptacKg")),
    poidsVideKg: nombre(donnees.get("poidsVideKg")),
    longueurUtileMm: nombre(donnees.get("longueurUtileMm")),
    largeurUtileMm: nombre(donnees.get("largeurUtileMm")),
    hauteurUtileMm: nombre(donnees.get("hauteurUtileMm")),
    nombreEssieux: nombre(donnees.get("nombreEssieux")),
    typeAttelage: donnees.get("typeAttelage"),
    faisceauBroches: nombre(donnees.get("faisceauBroches")),
    adaptateurFourni: coche(donnees.get("adaptateurFourni")),
    freinee: coche(donnees.get("freinee")),
    equipements: donnees.get("equipements"),
  });

  if (!analyse.success) {
    adresseEtape(locale, {
      etape: "3",
      annonce: annonceId,
      erreur: analyse.error.issues[0].path.join("."),
    });
  }

  const valeurs = analyse.data;

  const enregistre = await enregistrerCaracteristiques(annonceId, proprietaireId, {
    ...valeurs,
    hauteurUtileMm: valeurs.hauteurUtileMm ?? null,
    equipements: (valeurs.equipements ?? "")
      .split(",")
      .map((element) => element.trim())
      .filter(Boolean),
  });

  if (!enregistre) adresseEtape(locale, { etape: "1", erreur: "introuvable" });

  if (finirPlusTard(donnees)) adresseListe(locale);
  adresseEtape(locale, { etape: "4", annonce: annonceId });
}

/* -------------------------------------------------------------------------- */
/*  Étape 4 — les photos                                                       */
/* -------------------------------------------------------------------------- */

export type EtatDepot =
  | { statut: "inactif" }
  | { statut: "fait"; deposees: number; refus: string[] };

export async function deposerPhotos(
  _precedent: EtatDepot,
  donnees: FormData,
): Promise<EtatDepot> {
  const locale = String(donnees.get("locale") ?? "");
  const proprietaireId = await exigerCompte(locale);
  const annonceId = String(donnees.get("annonce") ?? "");

  const fichiers = donnees
    .getAll("photos")
    .filter((entree): entree is File => entree instanceof File && entree.size > 0);

  if (fichiers.length === 0) return { statut: "inactif" };

  // Le navigateur mesure les images pendant qu'il les réduit ; les redemander
  // au serveur imposerait de décoder chaque fichier une seconde fois.
  const mesures = donnees
    .getAll("dimensions")
    .map((valeur) => {
      const [largeur, hauteur] = String(valeur).split("x").map(Number);
      return { largeur, hauteur };
    })
    .filter((mesure) => Number.isFinite(mesure.largeur));

  const bilan = await ajouterPhotos(
    annonceId,
    proprietaireId,
    fichiers,
    mesures,
  );

  revalidatePath("/proprietaire/annonces/publier", "page");

  return {
    statut: "fait",
    deposees: bilan.deposees,
    // Les refus se répètent quand plusieurs fichiers échouent pour la même
    // raison : une seule mention par motif suffit à l'expliquer.
    refus: [...new Set(bilan.refus)],
  };
}

export async function supprimerPhoto(donnees: FormData): Promise<void> {
  const locale = String(donnees.get("locale") ?? "");
  const proprietaireId = await exigerCompte(locale);

  await retirerPhoto(String(donnees.get("photo") ?? ""), proprietaireId);

  adresseEtape(locale, {
    etape: "4",
    annonce: String(donnees.get("annonce") ?? ""),
  });
}

export async function deplacerPhotoAction(donnees: FormData): Promise<void> {
  const locale = String(donnees.get("locale") ?? "");
  const proprietaireId = await exigerCompte(locale);

  const sens = donnees.get("sens") === "avant" ? "avant" : "apres";
  await deplacerPhoto(String(donnees.get("photo") ?? ""), proprietaireId, sens);

  adresseEtape(locale, {
    etape: "4",
    annonce: String(donnees.get("annonce") ?? ""),
  });
}

/** Passe de l'étape des photos à la suivante, une fois le minimum atteint. */
export async function validerEtapePhotos(donnees: FormData): Promise<void> {
  const locale = String(donnees.get("locale") ?? "");
  await exigerCompte(locale);

  adresseEtape(locale, {
    etape: "5",
    annonce: String(donnees.get("annonce") ?? ""),
  });
}

/* -------------------------------------------------------------------------- */
/*  Étape 5 — le retrait                                                       */
/* -------------------------------------------------------------------------- */

const schemaRetrait = z.object({
  adresseLigne1: z.string().trim().min(4).max(120),
  codePostal: z.string().trim().min(4).max(10),
  rayonApproximatifM: z.number().int().min(200).max(5000),
  reglesUtilisation: z.string().trim().max(1000).optional(),
});

export async function enregistrerEtapeRetrait(
  donnees: FormData,
): Promise<void> {
  const locale = String(donnees.get("locale") ?? "");
  const proprietaireId = await exigerCompte(locale);
  const annonceId = String(donnees.get("annonce") ?? "");

  const analyse = schemaRetrait.safeParse({
    adresseLigne1: donnees.get("adresseLigne1"),
    codePostal: donnees.get("codePostal"),
    rayonApproximatifM: nombre(donnees.get("rayonApproximatifM")),
    reglesUtilisation: donnees.get("reglesUtilisation") || undefined,
  });

  if (!analyse.success) {
    adresseEtape(locale, {
      etape: "5",
      annonce: annonceId,
      erreur: analyse.error.issues[0].path.join("."),
    });
  }

  const enregistre = await enregistrerRetrait(annonceId, proprietaireId, {
    ...analyse.data,
    reglesUtilisation: analyse.data.reglesUtilisation ?? null,
  });

  if (!enregistre) adresseEtape(locale, { etape: "1", erreur: "introuvable" });

  if (finirPlusTard(donnees)) adresseListe(locale);
  adresseEtape(locale, { etape: "6", annonce: annonceId });
}

/* -------------------------------------------------------------------------- */
/*  Étape 6 — tarifs, conditions et publication                                */
/* -------------------------------------------------------------------------- */

const schemaTarifs = z
  .object({
    prixJourEuros: z.number().min(1).max(2000),
    cautionEuros: z.number().min(0).max(5000),
    politiqueAnnulation: z.enum(["souple", "moderee", "stricte"]),
    dureeMinimumJours: z.number().int().min(1).max(30),
    dureeMaximumJours: z.number().int().min(1).max(90),
    delaiPreparationHeures: z.number().int().min(0).max(72),
    reservationInstantanee: z.boolean(),
  })
  .refine((valeurs) => valeurs.dureeMinimumJours <= valeurs.dureeMaximumJours, {
    path: ["dureeMaximumJours"],
  });

export async function enregistrerEtapeTarifs(donnees: FormData): Promise<void> {
  const locale = String(donnees.get("locale") ?? "");
  const proprietaireId = await exigerCompte(locale);
  const annonceId = String(donnees.get("annonce") ?? "");

  const analyse = schemaTarifs.safeParse({
    prixJourEuros: nombre(donnees.get("prixJourEuros")),
    cautionEuros: nombre(donnees.get("cautionEuros")),
    politiqueAnnulation: donnees.get("politiqueAnnulation"),
    dureeMinimumJours: nombre(donnees.get("dureeMinimumJours")),
    dureeMaximumJours: nombre(donnees.get("dureeMaximumJours")),
    delaiPreparationHeures: nombre(donnees.get("delaiPreparationHeures")),
    reservationInstantanee: coche(donnees.get("reservationInstantanee")),
  });

  if (!analyse.success) {
    adresseEtape(locale, {
      etape: "6",
      annonce: annonceId,
      erreur: analyse.error.issues[0].path.join("."),
    });
  }

  const valeurs = analyse.data;

  const enregistre = await enregistrerTarifs(annonceId, proprietaireId, {
    prixJour: Math.round(valeurs.prixJourEuros * 100),
    caution: Math.round(valeurs.cautionEuros * 100),
    politiqueAnnulation: valeurs.politiqueAnnulation,
    dureeMinimumJours: valeurs.dureeMinimumJours,
    dureeMaximumJours: valeurs.dureeMaximumJours,
    delaiPreparationHeures: valeurs.delaiPreparationHeures,
    reservationInstantanee: valeurs.reservationInstantanee,
  });

  if (!enregistre) adresseEtape(locale, { etape: "1", erreur: "introuvable" });

  // Le bouton « Publier » et le bouton « Enregistrer » postent le même
  // formulaire : le second permet de s'arrêter là et de revenir plus tard.
  if (donnees.get("publier") !== "oui") {
    adresseEtape(locale, { etape: "6", annonce: annonceId, enregistre: "oui" });
  }

  const resultat = await publierBrouillon(annonceId, proprietaireId);

  if (resultat.statut === "introuvable") {
    adresseEtape(locale, { etape: "1", erreur: "introuvable" });
  }

  if (resultat.statut === "incomplete") {
    adresseEtape(locale, {
      etape: String(rangDe(resultat.etape)),
      annonce: annonceId,
      erreur: "incomplete",
    });
  }

  // L'annonce doit apparaître immédiatement partout où le catalogue est lu :
  // accueil, recherche, page de la ville, fiche. Sans cette invalidation, les
  // pages pré-générées continueraient de servir l'ancien catalogue.
  revalidatePath("/", "layout");

  redirect({
    href: {
      pathname: "/remorque/[ville]/[slug]",
      params: { ville: resultat.villeSlug, slug: resultat.slug },
    },
    locale: locale as Market,
  });
}
