/**
 * Décomposition d'un règlement.
 *
 * Module pur : ni Stripe, ni base, ni réseau. Ce qu'il protège tient en une
 * phrase — **on ne débite jamais un montant qu'on a recalculé**. Le total a été
 * figé à la réservation, avec le barème du jour ; le paiement doit porter ce
 * total-là, au centime. Les lignes affichées au règlement ne sont qu'une
 * présentation, et si leur somme s'écarte du total figé, c'est la présentation
 * qui est fausse : on refuse plutôt que de prélever autre chose.
 *
 * Tous les montants sont des entiers de centimes et portent leur devise
 * (règle 1). Aucune division n'a lieu ici : elle appartient à l'affichage.
 */

export type LigneReglement = {
  /** Clé de traduction du libellé, jamais un texte en dur (règle 3). */
  cle: "loyer" | "fraisService" | "primeAssurance" | "fraisLivraison" | "remise";
  /** Entier de centimes. Négatif pour une remise. */
  montant: number;
};

export type Reglement =
  | { ok: true; lignes: readonly LigneReglement[]; total: number; devise: string }
  | { ok: false; motif: "totalIncoherent" | "totalNul" };

export type MontantsReservation = {
  loyer: number;
  fraisService: number;
  primeAssurance: number;
  fraisLivraison: number;
  remise: number;
  totalLocataire: number;
  devise: string;
};

/**
 * Les lignes du règlement, et la vérification qu'elles disent le même total.
 *
 * L'écart, s'il existe, ne se rattrape pas en ajustant une ligne : il signale
 * qu'une écriture a divergé — un frais ajouté sans mise à jour du total, une
 * remise appliquée deux fois. Le seul geste sûr est de ne pas encaisser.
 */
export function composerReglement(montants: MontantsReservation): Reglement {
  const toutes: readonly LigneReglement[] = [
    { cle: "loyer", montant: montants.loyer },
    { cle: "fraisService", montant: montants.fraisService },
    { cle: "primeAssurance", montant: montants.primeAssurance },
    { cle: "fraisLivraison", montant: montants.fraisLivraison },
    // La remise est portée en positif dans la base et retranchée ici : une
    // ligne négative se lit mieux qu'un total qui ne s'additionne pas.
    { cle: "remise", montant: -montants.remise },
  ];

  const lignes = toutes.filter((ligne) => ligne.montant !== 0);

  const somme = lignes.reduce((total, ligne) => total + ligne.montant, 0);

  if (somme !== montants.totalLocataire) return { ok: false, motif: "totalIncoherent" };
  // Stripe refuse un montant nul, et un règlement à zéro n'a de toute façon
  // rien à encaisser : le dire ici évite un aller-retour pour une erreur.
  if (somme <= 0) return { ok: false, motif: "totalNul" };

  return { ok: true, lignes, total: somme, devise: montants.devise };
}

/**
 * Le montant qu'un prestataire de paiement doit prélever.
 *
 * Distinct de `composerReglement` à dessein : l'appelant qui n'a besoin que du
 * chiffre ne doit pas pouvoir se tromper de champ, et celui qui affiche le
 * détail ne doit pas pouvoir en tirer un total différent.
 */
export function montantAprelever(montants: MontantsReservation): number | null {
  const reglement = composerReglement(montants);
  return reglement.ok ? reglement.total : null;
}
