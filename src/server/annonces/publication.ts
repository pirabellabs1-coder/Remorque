import "server-only";

import { and, desc, eq, ne, sql as raw } from "drizzle-orm";

import { CATEGORIES, type SlugCategorie } from "@/config/categories";
import { trouverVille } from "@/config/villes";
import {
  type BornesCaution,
  type Etape,
  type EtatAnnonce,
  premiereEtapeIncomplete,
  pretePourPublication,
  rangDe,
} from "@/domain/annonce/publication";
import { db } from "@/server/db";
import {
  annonce as tableAnnonce,
  annoncePhoto,
  categorie as tableCategorie,
  pays as tablePays,
  tarif,
} from "@/server/db/schema";

import { slugDisponible, slugifier } from "./depot";

/**
 * Cycle de vie d'un brouillon d'annonce.
 *
 * Le brouillon est une ligne de `annonce` comme une autre, avec
 * `statut = 'brouillon'` et son compteur `etape_publication` : c'est ce que le
 * schéma prévoyait depuis le début. Le stocker à part — en session, en cache,
 * dans une table jumelle — aurait demandé de tenir deux formes de la même
 * chose, et de les réconcilier à la publication.
 *
 * Conséquence assumée : la ligne existe dès la deuxième étape, avec des
 * colonnes vides. C'est la raison pour laquelle le catalogue public filtre sur
 * `statut = 'publiee'` partout — un brouillon n'est jamais visible, et n'a
 * jamais de `publiee_le`.
 */

/** Ce que l'assistant a besoin de savoir pour dessiner ses six étapes. */
export type Brouillon = {
  id: string;
  statut: string;
  etapeAtteinte: number;
  categorieSlug: string | null;
  villeSlug: string;
  slug: string;
  /** Code ISO du pays de l'annonce : il désigne son marché. */
  pays: string;
  devise: string;
  bornesCaution: BornesCaution;
  photos: { id: string; url: string; ordre: number }[];
  /** Champs saisis, tels qu'ils doivent revenir dans les formulaires. */
  valeurs: {
    titre: string;
    description: string;
    ptacKg: number | null;
    poidsVideKg: number | null;
    longueurUtileMm: number | null;
    largeurUtileMm: number | null;
    hauteurUtileMm: number | null;
    nombreEssieux: number | null;
    typeAttelage: string | null;
    faisceauBroches: number | null;
    adaptateurFourni: boolean;
    freinee: boolean;
    equipements: string[];
    adresseLigne1: string | null;
    codePostal: string | null;
    rayonApproximatifM: number;
    reglesUtilisation: string | null;
    prixJour: number | null;
    caution: number;
    politiqueAnnulation: "souple" | "moderee" | "stricte";
    dureeMinimumJours: number;
    dureeMaximumJours: number;
    delaiPreparationHeures: number;
    reservationInstantanee: boolean;
  };
};

/** L'état du brouillon vu du domaine, seul juge de ce qui manque. */
export function etatDomaine(brouillon: Brouillon): EtatAnnonce {
  return {
    categorieSlug: brouillon.categorieSlug,
    titre: brouillon.valeurs.titre,
    description: brouillon.valeurs.description,
    villeSlug: brouillon.villeSlug,
    ptacKg: brouillon.valeurs.ptacKg,
    poidsVideKg: brouillon.valeurs.poidsVideKg,
    longueurUtileMm: brouillon.valeurs.longueurUtileMm,
    largeurUtileMm: brouillon.valeurs.largeurUtileMm,
    nombrePhotos: brouillon.photos.length,
    adresseLigne1: brouillon.valeurs.adresseLigne1,
    codePostal: brouillon.valeurs.codePostal,
    prixJour: brouillon.valeurs.prixJour,
    caution: brouillon.valeurs.caution,
  };
}

/**
 * Charge un brouillon, à condition qu'il appartienne au demandeur.
 *
 * L'identifiant vient du navigateur : le contrôle de propriété est dans la
 * clause `where`, jamais dans un `if` qui suit la lecture.
 */
