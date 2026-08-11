/**
 * Géométrie du schéma coté d'une remorque.
 *
 * Le dessin est **calculé depuis les dimensions déjà saisies**, jamais fourni
 * par le propriétaire. Il n'y a donc rien à demander de plus à personne, et
 * aucune annonce ne peut afficher un schéma qui contredit ses propres chiffres.
 *
 * Ce que cela apporte à un locataire : « 3 000 × 1 500 mm » ne se voit pas.
 * Un rectangle aux vraies proportions, lui, se compare d'un coup d'œil à la
 * palette qu'il doit transporter ou à la place dont il dispose devant chez lui.
 *
 * Logique pure : ni React, ni base, ni traduction. Elle rend des coordonnées,
 * l'affichage en fait un dessin vectoriel.
 */

/** Dimensions connues d'une remorque, en millimètres. */
export type Dimensions = {
  longueurMm: number;
  largeurMm: number;
  hauteurMm: number | null;
  nombreEssieux: number;
};

export type Cote = {
  /** Valeur en millimètres, telle qu'elle sera mise en forme à l'affichage. */
  valeurMm: number;
  /** Repère de la cote sur le dessin : A, B, C… */
  repere: string;
};

export type Vue = {
  /** Cadre du dessin, en unités arbitraires. */
  largeurVue: number;
  hauteurVue: number;
  /** Le corps de la remorque, dans ce cadre. */
  corps: { x: number; y: number; largeur: number; hauteur: number };
  cotes: Cote[];
};

/** Marge autour du dessin, pour les flèches et les repères. */
const MARGE = 26;

/** Le plus grand côté du corps, en unités de vue. */
const ETENDUE = 200;

/**
 * Vue de dessus : longueur × largeur, timon vers la gauche.
 *
 * Les proportions sont réelles. C'est tout l'intérêt : une remorque de six
 * mètres doit *paraître* trois fois plus longue qu'une de deux, sans quoi le
 * schéma illustre sans informer.
 */
export function vueDeDessus(dimensions: Dimensions): Vue {
  const { longueurMm, largeurMm } = dimensions;

  const echelle = ETENDUE / Math.max(longueurMm, largeurMm, 1);
  const largeur = longueurMm * echelle;
  const hauteur = largeurMm * echelle;

  return {
    largeurVue: largeur + MARGE * 3,
    hauteurVue: hauteur + MARGE * 2,
    corps: { x: MARGE * 2, y: MARGE, largeur, hauteur },
    cotes: [
      { valeurMm: longueurMm, repere: "A" },
      { valeurMm: largeurMm, repere: "B" },
    ],
  };
}

/**
 * Vue de côté : longueur × hauteur utile, roues au sol.
 *
 * Sans hauteur connue — le cas de tous les plateaux, qui n'en ont pas — la vue
 * n'est pas dessinée du tout. Inventer une hauteur de ridelle pour meubler
 * reviendrait à faire dire au schéma ce que l'annonce ne dit pas.
 */
export function vueDeCote(dimensions: Dimensions): Vue | null {
  const { longueurMm, hauteurMm } = dimensions;
  if (!hauteurMm || hauteurMm <= 0) return null;

  const echelle = ETENDUE / Math.max(longueurMm, hauteurMm, 1);
  const largeur = longueurMm * echelle;
  const hauteur = hauteurMm * echelle;

  return {
    largeurVue: largeur + MARGE * 3,
    hauteurVue: hauteur + MARGE * 2.5,
    corps: { x: MARGE * 2, y: MARGE, largeur, hauteur },
    cotes: [
      { valeurMm: longueurMm, repere: "A" },
      { valeurMm: hauteurMm, repere: "C" },
    ],
  };
}

/**
 * Position des roues sur la vue de côté, en fractions de la longueur.
 *
 * Un essieu se place aux trois cinquièmes de la caisse, deux se répartissent
 * autour de ce point. Ce n'est pas une mesure — nous ne stockons pas
 * l'empattement — mais une convention de dessin, et elle est juste pour
 * l'immense majorité des remorques : l'essieu est toujours en arrière du
 * centre, faute de quoi la flèche au timon serait négative.
 */
export function positionsRoues(nombreEssieux: number): number[] {
  const centre = 0.6;
  const ecart = 0.11;

  if (nombreEssieux <= 1) return [centre];
  if (nombreEssieux === 2) return [centre - ecart / 2, centre + ecart / 2];

  return [centre - ecart, centre, centre + ecart];
}
