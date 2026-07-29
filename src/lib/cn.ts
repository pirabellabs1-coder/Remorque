type Classe = string | false | null | undefined;

/** Concatène des classes conditionnelles. */
export function cn(...classes: Classe[]): string {
  return classes.filter(Boolean).join(" ");
}

/**
 * Options d'affichage d'un prix mis en avant.
 *
 * Les centimes ne sont montrés que s'ils existent : « 35 € » se lit mieux que
 * « 35,00 € » sur un prix d'appel, mais arrondir « 34,50 € » à « 35 € » serait
 * un prix faux.
 */
export const PRIX_AFFICHE = {
  style: "currency",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
} as const;
