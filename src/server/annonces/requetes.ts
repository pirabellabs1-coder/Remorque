import "server-only";

import { cache } from "react";

import { and, eq, sql } from "drizzle-orm";

import type { SlugCategorie } from "@/config/categories";
import { trouverVille } from "@/config/villes";
import { db } from "@/server/db";
import {
  annonce,
  annoncePhoto,
  avis,
  categorie,
  pays,
  reservation,
  tarif,
  utilisateur,
} from "@/server/db/schema";

// Chemin absolu, et non relatif : c'est ce qui permet au banc d'essai de
// substituer le module de marché, comme il substitue celui de session.
import { annonceDuMarche } from "@/server/annonces/marche";

import type { AnnonceResume, TriRecherche } from "./catalogue";

/**
 * Lectures du catalogue, sur PostgreSQL.
 *
 * Ce module remplace le parcours du tableau en mémoire. Trois conséquences,
 * qui sont l'objet du passage en base :
 *
 * 1. **La note est calculée, pas stockée.** C'est la moyenne des avis publiés
 *    de l'annonce. Elle ne peut plus mentir, ni se figer à une valeur écrite à
 *    la main. Une annonce sans avis vaut `null` — et non zéro, qui se lirait
 *    comme une très mauvaise note.
 * 2. **La distance est calculée par PostGIS**, en mètres sur le sphéroïde,
 *    depuis le centre de la ville cherchée. Elle était jusqu'ici un nombre
 *    écrit dans le jeu d'essai, donc faux dès qu'on changeait de point de
 *    départ.
 * 3. **Le prix vient de la grille tarifaire**, table séparée qui portera la
 *    saisonnalité et les promotions. Le tarif de base est celui qui n'a pas de
 *    période.
 *
 * Toutes les requêtes ne rendent que les annonces publiées : le filtre est
 * posé ici, une fois, plutôt que dans chaque écran où on finirait par
 * l'oublier.
 */

/**
 * Sous-requêtes, construites à l'appel et non au chargement du module.
 *
 * Les écrire comme des constantes de module appelait `db.select(...)` dès
 * l'importation, ce qui ouvrait la connexion — et faisait échouer au
 * chargement les cinq fichiers de tests unitaires qui, eux, n'ont pas de base.
 * Rendre la connexion paresseuse ne suffisait donc pas : il fallait aussi que
 * plus personne ne la sollicite pour le simple fait d'exister.
 */

/** Note moyenne et nombre d'avis publiés, par annonce. */
const notesDes = () =>
  db
    .select({
      annonceId: avis.annonceId,
      moyenne: sql<string>`avg(${avis.note})`.as("moyenne"),
      nombre: sql<number>`count(*)::int`.as("nombre"),
    })
    .from(avis)
    .where(and(sql`${avis.publieLe} is not null`, eq(avis.masque, false)))
    .groupBy(avis.annonceId)
    .as("notes");

/** Tarif de base : celui qui ne porte pas de période d'application. */
const tarifsDe = () =>
  db
    .select({ annonceId: tarif.annonceId, prixJour: tarif.prixJour })
    .from(tarif)
    .where(and(sql`${tarif.debut} is null`, sql`${tarif.fin} is null`))
    .as("tarif_base");

/** Première photo de l'annonce, dans l'ordre choisi par le propriétaire. */
const photosDe = () =>
  db
    .select({
      annonceId: annoncePhoto.annonceId,
      url: sql<string>`(array_agg(${annoncePhoto.url} order by ${annoncePhoto.ordre}))[1]`.as(
        "url",
      ),
    })
    .from(annoncePhoto)
    .groupBy(annoncePhoto.annonceId)
    .as("photo");

type Notes = ReturnType<typeof notesDes>;
type Tarifs = ReturnType<typeof tarifsDe>;
type Photos = ReturnType<typeof photosDe>;

/**
 * Distance en mètres depuis un point, sur la projection géographique.
 *
 * `::geography` est indispensable : sur la géométrie brute, PostGIS rendrait
 * des degrés, et l'index posé sur la projection ne serait pas utilisé.
 */
function distanceDepuis(longitude: number, latitude: number) {
  return sql<number>`round(st_distance(
    ${annonce.position}::geography,
    st_setsrid(st_makepoint(${longitude}, ${latitude}), 4326)::geography
  ))::int`;
}

const AUCUNE_DISTANCE = () => sql<number>`0`;

