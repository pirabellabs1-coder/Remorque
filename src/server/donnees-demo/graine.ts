import "server-only";

/**
 * Générateur pseudo-aléatoire déterministe, partagé par tous les jeux d'essai.
 *
 * Il était jusqu'ici recopié dans trois fichiers. Trois copies d'un générateur
 * sont trois occasions de faire diverger les graines, donc de voir un écran
 * afficher des chiffres qu'aucun autre ne confirme.
 *
 * Pourquoi déterministe plutôt que `Math.random()` :
 *
 * 1. Le rendu serveur et l'hydratation client doivent produire exactement le
 *    même arbre. Un tirage libre les fait diverger et React proteste.
 * 2. Une capture d'écran prise aujourd'hui doit montrer les mêmes chiffres
 *    demain, sinon aucun écart n'est diagnosticable.
 * 3. Les tests peuvent porter sur des valeurs, pas seulement sur des formes.
 */

/** Mulberry32 — court, sans dépendance, suffisamment uniforme pour un jeu d'essai. */
export function generateur(graine: number): () => number {
  let etat = graine;
  return () => {
    etat |= 0;
    etat = (etat + 0x6d2b79f5) | 0;
    let resultat = Math.imul(etat ^ (etat >>> 15), 1 | etat);
    resultat =
      (resultat + Math.imul(resultat ^ (resultat >>> 7), 61 | resultat)) ^ resultat;
    return ((resultat ^ (resultat >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Les graines, nommées et réunies.
 *
 * Chaque jeu a la sienne : partager une graine ferait que modifier le nombre
 * de réservations du loueur déplacerait aussi les litiges de l'administration,
 * pour aucune raison compréhensible.
 */
export const GRAINES = {
  activiteLoueur: 20260731,
  administration: 31072026,
  locataire: 20260802,
} as const;

/** Tire un élément d'un tableau. Le tableau ne doit pas être vide. */
export function tirer<T>(hasard: () => number, choix: readonly T[]): T {
  return choix[Math.floor(hasard() * choix.length)];
}

/** Tire un entier dans `[minimum, maximum]`, bornes comprises. */
export function tirerEntier(
  hasard: () => number,
  minimum: number,
  maximum: number,
): number {
  return minimum + Math.floor(hasard() * (maximum - minimum + 1));
}

/**
 * Tire une valeur selon des poids relatifs.
 *
 * Les trois jeux d'essai en avaient chacun leur version, écrite en ligne. La
 * répartition des statuts d'une réservation est le genre de chose que l'on
 * ajuste souvent : mieux vaut une fonction que trois boucles à retrouver.
 */
export function tirerPondere<T>(
  hasard: () => number,
  repartition: readonly { valeur: T; poids: number }[],
): T {
  const total = repartition.reduce((somme, entree) => somme + entree.poids, 0);
  let seuil = hasard() * total;

  for (const entree of repartition) {
    seuil -= entree.poids;
    if (seuil <= 0) return entree.valeur;
  }

  return repartition[repartition.length - 1].valeur;
}

/** Nombre de jours entiers entre deux dates. Négatif si `a` précède `de`. */
export function joursEntre(de: Date, a: Date): number {
  return Math.round((a.getTime() - de.getTime()) / 86_400_000);
}

/** Aujourd'hui, à midi — pour que les décalages de fuseau ne changent pas le jour. */
export function aujourdhui(): Date {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  return date;
}

/** Une date décalée de `nombre` jours, sans muter l'originale. */
export function decalerJours(date: Date, nombre: number): Date {
  const copie = new Date(date);
  copie.setDate(copie.getDate() + nombre);
  return copie;
}
