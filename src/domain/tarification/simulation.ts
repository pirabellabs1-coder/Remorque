import { appliquerBp, type BaremePays } from "./devis";

/**
 * Simulateur de revenus propriétaire — page `/mettre-en-location`.
 *
 * Le simulateur ne suppose aucun prix de marché : le propriétaire saisit son
 * propre tarif et sa propre estimation d'occupation. Afficher une moyenne
 * inventée sur une plateforme qui n'a pas encore de catalogue serait une
 * allégation trompeuse, et exposerait la plateforme au titre de l'information
 * précontractuelle (section 11).
 */
export type EntreesSimulation = {
  /** Tarif journalier fixé par le propriétaire, en centimes. */
  prixJour: number;
  /** Nombre de jours loués par mois, estimé par le propriétaire. */
  joursParMois: number;
  bareme: Pick<BaremePays, "commissionProprietaireBp">;
};

export type ResultatSimulation = {
  loyerMensuel: number;
  commissionMensuelle: number;
  netMensuel: number;
  netAnnuel: number;
};

export function simulerRevenus({
  prixJour,
  joursParMois,
  bareme,
}: EntreesSimulation): ResultatSimulation {
  if (!Number.isInteger(prixJour) || prixJour < 0) {
    throw new Error("Le tarif journalier doit être un entier de centimes positif.");
  }
  if (!Number.isInteger(joursParMois) || joursParMois < 0 || joursParMois > 31) {
    throw new Error("Le nombre de jours loués par mois doit être compris entre 0 et 31.");
  }

  const loyerMensuel = prixJour * joursParMois;
  const commissionMensuelle = appliquerBp(
    loyerMensuel,
    bareme.commissionProprietaireBp,
  );
  const netMensuel = loyerMensuel - commissionMensuelle;

  return {
    loyerMensuel,
    commissionMensuelle,
    netMensuel,
    // Calculé sur le net mensuel, et non sur douze commissions arrondies
    // séparément : l'écart d'arrondi resterait invisible mais serait faux.
    netAnnuel: netMensuel * 12,
  };
}