function colonnesResume(
  distance: ReturnType<typeof distanceDepuis> | ReturnType<typeof AUCUNE_DISTANCE>,
  tarifBase: Tarifs,
  photo: Photos,
  notes: Notes,
) {
  return {
    id: annonce.id,
    slug: annonce.slug,
    titre: annonce.titre,
    categorie: categorie.slug,
    ville: annonce.ville,
    villeSlug: annonce.villeSlug,
    distanceM: distance,
    prixJour: tarifBase.prixJour,
    devise: annonce.devise,
    photo: photo.url,
    moyenne: notes.moyenne,
    nombreAvis: notes.nombre,
    reservationInstantanee: annonce.reservationInstantanee,
    ptacKg: annonce.ptacKg,
    chargeUtileKg: annonce.chargeUtileKg,
    freinee: annonce.freinee,
    // Position et rayon d'imprécision voyagent ensemble, et ne se séparent
    // jamais : la première ne s'affiche qu'au centre du second. Publier le
    // point sans le cercle reviendrait à publier l'adresse du domicile,
    // exactement ce que le réglage du propriétaire existe pour éviter.
    longitude: sql<number>`st_x(${annonce.position}::geometry)`,
    latitude: sql<number>`st_y(${annonce.position}::geometry)`,
    rayonApproximatifM: annonce.rayonApproximatifM,
  };
}

type LigneResume = {
  id: string;
  slug: string;
  titre: string;
  categorie: string;
  ville: string;
  villeSlug: string;
  distanceM: number;
  prixJour: number | null;
  devise: string;
  photo: string | null;
  moyenne: string | null;
  nombreAvis: number | null;
  reservationInstantanee: boolean;
  ptacKg: number | null;
  chargeUtileKg: number | null;
  freinee: boolean | null;
  longitude: number;
  latitude: number;
  rayonApproximatifM: number;
};

function versResume(ligne: LigneResume, alt: string): AnnonceResume {
  return {
    id: ligne.id,
    slug: ligne.slug,
    titre: ligne.titre,
    categorie: ligne.categorie as SlugCategorie,
    ville: ligne.ville,
    villeSlug: ligne.villeSlug,
    distanceM: ligne.distanceM ?? 0,
    prixJour: ligne.prixJour ?? 0,
    devise: ligne.devise,
    photo: ligne.photo ?? "",
    photoAlt: alt,
    // `avg` rend une chaîne : PostgreSQL refuse de perdre de la précision à
    // notre place. La conversion est explicite, et `null` reste `null` — une
    // annonce sans avis n'a pas de note, ce qui ne se dit pas « 0 ».
    note: ligne.moyenne === null ? null : Number(ligne.moyenne),
    nombreAvis: ligne.nombreAvis ?? 0,
    reservationInstantanee: ligne.reservationInstantanee,
    ptacKg: ligne.ptacKg ?? 0,
    chargeUtileKg: ligne.chargeUtileKg ?? 0,
    freinee: ligne.freinee ?? false,
    situation: {
      longitude: ligne.longitude,
      latitude: ligne.latitude,
      rayonM: ligne.rayonApproximatifM,
    },
  };
}

/**
 * Ordre de tri.
 *
 * Il porte sur l'expression elle-même, jamais sur un alias : PostgreSQL
 * n'expose pas dans `ORDER BY` les alias d'une projection calculée, et la
 * première version échouait sur « column "distance_m" does not exist ».
 */
function ordonner(
  tri: TriRecherche,
  distance: ReturnType<typeof distanceDepuis> | ReturnType<typeof AUCUNE_DISTANCE>,
  avecVille: boolean,
  tarifBase: Tarifs,
  notes: Notes,
) {
  switch (tri) {
    case "prix":
      return sql`${tarifBase.prixJour} asc nulls last`;
    case "note":
      return sql`${notes.moyenne} desc nulls last`;
    case "distance":
      // Sans point de référence — ni ville cherchée, ni position autorisée —
      // la distance vaut la constante zéro, et PostgreSQL lit ce zéro comme un
      // **numéro de colonne** : « ORDER BY position 0 is not in select list ».
      // La recherche répondait donc par une erreur 500 au simple clic sur
      // « Distance ». Faute de référence, on trie par prix, comme le fait déjà
      // la pertinence dans la même situation.
      return avecVille
        ? sql`${distance} asc`
        : sql`${tarifBase.prixJour} asc nulls last`;
    default:
      // « Pertinence » privilégie la proximité, qui est le critère réel d'une
      // place de marché locale. Sans ville cherchée, la distance vaut zéro
      // partout et n'ordonne rien : on retombe alors sur le prix.
      return avecVille ? sql`${distance} asc` : sql`${tarifBase.prixJour} asc nulls last`;
  }
}

/**
 * Mémorisée par requête HTTP et par jeu de critères. Une page de ville demande
 * les annonces pour la liste, puis le prix minimum, qui les redemande : sans
 * déduplication, la même requête partait deux fois.
 */
