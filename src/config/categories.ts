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
  /** Photographie de la catégorie, servie depuis `public/images`. */
  photo: string;
  /**
   * Texte alternatif de la photographie. Rédigé un par un, jamais généré par
   * gabarit : un gabarit produirait de faux accords (« utilitaire attelée »)
   * et décrirait mal ce que montre réellement l'image.
   */
  alt: string;
  /** Un relevé kilométrique est-il exigé aux états des lieux (M08) ? */
  releveKilometrique: boolean;
};

export const CATEGORIES = [
  {
    slug: "remorque-benne",
    photo: "/images/remorque-benne.webp",
    alt: "Remorque benne galvanisée à ridelles hautes, chargée de gravats et de déchets verts",
    nom: "Remorque benne",
    usages: "Gravats, terre, déchets verts, débarras",
    releveKilometrique: false,
  },
  {
    slug: "remorque-plateau",
    photo: "/images/remorque-plateau.webp",
    alt: "Remorque plateau à ridelles basses, plancher bois vide, stationnée sur une cour pavée",
    nom: "Remorque plateau",
    usages: "Matériaux longs, palettes, mobilier volumineux",
    releveKilometrique: false,
  },
  {
    slug: "porte-voiture",
    photo: "/images/porte-voiture.webp",
    alt: "Porte-voiture à double essieu, une citadine grise sanglée sur le plateau",
    nom: "Porte-voiture",
    usages: "Véhicule en panne, voiture de collection, transfert",
    releveKilometrique: false,
  },
  {
    slug: "remorque-bagagere",
    photo: "/images/remorque-bagagere.webp",
    alt: "Petite remorque bagagère fermée à couvercle blanc, dans une allée résidentielle",
    nom: "Remorque bagagère",
    usages: "Déménagement, vacances, cartons et meubles",
    releveKilometrique: false,
  },
  {
    slug: "van-a-chevaux",
    photo: "/images/van-a-chevaux.webp",
    alt: "Van à chevaux blanc à deux places, pont arrière relevé, en bordure de paddock",
    nom: "Van à chevaux",
    usages: "Concours, transhumance, transport équin",
    releveKilometrique: false,
  },
  {
    slug: "porte-bateau",
    photo: "/images/porte-bateau.webp",
    alt: "Porte-bateau galvanisé supportant un petit bateau à moteur blanc, sur une cale de mise à l'eau",
    nom: "Porte-bateau",
    usages: "Mise à l'eau, hivernage, transport de coque",
    releveKilometrique: false,
  },
  {
    slug: "porte-moto",
    photo: "/images/porte-moto.webp",
    alt: "Porte-moto à essieu unique avec rampe de chargement, une moto sportive sanglée",
    nom: "Porte-moto",
    usages: "Circuit, rassemblement, moto immobilisée",
    releveKilometrique: false,
  },
  {
    slug: "remorque-frigorifique",
    photo: "/images/remorque-frigorifique.webp",
    alt: "Remorque frigorifique blanche à porte inox, groupe de froid en toiture",
    nom: "Remorque frigorifique",
    usages: "Traiteur, événement, produits frais",
    releveKilometrique: false,
  },
  {
    slug: "nacelle-et-materiel-chantier",
    photo: "/images/nacelle-et-materiel-chantier.webp",
    alt: "Nacelle élévatrice compacte sur châssis remorquable, stabilisateurs repliés",
    nom: "Nacelle et matériel de chantier",
    usages: "Travaux en hauteur, ravalement, élagage",
    releveKilometrique: true,
  },
  {
    slug: "utilitaire",
    photo: "/images/utilitaire.webp",
    alt: "Fourgon utilitaire blanc portes arrière ouvertes sur un volume de chargement vide",
    nom: "Utilitaire",
    usages: "Déménagement complet, livraison, transport de volume",
    releveKilometrique: true,
  },
] as const satisfies readonly DefinitionCategorie[];

export type SlugCategorie = (typeof CATEGORIES)[number]["slug"];
