/**
 * Paramètres du dispositif d'assurance.
 *
 * Le partenaire courtier ou assureur est la décision n° 01 du cadrage, et le
 * chemin critique absolu du projet : deux à quatre mois de négociation. Tant
 * qu'il n'est pas signé, aucun montant de garantie, de plafond ni de franchise
 * ne peut être annoncé publiquement — l'afficher « à titre indicatif » sur une
 * page commerciale reviendrait à s'engager sur des conditions que l'assureur
 * n'a pas validées.
 *
 * Ce fichier isole donc l'intégralité de ce qui dépend du partenaire. La page
 * `/assurance` décrit le mécanisme — qui, lui, est arrêté par l'architecture —
 * et n'affiche les chiffres qu'une fois `PARTENAIRE_CONFIRME` passé à `true`.
 *
 * À l'ouverture d'un second pays, ces valeurs deviendront des colonnes de la
 * table `pays` : « un contrat et des garanties différents selon le pays,
 * gérés en configuration » (M09).
 */

/**
 * Passer à `true` une fois le contrat signé, puis renseigner les valeurs
 * ci-dessous. Les blocs chiffrés de la page apparaîtront automatiquement.
 */
export const PARTENAIRE_CONFIRME = false;

export type GarantiesAssurance = {
  /** Nom commercial du partenaire, affiché publiquement. */
  partenaire: string;
  /** Plafond d'indemnisation par sinistre, en centimes. */
  plafondParSinistre: number;
  /** Franchise standard restant à la charge du locataire, en centimes. */
  franchiseStandard: number;
  /** Délai maximal de déclaration d'un sinistre, en jours ouvrés. */
  delaiDeclarationJours: number;
};

/** Renseigné à la signature du contrat. */
export const GARANTIES: GarantiesAssurance | null = null;

/**
 * Délai de déclaration retenu par défaut dans les parcours produit tant que le
 * contrat n'est pas signé. C'est une contrainte de conception — l'écran de
 * déclaration doit exister et imposer une échéance — et non un engagement
 * contractuel affiché au public.
 */
export const DELAI_DECLARATION_PAR_DEFAUT_JOURS = 5;