export const chercher = cache(async function chercher(options: {
  villeSlug?: string;
  categorieSlug?: string;
  tri?: TriRecherche;
  limite?: number;
  /** Position réelle du visiteur, quand il l'a autorisée. */
  longitude?: number;
  latitude?: number;
  /** Rayon de recherche autour de cette position, en kilomètres. */
  rayonKm?: number;
  /** Prix par jour maximum, en centimes. */
  prixMax?: number;
  /** Charge utile minimale exigée, en kilogrammes. */
  chargeMin?: number;
  /** N'afficher que les remorques freinées. */
  freineeSeulement?: boolean;
  /** N'afficher que les annonces réservables sans accord préalable. */
  instantaneeSeulement?: boolean;
}): Promise<LigneResume[]> {
  const {
    villeSlug,
    categorieSlug,
    tri = "pertinence",
    limite,
    longitude,
    latitude,
    rayonKm,
    prixMax,
    chargeMin,
    freineeSeulement,
    instantaneeSeulement,
  } = options;

  // Le point de référence est la position du visiteur quand il l'a donnée,
  // sinon le centre de la ville cherchée. La position réelle prime : elle dit
  // « je suis ici », là où la ville dit seulement « je cherche par là ».
  const positionDonnee = longitude !== undefined && latitude !== undefined;
  const ville = villeSlug ? trouverVille(villeSlug) : undefined;

  const distance = positionDonnee
    ? distanceDepuis(longitude, latitude)
    : ville
      ? distanceDepuis(ville.longitude, ville.latitude)
      : AUCUNE_DISTANCE();

  const tarifBase = tarifsDe();
  const photo = photosDe();
  const notes = notesDes();

  // Le marché servi borne le catalogue : une annonce belge n'a rien à faire
  // dans une recherche française — règle 7.
  const conditions = [eq(annonce.statut, "publiee"), await annonceDuMarche()];
  if (villeSlug) conditions.push(eq(annonce.villeSlug, villeSlug));
  if (categorieSlug) conditions.push(eq(categorie.slug, categorieSlug));

  // Le prix se filtre sur le tarif de base, joint plus bas : la condition
  // porte donc sur la sous-requête et non sur `annonce`.
  if (prixMax !== undefined) {
    conditions.push(sql`${tarifBase.prixJour} <= ${prixMax}`);
  }

  // La charge utile plutôt que le PTAC : c'est ce que le locataire cherche
  // réellement — « puis-je y mettre une tonne ? » — là où le PTAC inclut le
  // poids de la remorque elle-même et induit en erreur.
  if (chargeMin !== undefined) {
    conditions.push(sql`${annonce.chargeUtileKg} >= ${chargeMin}`);
  }

  if (freineeSeulement) conditions.push(eq(annonce.freinee, true));
  if (instantaneeSeulement) {
    conditions.push(eq(annonce.reservationInstantanee, true));
  }

  // Rayon autour de la position réelle. `ST_DWithin` sur la projection
  // `::geography` est ce qui emploie l'index géographique — un filtre écrit
  // avec `ST_Distance(...) < x` obligerait à calculer la distance de chaque
  // annonce du pays avant de la rejeter.
  if (positionDonnee && rayonKm !== undefined) {
    conditions.push(
      sql`st_dwithin(
        ${annonce.position}::geography,
        st_setsrid(st_makepoint(${longitude}, ${latitude}), 4326)::geography,
        ${Math.round(rayonKm * 1000)}
      )`,
    );
  }

  const requete = db
    .select(colonnesResume(distance, tarifBase, photo, notes))
    .from(annonce)
    .innerJoin(categorie, eq(categorie.id, annonce.categorieId))
    .leftJoin(tarifBase, eq(tarifBase.annonceId, annonce.id))
    .leftJoin(photo, eq(photo.annonceId, annonce.id))
    .leftJoin(notes, eq(notes.annonceId, annonce.id))
    .where(and(...conditions))
    .orderBy(ordonner(tri, distance, Boolean(ville) || positionDonnee, tarifBase, notes));

  const lignes = limite ? await requete.limit(limite) : await requete;
  return lignes as LigneResume[];
});

export { versResume, type LigneResume };

/* -------------------------------------------------------------------------- */
/*  Fiche détaillée                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Mémorisée : Next.js appelle `generateMetadata` puis le composant de page, et
 * les deux ont besoin de la même annonce. Sans déduplication, chaque fiche
 * partait chercher ses données deux fois.
 */
