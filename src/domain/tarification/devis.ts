/**
 * Décomposition financière d'une réservation — section 02 du cadrage.
 *
 * Tous les montants sont des entiers en centimes. Aucun taux n'est écrit en
 * dur : les barèmes viennent de la configuration du pays, elle-même pilotée
 * depuis l'espace super administrateur.
 */

/** Points de base : 1 % = 100 bp. Évite tout flottant dans les taux. */
export type PointsDeBase = number;

export type BaremePays = {
  commissionLocataireBp: PointsDeBase;
  commissionProprietaireBp: PointsDeBase;
};

export type OptionsDevis = {
  /** Prix affiché par jour, en centimes. */
  prixJour: number;
  nombreJours: number;
  /** Remise de dégressivité, en points de base appliqués au loyer. */
  remiseBp?: PointsDeBase;
  /** Prime d'assurance, en centimes — poste facturé au locataire (M09). */
  primeAssurance?: number;
  fraisLivraison?: number;
  /** Remise commerciale ou code promotionnel, en centimes. */
  remiseCommerciale?: number;
  bareme: BaremePays;
};

export type Devis = {
  loyer: number;
  remiseDegressivite: number;
  fraisService: number;
  primeAssurance: number;
  fraisLivraison: number;
  remiseCommerciale: number;
  /** Ce que le locataire règle réellement. */
  totalLocataire: number;
  commissionProprietaire: number;
  /** Ce qui part sur le compte bancaire du propriétaire. */
  montantReverse: number;
  /** Commissions encaissées par la plateforme, hors marge d'assurance. */
  revenuPlateforme: number;
};

/**
 * Applique un taux exprimé en points de base.
 *
 * Arrondi au centime le plus proche, à mi-chemin vers le haut. Une règle
 * d'arrondi unique et explicite évite les écarts d'un centime entre le
 * récapitulatif affiché, la facture et le rapprochement comptable.
 */
export function appliquerBp(montant: number, bp: PointsDeBase): number {
  return Math.round((montant * bp) / 10_000);
}

export function calculerDevis(options: OptionsDevis): Devis {
  const {
    prixJour,
    nombreJours,
    remiseBp = 0,
    primeAssurance = 0,
    fraisLivraison = 0,
    remiseCommerciale = 0,
    bareme,
  } = options;

  if (!Number.isInteger(prixJour) || prixJour < 0) {
    throw new Error("Le prix journalier doit être un entier de centimes positif.");
  }
  if (!Number.isInteger(nombreJours) || nombreJours < 1) {
    throw new Error("Une location porte sur au moins une journée.");
  }

  const loyerBrut = prixJour * nombreJours;
  const remiseDegressivite = appliquerBp(loyerBrut, remiseBp);
  const loyer = loyerBrut - remiseDegressivite;

  // Les frais de service et la commission portent sur le loyer net de
  // dégressivité, jamais sur l'assurance ni sur la livraison.
  const fraisService = appliquerBp(loyer, bareme.commissionLocataireBp);
  const commissionProprietaire = appliquerBp(
    loyer,
    bareme.commissionProprietaireBp,
  );

  const totalLocataire = Math.max(
    0,
    loyer + fraisService + primeAssurance + fraisLivraison - remiseCommerciale,
  );

  // Le geste commercial est supporté par la plateforme, pas par le
  // propriétaire : son reversement reste inchangé.
  const montantReverse = loyer + fraisLivraison - commissionProprietaire;

  return {
    loyer,
    remiseDegressivite,
    fraisService,
    primeAssurance,
    fraisLivraison,
    remiseCommerciale,
    totalLocataire,
    commissionProprietaire,
    montantReverse,
    revenuPlateforme: fraisService + commissionProprietaire - remiseCommerciale,
  };
}
