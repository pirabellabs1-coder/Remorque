/**
 * Barèmes par défaut du pays de lancement.
 *
 * Ces valeurs servent à deux choses, et à rien d'autre : amorcer la table
 * `pays` (`npm run db:seed`) et alimenter les pages éditoriales qui doivent
 * afficher les frais avant que la base ne soit interrogée.
 *
 * **La source de vérité en exploitation reste la table `pays`**, pilotable
 * depuis l'espace super administrateur (section 05). Aucun calcul de
 * réservation ne doit lire ce fichier : il lirait un barème potentiellement
 * périmé.
 *
 * Ce sont des valeurs indicatives issues de la section 02, à arbitrer lors de
 * l'atelier de cadrage — décision n° 03.
 */
export const BAREME_PAR_DEFAUT = {
  /** Frais de service ajoutés au prix affiché, payés par le locataire. */
  commissionLocataireBp: 1_200,
  /** Retenue sur le montant reversé au propriétaire. */
  commissionProprietaireBp: 800,
  /** TVA applicable à la commission. */
  tvaCommissionBp: 2_000,

  /** Encadrement de la caution fixée par le propriétaire, en centimes. */
  cautionMinimum: 20_000,
  cautionMaximum: 150_000,
  /** Délai de libération après restitution sans incident. */
  cautionLiberationHeures: 72,
} as const;

/** Exemple chiffré affiché sur la page des tarifs — section 02 du cadrage. */
export const EXEMPLE_TARIFS = {
  prixJour: 3_500,
  nombreJours: 4,
  primeAssurance: 1_800,
  caution: 40_000,
} as const;