export const detail = cache(async function detail(
  villeSlug: string,
  slug: string,
): Promise<(LigneResume & {
  description: string | null;
  poidsVideKg: number | null;
  longueurUtileMm: number | null;
  largeurUtileMm: number | null;
  hauteurUtileMm: number | null;
  typeAttelage: string | null;
  faisceauBroches: number | null;
  caution: number;
  equipements: string[];
  politiqueAnnulation: "souple" | "moderee" | "stricte";
  caracteristiques: Record<string, unknown>;
  proprietaireId: string;
  proprietairePrenom: string | null;
  proprietaireDepuis: Date;
  proprietaireProfessionnel: boolean;
}) | null> {
  const ville = trouverVille(villeSlug);
  const distance = ville
    ? distanceDepuis(ville.longitude, ville.latitude)
    : AUCUNE_DISTANCE();

  const tarifBase = tarifsDe();
  const photo = photosDe();
  const notes = notesDes();

  const [ligne] = await db
    .select({
      ...colonnesResume(distance, tarifBase, photo, notes),
      description: annonce.description,
      poidsVideKg: annonce.poidsVideKg,
      longueurUtileMm: annonce.longueurUtileMm,
      largeurUtileMm: annonce.largeurUtileMm,
      hauteurUtileMm: annonce.hauteurUtileMm,
      typeAttelage: annonce.typeAttelage,
      faisceauBroches: annonce.faisceauBroches,
      caution: annonce.caution,
      equipements: annonce.equipements,
      politiqueAnnulation: annonce.politiqueAnnulation,
      caracteristiques: annonce.caracteristiques,
      proprietaireId: utilisateur.id,
      proprietairePrenom: utilisateur.prenom,
      proprietaireDepuis: utilisateur.creeLe,
      proprietaireProfessionnel: sql<boolean>`${utilisateur.typeCompte} = 'professionnel'`,
    })
    .from(annonce)
    .innerJoin(categorie, eq(categorie.id, annonce.categorieId))
    .innerJoin(utilisateur, eq(utilisateur.id, annonce.proprietaireId))
    .leftJoin(tarifBase, eq(tarifBase.annonceId, annonce.id))
    .leftJoin(photo, eq(photo.annonceId, annonce.id))
    .leftJoin(notes, eq(notes.annonceId, annonce.id))
    .where(
      and(
        eq(annonce.statut, "publiee"),
        // Hors de son marché, la fiche n'existe pas : l'appelant rendra un 404
        // plutôt qu'une annonce dont le barème affiché ne s'appliquerait pas.
        await annonceDuMarche(),
        eq(annonce.villeSlug, villeSlug),
        eq(annonce.slug, slug),
      ),
    )
    .limit(1);

  return (ligne as never) ?? null;
});

/**
 * Taux de réponse d'un propriétaire, calculé sur ses demandes tranchées.
 *
 * Il était jusqu'ici un nombre écrit dans le jeu d'essai. Le voici dérivé :
 * part des demandes reçues à laquelle le propriétaire a répondu, quelle que
 * soit la réponse. Une demande expirée est précisément celle à laquelle il n'a
 * pas répondu — c'est ce que le taux mesure. Les demandes encore en attente
 * sont exclues : elles ne sont ni honorées ni manquées.
 */
export const tauxReponse = cache(async function tauxReponse(
  proprietaireId: string,
): Promise<number | null> {
  const [ligne] = await db
    .select({
      tranchees: sql<number>`count(*) filter (where ${reservation.statut} <> 'demandee')::int`,
      expirees: sql<number>`count(*) filter (where ${reservation.statut} = 'expiree')::int`,
    })
    .from(reservation)
    .where(eq(reservation.proprietaireId, proprietaireId));

  if (!ligne || ligne.tranchees === 0) return null;
  return Math.round(((ligne.tranchees - ligne.expirees) / ligne.tranchees) * 100);
});

/** Nombre d'annonces publiées par ville. Compté, jamais saisi. */
export const compterParVille = cache(async function compterParVille(): Promise<
  Map<string, number>
> {
  const lignes = await db
    .select({
      villeSlug: annonce.villeSlug,
      nombre: sql<number>`count(*)::int`,
    })
    .from(annonce)
    .where(and(eq(annonce.statut, "publiee"), await annonceDuMarche()))
    .groupBy(annonce.villeSlug);

  return new Map(lignes.map((ligne) => [ligne.villeSlug, ligne.nombre]));
});

/**
 * Adresses des fiches publiées, pour le plan de site et la pré-génération.
 *
 * Le pays est rendu avec l'adresse plutôt que filtré : `generateStaticParams`
 * s'exécute hors d'une requête et n'a donc pas de marché courant. C'est
 * l'appelant qui répartit les adresses entre les marchés — il est le seul à
 * savoir lequel il pré-génère.
 */
export async function adresses(): Promise<
  { ville: string; slug: string; pays: string }[]
> {
  return db
    .select({
      ville: annonce.villeSlug,
      slug: annonce.slug,
      pays: pays.code,
    })
    .from(annonce)
    .innerJoin(pays, eq(pays.id, annonce.paysId))
    .where(eq(annonce.statut, "publiee"));
}

export async function detailParAnnonce(annonceId: string) {
  const [ligne] = await db
    .select({ villeSlug: annonce.villeSlug, slug: annonce.slug })
    .from(annonce)
    .where(eq(annonce.id, annonceId))
    .limit(1);
  return ligne ?? null;
}
