import { CATEGORIES, type SlugCategorie } from "@/config/categories";

import { listerAnnonces } from "./depot";

/**
 * Accès au catalogue d'annonces.
 *
 * ⚠ Jeu de démonstration. Ces annonces existent uniquement pour concevoir et
 * recetter les écrans avant que la base ne soit branchée. Elles seront
 * remplacées par la requête géolocalisée réelle — `ST_DWithin` sur la
 * projection `::geography` de `annonce.position`, filtrée par disponibilité —
 * sans que les composants d'interface changent, puisqu'ils ne dépendent que
 * des types ci-dessous.
 *
 * Aucune de ces annonces ne doit être présentée à un utilisateur réel.
 */

export type AnnonceResume = {
  id: string;
  slug: string;
  titre: string;
  categorie: SlugCategorie;
  ville: string;
  villeSlug: string;
  /** Distance depuis le point de recherche, en mètres. */
  distanceM: number;
  /** Prix par jour, en centimes. */
  prixJour: number;
  devise: string;
  photo: string;
  photoAlt: string;
  note: number | null;
  nombreAvis: number;
  reservationInstantanee: boolean;
  ptacKg: number;
  chargeUtileKg: number;
  freinee: boolean;
};

export type AnnonceDetail = AnnonceResume & {
  description: string;
  poidsVideKg: number;
  longueurUtileMm: number;
  largeurUtileMm: number;
  hauteurUtileMm: number | null;
  typeAttelage: string;
  faisceauBroches: number;
  /** Caution demandée, en centimes. */
  caution: number;
  equipements: string[];
  politiqueAnnulation: "souple" | "moderee" | "stricte";
  proprietaire: {
    prenom: string;
    depuis: string;
    tauxReponse: number;
    professionnel: boolean;
  };
  /** Quartier affiché avant confirmation ; l'adresse exacte reste masquée. */
  quartier: string;
};

const photoDe = (slug: SlugCategorie) => {
  const categorie = CATEGORIES.find((entree) => entree.slug === slug)!;
  return { photo: categorie.photo, photoAlt: categorie.alt };
};

