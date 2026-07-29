/**
 * Moteur de compatibilité permis et véhicule.
 *
 * Section 4.3 — « le détail qui change tout » : afficher sur chaque annonce si
 * le locataire peut légalement et physiquement tracter le matériel. C'est à la
 * fois un filtre de recherche (M03), un argument de réassurance et une
 * protection juridique pour la plateforme (section 11).
 *
 * Deux contraintes indépendantes, à ne jamais confondre :
 *  - la contrainte **légale** dépend du permis détenu et des masses ;
 *  - la contrainte **physique** dépend de la capacité de traction du véhicule
 *    et de la compatibilité d'attelage.
 *
 * Les seuils sont ceux du barème français. La réglementation des remorques
 * varie d'un pays à l'autre (section 10) : à l'ouverture d'un nouveau marché,
 * un barème par pays viendra remplacer la constante `BAREME_FR`, sans toucher
 * à la logique ci-dessous.
 */

export type CategoriePermis = "B" | "B96" | "BE";

export type Vehicule = {
  /** Poids total autorisé en charge du véhicule tracteur, en kilogrammes. */
  ptacKg: number;
  /** Masses tractables constructeur, en kilogrammes. */
  tractableFreineKg: number;
  tractableNonFreineKg: number;
  typeAttelage?: string | null;
  faisceauBroches?: number | null;
};

export type Materiel = {
  /** Poids total autorisé en charge de la remorque, en kilogrammes. */
  ptacKg: number;
  freinee: boolean;
  typeAttelage?: string | null;
  faisceauBroches?: number | null;
  adaptateurFourni?: boolean;
};

export const BAREME_FR = {
  /** Au-delà, la remorque doit être freinée. */
  seuilRemorqueFreineeKg: 750,
  /** Permis B : somme des PTAC autorisée. */
  plafondEnsembleB: 3_500,
  /** Permis B96 : somme des PTAC autorisée. */
  plafondEnsembleB96: 4_250,
  /** Permis BE : somme des PTAC autorisée, et PTAC maximal de la remorque. */
  plafondEnsembleBE: 7_000,
  plafondRemorqueBE: 3_500,
} as const;

export type Verdict = {
  /** Le locataire a-t-il le droit de tracter ce matériel ? */
  legale: boolean;
  /** Son véhicule en est-il physiquement capable ? */
  physique: boolean;
  /** Vrai seulement si les deux conditions sont réunies. */
  compatible: boolean;
  /** Catégorie minimale requise, indépendamment de ce que détient l'usager. */
  permisRequis: CategoriePermis | null;
  /** Messages destinés à l'affichage, dans l'ordre d'importance. */
  motifs: string[];
  /** Signalements n'empêchant pas la location. */
  avertissements: string[];
};

/** Catégorie de permis minimale pour un ensemble donné. */
export function permisRequis(
  vehicule: Vehicule,
  materiel: Materiel,
  bareme = BAREME_FR,
): CategoriePermis | null {
  const ensemble = vehicule.ptacKg + materiel.ptacKg;

  // Une remorque légère reste accessible au permis B tant que le véhicule
  // lui-même n'excède pas le plafond.
  if (
    materiel.ptacKg <= bareme.seuilRemorqueFreineeKg &&
    vehicule.ptacKg <= bareme.plafondEnsembleB
  ) {
    return "B";
  }

  if (ensemble <= bareme.plafondEnsembleB) return "B";
  if (ensemble <= bareme.plafondEnsembleB96) return "B96";
  if (
    ensemble <= bareme.plafondEnsembleBE &&
    materiel.ptacKg <= bareme.plafondRemorqueBE
  ) {
    return "BE";
  }

  // Au-delà, l'ensemble relève du transport de marchandises : hors périmètre.
  return null;
}

const ORDRE_PERMIS: CategoriePermis[] = ["B", "B96", "BE"];

function detient(
  categories: readonly CategoriePermis[],
  requis: CategoriePermis,
): boolean {
  const rangRequis = ORDRE_PERMIS.indexOf(requis);
  return categories.some(
    (categorie) => ORDRE_PERMIS.indexOf(categorie) >= rangRequis,
  );
}

export function evaluerCompatibilite(
  vehicule: Vehicule,
  materiel: Materiel,
  permisDetenus: readonly CategoriePermis[],
  bareme = BAREME_FR,
): Verdict {
  const motifs: string[] = [];
  const avertissements: string[] = [];

  const requis = permisRequis(vehicule, materiel, bareme);
  let legale = true;

  if (requis === null) {
    legale = false;
    motifs.push(
      "L'ensemble dépasse les masses autorisées par un permis de tourisme.",
    );
  } else if (!detient(permisDetenus, requis)) {
    legale = false;
    motifs.push(`Ce matériel demande le permis ${requis}.`);
  }

  // Contrainte physique : masse tractable constructeur.
  const tractable = materiel.freinee
    ? vehicule.tractableFreineKg
    : vehicule.tractableNonFreineKg;
  let physique = true;

  if (materiel.ptacKg > tractable) {
    physique = false;
    motifs.push(
      `Votre véhicule ne peut tracter que ${tractable} kg ${
        materiel.freinee ? "freinés" : "non freinés"
      } ; ce matériel affiche ${materiel.ptacKg} kg.`,
    );
  }

  if (
    materiel.ptacKg > bareme.seuilRemorqueFreineeKg &&
    !materiel.freinee
  ) {
    physique = false;
    motifs.push(
      `Au-delà de ${bareme.seuilRemorqueFreineeKg} kg, la remorque doit être freinée.`,
    );
  }

  // Attelage : bloquant seulement si aucun adaptateur n'est fourni.
  if (
    vehicule.typeAttelage &&
    materiel.typeAttelage &&
    vehicule.typeAttelage !== materiel.typeAttelage &&
    !materiel.adaptateurFourni
  ) {
    physique = false;
    motifs.push(
      `Attelage incompatible : votre véhicule est équipé en « ${vehicule.typeAttelage} », le matériel demande « ${materiel.typeAttelage} ».`,
    );
  }

  if (
    vehicule.faisceauBroches &&
    materiel.faisceauBroches &&
    vehicule.faisceauBroches !== materiel.faisceauBroches
  ) {
    if (materiel.adaptateurFourni) {
      avertissements.push(
        `Faisceau ${materiel.faisceauBroches} broches contre ${vehicule.faisceauBroches} sur votre véhicule : un adaptateur est fourni.`,
      );
    } else {
      avertissements.push(
        `Faisceau ${materiel.faisceauBroches} broches contre ${vehicule.faisceauBroches} sur votre véhicule : prévoyez un adaptateur.`,
      );
    }
  }

  return {
    legale,
    physique,
    compatible: legale && physique,
    permisRequis: requis,
    motifs,
    avertissements,
  };
}
