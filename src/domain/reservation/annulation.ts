/**
 * Remboursement d'une annulation (M05).
 *
 * Module pur : il calcule ce que l'annulation rend au locataire, sans savoir
 * l'écrire. Le barème est celui que les conditions générales promettent — ce
 * fichier n'invente rien, il exécute un contrat :
 *
 *  - **souple** : remboursement intégral du loyer jusqu'à vingt-quatre heures
 *    avant le départ, rien ensuite.
 *  - **modérée** : intégral jusqu'à trois jours avant le départ, puis de
 *    moitié.
 *  - **stricte** : de moitié jusqu'à sept jours avant le départ, rien ensuite.
 *
 * Le barème ne s'applique qu'au **loyer** — et au locataire qui se dédit.
 * Les frais de service ne sont rendus que si le propriétaire annule, ou si la
 * plateforme annule pour lui : c'est sa défaillance, pas celle du locataire.
 * L'assurance et la livraison, prestations jamais consommées quand la
 * location n'a pas lieu, sont toujours rendues : les facturer serait vendre
 * un service qui n'a pas existé.
 *
 * Tous les montants sont des entiers de centimes — règle 1. Les taux du
 * barème sont en points de base, comme partout.
 */

export type PolitiqueAnnulation = "souple" | "moderee" | "stricte";

export type AnnulePar =
  | "locataire"
  | "proprietaire"
  | "administrateur"
  | "systeme";

/** Seuils et taux du barème contractuel, par politique. */
export const BAREME_ANNULATION: Record<
  PolitiqueAnnulation,
  { seuilHeures: number; avantBp: number; apresBp: number }
> = {
  souple: { seuilHeures: 24, avantBp: 10000, apresBp: 0 },
  moderee: { seuilHeures: 72, avantBp: 10000, apresBp: 5000 },
  stricte: { seuilHeures: 168, avantBp: 5000, apresBp: 0 },
};

export type RemboursementAnnulation = {
  /** Part du loyer rendue au locataire, en centimes. */
  loyer: number;
  /** Frais de service rendus, en centimes. */
  fraisService: number;
  /** Prestations non consommées — assurance et livraison —, en centimes. */
  prestations: number;
  /** Somme des trois : ce que le locataire récupère. */
  total: number;
  /** Part du loyer que le propriétaire conserve, en centimes. */
  loyerConserve: number;
};

export function remboursementAnnulation(entree: {
  politique: PolitiqueAnnulation;
  annulePar: AnnulePar;
  /** Heures entre l'annulation et le début de la location. Négatif : départ passé. */
  heuresAvantDebut: number;
  /** Montants de la réservation, en centimes. */
  loyer: number;
  remise: number;
  fraisService: number;
  primeAssurance: number;
  fraisLivraison: number;
}): RemboursementAnnulation {
  // La remise avait réduit ce que le locataire a payé : le remboursement se
  // calcule sur le loyer réellement versé, pas sur le tarif affiché.
  const loyerNet = Math.max(0, Math.floor(entree.loyer) - Math.max(0, Math.floor(entree.remise)));
  const fraisService = Math.max(0, Math.floor(entree.fraisService));
  const prestations =
    Math.max(0, Math.floor(entree.primeAssurance)) +
    Math.max(0, Math.floor(entree.fraisLivraison));

  // Le propriétaire qui annule — ou la plateforme qui annule à sa place —
  // rend tout : le locataire n'a pas à payer la défaillance d'autrui.
  if (entree.annulePar === "proprietaire" || entree.annulePar === "administrateur") {
    return {
      loyer: loyerNet,
      fraisService,
      prestations,
      total: loyerNet + fraisService + prestations,
      loyerConserve: 0,
    };
  }

  // Le système n'annule qu'un paiement jamais abouti : rien n'a été encaissé,
  // rien n'est à rendre.
  if (entree.annulePar === "systeme") {
    return { loyer: 0, fraisService: 0, prestations: 0, total: 0, loyerConserve: loyerNet };
  }

  const bareme = BAREME_ANNULATION[entree.politique];
  const tauxBp =
    entree.heuresAvantDebut >= bareme.seuilHeures ? bareme.avantBp : bareme.apresBp;

  const loyerRendu = Math.round((loyerNet * tauxBp) / 10000);

  return {
    loyer: loyerRendu,
    fraisService: 0,
    prestations,
    total: loyerRendu + prestations,
    loyerConserve: loyerNet - loyerRendu,
  };
}