/** Graine du dépôt (`depot.ts`), et non source de lecture directe. */
export const JEU_DE_DEMONSTRATION: AnnonceDetail[] = [
  {
    id: "d1",
    slug: "benne-basculante-750-kg",
    titre: "Benne basculante 750 kg",
    categorie: "remorque-benne",
    ville: "Bruxelles",
    villeSlug: "bruxelles",
    quartier: "Schaerbeek",
    distanceM: 2_400,
    prixJour: 3_500,
    devise: "EUR",
    ...photoDe("remorque-benne"),
    note: 4.8,
    nombreAvis: 24,
    reservationInstantanee: true,
    ptacKg: 750,
    poidsVideKg: 250,
    chargeUtileKg: 500,
    longueurUtileMm: 2_050,
    largeurUtileMm: 1_300,
    hauteurUtileMm: 400,
    freinee: false,
    typeAttelage: "Boule Ø 50 mm",
    faisceauBroches: 13,
    caution: 40_000,
    equipements: ["Bâche", "Filet", "Sangles", "Roue de secours"],
    politiqueAnnulation: "moderee",
    description:
      "Benne récente, bascule manuelle, idéale pour les gravats et les déchets verts. Bâche et filet fournis.",
    proprietaire: {
      prenom: "Thomas",
      depuis: "2025",
      tauxReponse: 98,
      professionnel: false,
    },
  },
  {
    id: "d2",
    slug: "plateau-2-essieux-1300-kg",
    titre: "Plateau 2 essieux 1 300 kg",
    categorie: "remorque-plateau",
    ville: "Bruxelles",
    villeSlug: "bruxelles",
    quartier: "Anderlecht",
    distanceM: 6_100,
    prixJour: 4_200,
    devise: "EUR",
    ...photoDe("remorque-plateau"),
    note: 4.9,
    nombreAvis: 41,
    reservationInstantanee: true,
    ptacKg: 1_300,
    poidsVideKg: 300,
    chargeUtileKg: 1_000,
    longueurUtileMm: 3_000,
    largeurUtileMm: 1_500,
    hauteurUtileMm: null,
    freinee: true,
    typeAttelage: "Boule Ø 50 mm",
    faisceauBroches: 13,
    caution: 60_000,
    equipements: ["Ridelles amovibles", "Sangles", "Rampes"],
    politiqueAnnulation: "moderee",
    description:
      "Plateau freiné à ridelles amovibles. Convient au transport de matériaux longs et de palettes.",
    proprietaire: {
      prenom: "Locarem",
      depuis: "2024",
      tauxReponse: 100,
      professionnel: true,
    },
  },
  {
    id: "d3",
    slug: "porte-voiture-basculant",
    titre: "Porte-voiture basculant",
    categorie: "porte-voiture",
    ville: "Bruxelles",
    villeSlug: "bruxelles",
    quartier: "Ixelles",
    distanceM: 8_700,
    prixJour: 6_900,
    devise: "EUR",
    ...photoDe("porte-voiture"),
    note: 4.7,
    nombreAvis: 18,
    reservationInstantanee: false,
    ptacKg: 2_700,
    poidsVideKg: 600,
    chargeUtileKg: 2_100,
    longueurUtileMm: 4_100,
    largeurUtileMm: 1_900,
    hauteurUtileMm: null,
    freinee: true,
    typeAttelage: "Boule Ø 50 mm",
    faisceauBroches: 13,
    caution: 100_000,
    equipements: ["Treuil", "Sangles à cliquet", "Rampes"],
    politiqueAnnulation: "stricte",
    description:
      "Plateau basculant avec treuil, pour véhicule en panne ou voiture de collection. Permis BE requis.",
    proprietaire: {
      prenom: "Karim",
      depuis: "2025",
      tauxReponse: 92,
      professionnel: false,
    },
  },
  {
    id: "d4",
    slug: "bagagere-fermee-500-kg",
    titre: "Bagagère fermée 500 kg",
    categorie: "remorque-bagagere",
    ville: "Bruxelles",
    villeSlug: "bruxelles",
    quartier: "Uccle",
    distanceM: 4_300,
    prixJour: 2_400,
    devise: "EUR",
    ...photoDe("remorque-bagagere"),
    note: 4.6,
    nombreAvis: 9,
    reservationInstantanee: true,
    ptacKg: 500,
    poidsVideKg: 180,
    chargeUtileKg: 320,
    longueurUtileMm: 2_000,
    largeurUtileMm: 1_150,
    hauteurUtileMm: 900,
    freinee: false,
    typeAttelage: "Boule Ø 50 mm",
    faisceauBroches: 7,
    caution: 30_000,
    equipements: ["Couvercle verrouillable", "Sangles"],
    politiqueAnnulation: "souple",
    description:
      "Coffre fermé et verrouillable, parfait pour un déménagement ou des vacances. Contenu à l'abri de la pluie.",
    proprietaire: {
      prenom: "Élodie",
      depuis: "2026",
      tauxReponse: 95,
      professionnel: false,
    },
  },
  {
    id: "d5",
    slug: "van-2-places",
    titre: "Van 2 places",
    categorie: "van-a-chevaux",
    ville: "Bruxelles",
    villeSlug: "bruxelles",
    quartier: "Woluwe-Saint-Lambert",
    distanceM: 11_200,
    prixJour: 8_500,
    devise: "EUR",
    ...photoDe("van-a-chevaux"),
    note: 5,
    nombreAvis: 12,
    reservationInstantanee: false,
    ptacKg: 2_000,
    poidsVideKg: 850,
    chargeUtileKg: 1_150,
    longueurUtileMm: 3_100,
    largeurUtileMm: 1_700,
    hauteurUtileMm: 2_300,
    freinee: true,
    typeAttelage: "Boule Ø 50 mm",
    faisceauBroches: 13,
    caution: 120_000,
    equipements: ["Barres de poitrail", "Tapis", "Fenêtres"],
    politiqueAnnulation: "stricte",
    description:
      "Van entretenu et contrôlé, sellerie propre. Réservé aux locataires ayant l'habitude du transport équin.",
    proprietaire: {
      prenom: "Camille",
      depuis: "2025",
      tauxReponse: 89,
      professionnel: false,
    },
  },
  {
    id: "d6",
    slug: "porte-bateau-6-m",
    titre: "Porte-bateau 6 m",
    categorie: "porte-bateau",
    ville: "Bruxelles",
    villeSlug: "bruxelles",
    quartier: "Molenbeek-Saint-Jean",
    distanceM: 9_500,
    prixJour: 5_500,
    devise: "EUR",
    ...photoDe("porte-bateau"),
    note: 4.5,
    nombreAvis: 6,
    reservationInstantanee: true,
    ptacKg: 1_500,
    poidsVideKg: 350,
    chargeUtileKg: 1_150,
    longueurUtileMm: 6_200,
    largeurUtileMm: 2_100,
    hauteurUtileMm: null,
    freinee: true,
    typeAttelage: "Boule Ø 50 mm",
    faisceauBroches: 13,
    caution: 80_000,
    equipements: ["Treuil", "Rouleaux", "Sangles"],
    politiqueAnnulation: "moderee",
    description:
      "Remorque de mise à l'eau réglable, rouleaux en bon état. Feux démontables pour l'immersion.",
    proprietaire: {
      prenom: "Nicolas",
      depuis: "2025",
      tauxReponse: 87,
      professionnel: false,
    },
  },
  {
    id: "d7",
    slug: "porte-moto-1-place",
    titre: "Porte-moto 1 place",
    categorie: "porte-moto",
    ville: "Bruxelles",
    villeSlug: "bruxelles",
    quartier: "Etterbeek",
    distanceM: 7_400,
    prixJour: 2_900,
    devise: "EUR",
    ...photoDe("porte-moto"),
    note: 4.9,
    nombreAvis: 15,
    reservationInstantanee: true,
    ptacKg: 500,
    poidsVideKg: 150,
    chargeUtileKg: 350,
    longueurUtileMm: 2_400,
    largeurUtileMm: 1_100,
    hauteurUtileMm: null,
    freinee: false,
    typeAttelage: "Boule Ø 50 mm",
    faisceauBroches: 7,
    caution: 30_000,
    equipements: ["Rail de roue", "Rampe", "Sangles à cliquet"],
    politiqueAnnulation: "souple",
    description:
      "Rail de blocage de roue avant et rampe légère. Chargement possible seul.",
    proprietaire: {
      prenom: "Yanis",
      depuis: "2026",
      tauxReponse: 100,
      professionnel: false,
    },
  },
  {
    id: "d8",
    slug: "frigorifique-750-kg",
    titre: "Frigorifique 750 kg",
    categorie: "remorque-frigorifique",
    ville: "Bruxelles",
    villeSlug: "bruxelles",
    quartier: "Jette",
    distanceM: 5_800,
    prixJour: 9_500,
    devise: "EUR",
    ...photoDe("remorque-frigorifique"),
    note: 4.8,
    nombreAvis: 31,
    reservationInstantanee: false,
    ptacKg: 750,
    poidsVideKg: 420,
    chargeUtileKg: 330,
    longueurUtileMm: 2_000,
    largeurUtileMm: 1_300,
    hauteurUtileMm: 1_600,
    freinee: false,
    typeAttelage: "Boule Ø 50 mm",
    faisceauBroches: 13,
    caution: 90_000,
    equipements: ["Groupe froid", "Étagères", "Prise 230 V"],
    politiqueAnnulation: "stricte",
    description:
      "Groupe froid jusqu'à −5 °C, révisé chaque année. Très demandé pour les mariages et les événements.",
    proprietaire: {
      prenom: "FroidEvent",
      depuis: "2024",
      tauxReponse: 100,
      professionnel: true,
    },
  },
];