export async function chargerBrouillon(
  annonceId: string,
  proprietaireId: string,
): Promise<Brouillon | null> {
  const [ligne] = await db
    .select({
      id: tableAnnonce.id,
      statut: tableAnnonce.statut,
      etapeAtteinte: tableAnnonce.etapePublication,
      categorieSlug: tableCategorie.slug,
      villeSlug: tableAnnonce.villeSlug,
      slug: tableAnnonce.slug,
      pays: tablePays.code,
      devise: tableAnnonce.devise,
      cautionMinimum: tablePays.cautionMinimum,
      cautionMaximum: tablePays.cautionMaximum,
      titre: tableAnnonce.titre,
      description: tableAnnonce.description,
      ptacKg: tableAnnonce.ptacKg,
      poidsVideKg: tableAnnonce.poidsVideKg,
      longueurUtileMm: tableAnnonce.longueurUtileMm,
      largeurUtileMm: tableAnnonce.largeurUtileMm,
      hauteurUtileMm: tableAnnonce.hauteurUtileMm,
      nombreEssieux: tableAnnonce.nombreEssieux,
      typeAttelage: tableAnnonce.typeAttelage,
      faisceauBroches: tableAnnonce.faisceauBroches,
      adaptateurFourni: tableAnnonce.adaptateurFourni,
      freinee: tableAnnonce.freinee,
      equipements: tableAnnonce.equipements,
      adresseLigne1: tableAnnonce.adresseLigne1,
      codePostal: tableAnnonce.codePostal,
      rayonApproximatifM: tableAnnonce.rayonApproximatifM,
      reglesUtilisation: tableAnnonce.reglesUtilisation,
      caution: tableAnnonce.caution,
      politiqueAnnulation: tableAnnonce.politiqueAnnulation,
      dureeMinimumJours: tableAnnonce.dureeMinimumJours,
      dureeMaximumJours: tableAnnonce.dureeMaximumJours,
      delaiPreparationHeures: tableAnnonce.delaiPreparationHeures,
      reservationInstantanee: tableAnnonce.reservationInstantanee,
    })
    .from(tableAnnonce)
    .innerJoin(tableCategorie, eq(tableCategorie.id, tableAnnonce.categorieId))
    .innerJoin(tablePays, eq(tablePays.id, tableAnnonce.paysId))
    .where(
      and(
        eq(tableAnnonce.id, annonceId),
        eq(tableAnnonce.proprietaireId, proprietaireId),
      ),
    )
    .limit(1);

  if (!ligne) return null;

  const photos = await db
    .select({
      id: annoncePhoto.id,
      url: annoncePhoto.url,
      ordre: annoncePhoto.ordre,
    })
    .from(annoncePhoto)
    .where(eq(annoncePhoto.annonceId, annonceId))
    .orderBy(annoncePhoto.ordre);

  const [ligneTarif] = await db
    .select({ prixJour: tarif.prixJour })
    .from(tarif)
    .where(eq(tarif.annonceId, annonceId))
    .limit(1);

  return {
    id: ligne.id,
    statut: ligne.statut,
    etapeAtteinte: ligne.etapeAtteinte,
    categorieSlug: ligne.categorieSlug,
    villeSlug: ligne.villeSlug,
    slug: ligne.slug,
    pays: ligne.pays,
    devise: ligne.devise,
    bornesCaution: {
      minimum: ligne.cautionMinimum,
      maximum: ligne.cautionMaximum,
    },
    photos,
    valeurs: {
      titre: ligne.titre,
      description: ligne.description ?? "",
      ptacKg: ligne.ptacKg,
      poidsVideKg: ligne.poidsVideKg,
      longueurUtileMm: ligne.longueurUtileMm,
      largeurUtileMm: ligne.largeurUtileMm,
      hauteurUtileMm: ligne.hauteurUtileMm,
      nombreEssieux: ligne.nombreEssieux,
      typeAttelage: ligne.typeAttelage,
      faisceauBroches: ligne.faisceauBroches,
      adaptateurFourni: ligne.adaptateurFourni,
      freinee: ligne.freinee ?? false,
      equipements: ligne.equipements ?? [],
      adresseLigne1: ligne.adresseLigne1,
      codePostal: ligne.codePostal,
      rayonApproximatifM: ligne.rayonApproximatifM,
      reglesUtilisation: ligne.reglesUtilisation,
      prixJour: ligneTarif?.prixJour ?? null,
      caution: ligne.caution,
      politiqueAnnulation: ligne.politiqueAnnulation,
      dureeMinimumJours: ligne.dureeMinimumJours,
      dureeMaximumJours: ligne.dureeMaximumJours,
      delaiPreparationHeures: ligne.delaiPreparationHeures,
      reservationInstantanee: ligne.reservationInstantanee,
    },
  };
}

