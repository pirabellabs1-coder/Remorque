/**
 * Liste de contrôle de l'état des lieux.
 *
 * Elle vit dans le domaine parce qu'elle **est** la règle métier : un constat
 * n'a de valeur probante que si les deux parties ont examiné les mêmes points,
 * dans le même ordre, au départ comme au retour. Une liste différente d'un
 * écran à l'autre rendrait les deux constats incomparables — et c'est leur
 * comparaison qui tranche un litige.
 *
 * L'ordre est celui du tour du matériel sur le terrain : on commence par ce
 * qui se voit de loin, on finit par ce qui demande de se pencher.
 */
export const POINTS_CONTROLE = [
  "feux",
  "pneus",
  "attelage",
  "chassis",
  "baches",
] as const;

export type PointControle = (typeof POINTS_CONTROLE)[number];

/**
 * Un constat porte réserve dès qu'un point est en défaut.
 *
 * C'est la définition, pas une convention d'affichage : une réserve au retour
 * qui n'existait pas au départ est exactement ce qui ouvre un dossier.
 */
export function porteReserve(controles: Record<string, unknown>): boolean {
  return Object.values(controles).some((valeur) => valeur === false);
}