export type CriteresRecherche = {
  ville?: string;
  categorie?: string;
  tri?: TriRecherche;
};

export const TRIS = ["pertinence", "distance", "prix", "note"] as const;
export type TriRecherche = (typeof TRIS)[number];

export function estTri(valeur: string | undefined): valeur is TriRecherche {
  return valeur !== undefined && (TRIS as readonly string[]).includes(valeur);
}

const comparateurs: Record<
  TriRecherche,
  (a: AnnonceResume, b: AnnonceResume) => number
> = {
  // À défaut de moteur de pertinence, on privilégie la proximité : c'est le
  // critère qui compte réellement sur une place de marché locale.
  pertinence: (a, b) => a.distanceM - b.distanceM,
  distance: (a, b) => a.distanceM - b.distanceM,
  prix: (a, b) => a.prixJour - b.prixJour,
  note: (a, b) => (b.note ?? 0) - (a.note ?? 0),
};

export type ResultatRecherche = {
  annonces: AnnonceResume[];
  total: number;
};

/**
 * Normalise un nom de ville pour la comparaison : sans accent, sans casse,
 * tirets à la place des espaces. « Saint-Étienne » et « saint etienne »
 * doivent désigner la même ville.
 */
function normaliserVille(valeur: string): string {
  return valeur
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-");
}