/**
 * Statut et adresse publique d'une annonce du propriétaire, ou `null`.
 *
 * Les six écrans servent aussi bien à créer qu'à corriger : ce qui change
 * entre les deux, c'est ce qu'il faut faire *après* avoir enregistré. Une
 * annonce déjà en ligne doit voir sa correction reprise par le catalogue
 * public, et l'on ramène son auteur devant le résultat plutôt que vers
 * l'étape suivante d'un parcours qu'il a terminé depuis longtemps.
 *
 * Une lecture par enregistrement, sur deux colonnes indexées : c'est moins
 * cher que de faire confiance à un champ caché du formulaire, qui viendrait
 * du navigateur.
 */
export async function apercuAnnonce(
  annonceId: string,
  proprietaireId: string,
): Promise<{
  statut: string;
  villeSlug: string;
  slug: string;
  pays: string;
} | null> {
  const [ligne] = await db
    .select({
      statut: tableAnnonce.statut,
      villeSlug: tableAnnonce.villeSlug,
      slug: tableAnnonce.slug,
      pays: tablePays.code,
    })
    .from(tableAnnonce)
    .innerJoin(tablePays, eq(tablePays.id, tableAnnonce.paysId))
    .where(
      and(
        eq(tableAnnonce.id, annonceId),
        eq(tableAnnonce.proprietaireId, proprietaireId),
      ),
    )
    .limit(1);

  return ligne ?? null;
}

/**
 * Crée le brouillon à la fin de la deuxième étape.
 *
 * Pourquoi pas dès la première, au choix de la catégorie ? Parce que la ligne
 * `annonce` exige une ville, une position, une devise et une caution : ce sont
 * des colonnes non nulles, et les remplir de valeurs d'attente pour les
 * corriger ensuite reviendrait à écrire en base des choses fausses. La
 * catégorie voyage donc dans l'adresse jusqu'à ce qu'on sache *quoi* et *où*.
 */
export async function creerBrouillon(
  proprietaireId: string,
  saisie: {
    categorie: SlugCategorie;
    titre: string;
    description: string;
    villeSlug: string;
  },
): Promise<string> {
  const ville = trouverVille(saisie.villeSlug);
  if (!ville) throw new Error(`Ville inconnue : ${saisie.villeSlug}`);

  if (!CATEGORIES.some((entree) => entree.slug === saisie.categorie)) {
    throw new Error(`Catégorie inconnue : ${saisie.categorie}`);
  }

  const [paysLigne] = await db
    .select({
      id: tablePays.id,
      devise: tablePays.devise,
      cautionMinimum: tablePays.cautionMinimum,
    })
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
    .where(eq(tableCategorie.slug, saisie.categorie))
    .limit(1);

  if (!categorieLigne) {
    throw new Error(
      `Catégorie absente de la base : ${saisie.categorie}. Lancez « npm run db:seed ».`,
    );
  }

  const slug = await slugDisponible(ville.slug, slugifier(saisie.titre));

  const [creee] = await db
    .insert(tableAnnonce)
    .values({
      proprietaireId,
      categorieId: categorieLigne.id,
      paysId: paysLigne.id,
      titre: saisie.titre,
      description: saisie.description,
      slug,
      statut: "brouillon",
      etapePublication: rangDe("caracteristiques"),
      ville: ville.nom,
      villeSlug: ville.slug,
      caracteristiques: { quartier: ville.province },
      // Sans géocodage de l'adresse — qui n'est pas encore saisie —, la
      // position est le centre de la commune. Elle sera affinée à l'étape du
      // retrait ; c'est de toute façon tout ce que le public voit avant
      // confirmation de la réservation.
      position: { longitude: ville.longitude, latitude: ville.latitude },
      devise: paysLigne.devise,
      // La caution part au plancher du pays plutôt qu'à zéro : zéro serait un
      // choix, alors que c'est une valeur non encore décidée, et le plancher
      // est la seule valeur défendable avant que le propriétaire ne tranche.
      caution: paysLigne.cautionMinimum,
    })
    .returning({ id: tableAnnonce.id });

  return creee.id;
}

