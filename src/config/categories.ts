/**
 * Catalogue des catégories de matériel — section 4.1 du cadrage.
 *
 * Source unique : ce fichier amorce la table `categorie` (`npm run db:seed`)
 * et alimente les pages éditoriales. En exploitation, l'arborescence est
 * modifiable depuis l'administration (M18) et c'est la base qui fait foi.
 *
 * `usages` décrit ce que l'on transporte réellement avec chaque type de
 * matériel : c'est le vocabulaire des visiteurs, pas celui du catalogue, et
 * c'est ce qui capte les recherches de longue traîne.
 */
export type DefinitionCategorie = {
  slug: string;
  nom: string;
  usages: string;
  /** Un relevé kilométrique est-il exigé aux états des lieux (M08) ? */
  releveKilometrique: boolean;
};

export const CATEGORIES = [
  {
    slug: "remorque-benne",
    nom: "Remorque benne",
    usages: "Gravats, terre, déchets verts, débarras",
    releveKilometrique: false,
  },
  {
    slug: "remorque-plateau",
    nom: "Remorque plateau",
    usages: "Matériaux longs, palettes, mobilier volumineux",
    releveKilometrique: false,
  },
  {
    slug: "porte-voiture",
    nom: "Porte-voiture",
    usages: "Véhicule en panne, voiture de collection, transfert",
    releveKilometrique: false,
  },
  {
    slug: "remorque-bagagere",
    nom: "Remorque bagagère",
    usages: "Déménagement, vacances, cartons et meubles",
    releveKilometrique: false,
  },
  {
    slug: "van-a-chevaux",
    nom: "Van à chevaux",
    usages: "Concours, transhumance, transport équin",
    releveKilometrique: false,
  },
  {
    slug: "porte-bateau",
    nom: "Porte-bateau",
    usages: "Mise à l'eau, hivernage, transport de coque",
    releveKilometrique: false,
  },
  {
    slug: "porte-moto",
    nom: "Porte-moto",
    usages: "Circuit, rassemblement, moto immobilisée",
    releveKilometrique: false,
  },
  {
    slug: "remorque-frigorifique",
    nom: "Remorque frigorifique",
    usages: "Traiteur, événement, produits frais",
    releveKilometrique: false,
  },
  {
    slug: "nacelle-et-materiel-chantier",
    nom: "Nacelle et matériel de chantier",
    usages: "Travaux en hauteur, ravalement, élagage",
    releveKilometrique: true,
  },
  {
    slug: "utilitaire",
    nom: "Utilitaire",
    usages: "Déménagement complet, livraison, transport de volume",
    releveKilometrique: true,
  },
] as const satisfies readonly DefinitionCategorie[];

export type SlugCategorie = (typeof CATEGORIES)[number]["slug"];