/**
 * Garde-fou : le jeu de démonstration porte des notes et des nombres d'avis
 * qui n'existent pas. Les exposer en production serait une allégation
 * trompeuse (section 11). Tant que la base n'est pas branchée, la production
 * ne renvoie donc rien — et l'écran vide, qui est de toute façon l'état réel
 * des premiers jours, prend le relais.
 */
const DEMONSTRATION_AUTORISEE = process.env.NODE_ENV !== "production";

export async function rechercherAnnonces(
  criteres: CriteresRecherche,
): Promise<ResultatRecherche> {
  if (!DEMONSTRATION_AUTORISEE) return { annonces: [], total: 0 };

  const { ville, categorie, tri = "pertinence" } = criteres;
  const villeRecherchee = ville ? normaliserVille(ville) : undefined;

  const annonces = listerAnnonces().filter((annonce) => {
    if (categorie && annonce.categorie !== categorie) return false;
    // Sans ce filtre, une recherche « Bordeaux » renvoyait les annonces de
    // Lyon sous le titre « Remorques à louer à Bordeaux ».
    if (villeRecherchee && annonce.villeSlug !== villeRecherchee) return false;
    return true;
  }).sort(comparateurs[tri]);

  return { annonces, total: annonces.length };
}

/** Quelques annonces pour la page d'accueil, les plus proches d'abord. */
export async function annoncesEnVitrine(
  nombre: number,
): Promise<AnnonceResume[]> {
  if (!DEMONSTRATION_AUTORISEE) return [];
  return [...listerAnnonces()]
    .sort(comparateurs.pertinence)
    .slice(0, nombre);
}

/**
 * Annonces d'une ville, éventuellement d'une seule catégorie.
 * Alimente les pages locales `/location-remorque/[ville]`.
 */
export async function annoncesDeLaVille(
  villeSlug: string,
  categorie?: string,
): Promise<AnnonceResume[]> {
  if (!DEMONSTRATION_AUTORISEE) return [];

  return listerAnnonces().filter(
    (annonce) =>
      annonce.villeSlug === villeSlug &&
      (!categorie || annonce.categorie === categorie),
  ).sort(comparateurs.pertinence);
}

/**
 * Nombre d'annonces actives par ville.
 *
 * C'est l'indicateur avancé du projet — la densité d'offre par ville, et non
 * le trafic (section 15). Il est compté, jamais saisi : afficher un volume
 * arrondi ou espéré serait une allégation invérifiable.
 */
export async function compterAnnoncesParVille(): Promise<Map<string, number>> {
  const comptes = new Map<string, number>();
  if (!DEMONSTRATION_AUTORISEE) return comptes;

  for (const annonce of listerAnnonces()) {
    comptes.set(annonce.villeSlug, (comptes.get(annonce.villeSlug) ?? 0) + 1);
  }
  return comptes;
}

/** Prix journalier le plus bas d'une ville, en centimes. */
export async function prixMinimumDansLaVille(
  villeSlug: string,
  categorie?: string,
): Promise<number | null> {
  const annonces = await annoncesDeLaVille(villeSlug, categorie);
  if (annonces.length === 0) return null;
  return Math.min(...annonces.map((annonce) => annonce.prixJour));
}

export async function trouverAnnonce(
  villeSlug: string,
  slug: string,
): Promise<AnnonceDetail | null> {
  return (
    listerAnnonces().find(
      (annonce) => annonce.villeSlug === villeSlug && annonce.slug === slug,
    ) ?? null
  );
}

/** Adresses des fiches, pour la pré-génération et le plan de site. */
export async function listerAdressesAnnonces() {
  return listerAnnonces().map(({ villeSlug, slug }) => ({
    ville: villeSlug,
    slug,
  }));
}