/**
 * Fait avancer le compteur d'étape, sans jamais le faire reculer.
 *
 * Revenir en arrière pour corriger une faute ne doit pas effacer le chemin
 * déjà parcouru : le compteur dit jusqu'où l'on est allé, pas où l'on regarde.
 * Le `greatest` est calculé en base et non ici — deux onglets ouverts sur le
 * même brouillon ne peuvent donc pas se marcher dessus.
 */
async function marquerEtape(annonceId: string, etape: Etape): Promise<void> {
  await db
    .update(tableAnnonce)
    .set({
      etapePublication: raw`greatest(${tableAnnonce.etapePublication}, ${rangDe(etape) + 1})`,
    })
    .where(
      and(
        eq(tableAnnonce.id, annonceId),
        eq(tableAnnonce.statut, "brouillon"),
      ),
    );
}

/** Étape 2 — le matériel : titre, description, ville. */
export async function enregistrerMateriel(
  annonceId: string,
  proprietaireId: string,
  saisie: { titre: string; description: string; villeSlug: string },
): Promise<boolean> {
  const ville = trouverVille(saisie.villeSlug);
  if (!ville) return false;

  const brouillon = await chargerBrouillon(annonceId, proprietaireId);
  if (!brouillon) return false;

  // Tant que l'annonce est un brouillon, son adresse suit son titre. Une fois
  // publiée, le lien est figé : le référencement local et les liens partagés
  // reposent dessus, et une adresse qui change est une adresse qui casse.
  const slug =
    brouillon.statut === "brouillon"
      ? await slugDisponible(ville.slug, slugifier(saisie.titre))
      : brouillon.slug;

  await db
    .update(tableAnnonce)
    .set({
      titre: saisie.titre,
      description: saisie.description,
      ville: ville.nom,
      villeSlug: ville.slug,
      slug,
      position: { longitude: ville.longitude, latitude: ville.latitude },
    })
    .where(
      and(
        eq(tableAnnonce.id, annonceId),
        eq(tableAnnonce.proprietaireId, proprietaireId),
      ),
    );

  await marquerEtape(annonceId, "materiel");
  return true;
}

/** Étape 3 — les caractéristiques techniques. */
export async function enregistrerCaracteristiques(
  annonceId: string,
  proprietaireId: string,
  saisie: {
    ptacKg: number;
    poidsVideKg: number;
    longueurUtileMm: number;
    largeurUtileMm: number;
    hauteurUtileMm: number | null;
    nombreEssieux: number;
    typeAttelage: string;
    faisceauBroches: number;
    adaptateurFourni: boolean;
    freinee: boolean;
    equipements: string[];
  },
): Promise<boolean> {
  const modifiees = await db
    .update(tableAnnonce)
    .set({
      ptacKg: saisie.ptacKg,
      poidsVideKg: saisie.poidsVideKg,
      // La charge utile est dérivée, jamais saisie : la demander au
      // propriétaire serait lui laisser l'occasion de la contredire.
      chargeUtileKg: saisie.ptacKg - saisie.poidsVideKg,
      longueurUtileMm: saisie.longueurUtileMm,
      largeurUtileMm: saisie.largeurUtileMm,
      hauteurUtileMm: saisie.hauteurUtileMm,
      nombreEssieux: saisie.nombreEssieux,
      typeAttelage: saisie.typeAttelage,
      faisceauBroches: saisie.faisceauBroches,
      adaptateurFourni: saisie.adaptateurFourni,
      freinee: saisie.freinee,
      equipements: saisie.equipements,
    })
    .where(
      and(
        eq(tableAnnonce.id, annonceId),
        eq(tableAnnonce.proprietaireId, proprietaireId),
      ),
    )
    .returning({ id: tableAnnonce.id });

  if (modifiees.length === 0) return false;

  await marquerEtape(annonceId, "caracteristiques");
  return true;
}

/** Étape 5 — le retrait : adresse, imprécision affichée, règles d'usage. */
export async function enregistrerRetrait(
  annonceId: string,
  proprietaireId: string,
  saisie: {
    adresseLigne1: string;
    codePostal: string;
    rayonApproximatifM: number;
    reglesUtilisation: string | null;
  },
): Promise<boolean> {
  const modifiees = await db
    .update(tableAnnonce)
    .set({
      adresseLigne1: saisie.adresseLigne1,
      codePostal: saisie.codePostal,
      rayonApproximatifM: saisie.rayonApproximatifM,
      reglesUtilisation: saisie.reglesUtilisation,
    })
    .where(
      and(
        eq(tableAnnonce.id, annonceId),
        eq(tableAnnonce.proprietaireId, proprietaireId),
      ),
    )
    .returning({ id: tableAnnonce.id });

  if (modifiees.length === 0) return false;

  await marquerEtape(annonceId, "retrait");
  return true;
}

/** Étape 6 — tarifs et conditions de location. */
export async function enregistrerTarifs(
  annonceId: string,
  proprietaireId: string,
  saisie: {
    prixJour: number;
    caution: number;
    politiqueAnnulation: "souple" | "moderee" | "stricte";
    dureeMinimumJours: number;
    dureeMaximumJours: number;
    delaiPreparationHeures: number;
    reservationInstantanee: boolean;
  },
): Promise<boolean> {
  const modifiees = await db
    .update(tableAnnonce)
    .set({
      caution: saisie.caution,
      politiqueAnnulation: saisie.politiqueAnnulation,
      dureeMinimumJours: saisie.dureeMinimumJours,
      dureeMaximumJours: saisie.dureeMaximumJours,
      delaiPreparationHeures: saisie.delaiPreparationHeures,
      reservationInstantanee: saisie.reservationInstantanee,
    })
    .where(
      and(
        eq(tableAnnonce.id, annonceId),
        eq(tableAnnonce.proprietaireId, proprietaireId),
      ),
    )
    .returning({ id: tableAnnonce.id });

  if (modifiees.length === 0) return false;

  // Le tarif de base est la ligne sans période ; il y en a une et une seule.
  const [existant] = await db
    .select({ id: tarif.id })
    .from(tarif)
    .where(eq(tarif.annonceId, annonceId))
    .limit(1);

  if (existant) {
    await db
      .update(tarif)
      .set({ prixJour: saisie.prixJour })
      .where(eq(tarif.id, existant.id));
  } else {
    await db.insert(tarif).values({ annonceId, prixJour: saisie.prixJour });
  }

  await marquerEtape(annonceId, "tarifs");
  return true;
}

export type ResultatPublication =
  /**
   * Le pays voyage avec l'adresse : c'est lui qui désigne le marché sur lequel
   * l'annonce est visible, et non celui que le propriétaire consultait.
   */
  | { statut: "publiee"; villeSlug: string; slug: string; pays: string }
  | { statut: "incomplete"; etape: Etape }
  | { statut: "introuvable" };

/**
 * Publie un brouillon.
 *
 * La vérification porte sur l'état réel de l'annonce et non sur le compteur
 * d'étapes : le compteur dit où en est la navigation, il ne prouve pas que les
 * champs sont remplis. Une action serveur étant une adresse publique, s'y fier
 * laisserait publier une coquille à qui saurait l'appeler directement.
 */
export async function publierBrouillon(
  annonceId: string,
  proprietaireId: string,
): Promise<ResultatPublication> {
  const brouillon = await chargerBrouillon(annonceId, proprietaireId);
  if (!brouillon) return { statut: "introuvable" };

  const etat = etatDomaine(brouillon);
  if (!pretePourPublication(etat, brouillon.bornesCaution)) {
    return {
      statut: "incomplete",
      etape: premiereEtapeIncomplete(etat, brouillon.bornesCaution) as Etape,
    };
  }

  await db
    .update(tableAnnonce)
    .set({
      statut: "publiee",
      etapePublication: rangDe("tarifs"),
      publieeLe: new Date(),
    })
    .where(
      and(
        eq(tableAnnonce.id, annonceId),
        eq(tableAnnonce.proprietaireId, proprietaireId),
      ),
    );

  return {
    statut: "publiee",
    villeSlug: brouillon.villeSlug,
    slug: brouillon.slug,
    pays: brouillon.pays,
  };
}

/** Les brouillons en cours du propriétaire, le plus récent d'abord. */
export async function brouillonsDuProprietaire(proprietaireId: string) {
  return db
    .select({
      id: tableAnnonce.id,
      titre: tableAnnonce.titre,
      ville: tableAnnonce.ville,
      etapeAtteinte: tableAnnonce.etapePublication,
      modifieLe: tableAnnonce.modifieLe,
    })
    .from(tableAnnonce)
    .where(
      and(
        eq(tableAnnonce.proprietaireId, proprietaireId),
        eq(tableAnnonce.statut, "brouillon"),
      ),
    )
    .orderBy(desc(tableAnnonce.modifieLe));
}

/**
 * Les annonces publiées du propriétaire — celles qui portent son identifiant.
 *
 * L'écran du parc affichait jusqu'ici *tout* le catalogue : le filtre sur le
 * propriétaire manquait, faute de session au moment où il a été écrit. Un
 * loueur y voyait donc les remorques des autres comme si c'étaient les siennes.
 */
export async function annoncesPublieesDuProprietaire(proprietaireId: string) {
  return db
    .select({
      id: tableAnnonce.id,
      titre: tableAnnonce.titre,
      ville: tableAnnonce.ville,
      villeSlug: tableAnnonce.villeSlug,
      slug: tableAnnonce.slug,
      statut: tableAnnonce.statut,
      // Le pays désigne le marché sur lequel l'annonce est visible : un lien
      // vers une annonce belge depuis le marché français mène à un 404.
      pays: tablePays.code,
      devise: tableAnnonce.devise,
      ptacKg: tableAnnonce.ptacKg,
      chargeUtileKg: tableAnnonce.chargeUtileKg,
      // Sous-requêtes plutôt que jointures : la photo de couverture et le tarif
      // de base sont deux lignes parmi n, et une jointure changerait la
      // cardinalité — chaque annonce apparaîtrait autant de fois qu'elle a de
      // photos.
      photo: raw<string | null>`(
        select p.url from annonce_photo p
        where p.annonce_id = ${tableAnnonce.id}
        order by p.ordre limit 1
      )`,
      prixJour: raw<number | null>`(
        select t.prix_jour from tarif t
        where t.annonce_id = ${tableAnnonce.id}
        order by t.debut nulls first limit 1
      )`,
    })
    .from(tableAnnonce)
    .innerJoin(tablePays, eq(tablePays.id, tableAnnonce.paysId))
    .where(
      and(
        eq(tableAnnonce.proprietaireId, proprietaireId),
        ne(tableAnnonce.statut, "brouillon"),
      ),
    )
    .orderBy(desc(tableAnnonce.publieeLe));
}
