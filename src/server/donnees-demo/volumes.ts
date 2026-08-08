import "server-only";

import type { StatutReservation } from "@/domain/reservation/machine";

/**
 * Les volumes et les répartitions des jeux d'essai.
 *
 * Réunis ici parce que ce sont les seuls nombres qu'on ajuste réellement : « et
 * si l'on avait deux fois plus de litiges ? », « à quoi ressemble l'écran avec
 * une seule réservation ? ». Les chercher dans quatre fichiers décourageait de
 * les essayer, ce qui revenait à ne jamais recetter les cas limites.
 */

/** Combien d'enregistrements chaque jeu produit. */
export const VOLUMES = {
  /** Locations dotées d'un constat de départ et de retour. */
  etatsDesLieux: 20,

  /** Fils de discussion amorcés. Au-delà, la liste ne se parcourt plus. */
  conversations: 12,
  /** Réservations vues du loueur, réparties sur quatorze mois. */
  reservationsLoueur: 140,
  /**
   * Réservations vues du locataire, sur deux ans.
   *
   * Dix-huit, et non cent quarante : personne ne loue une remorque par
   * semaine. Un historique invraisemblable rend l'écran impossible à juger.
   */
  reservationsLocataire: 18,
  utilisateurs: 220,
  litiges: 14,
  sinistres: 6,
  tickets: 18,
  entreesAudit: 60,
  favoris: 7,
} as const;

/** Fenêtre de dépôt d'un avis après la fin de la location, en jours. */
export const FENETRE_AVIS_JOURS = 14;

/**
 * Répartition des statuts, vue du loueur.
 *
 * Volontairement réaliste : une place de marché saine a une écrasante majorité
 * de locations closes, une poignée en cours, et quelques refus. Un jeu d'essai
 * où tout est « clôturé » ne permet de dessiner aucun des écrans qui comptent.
 */
export const REPARTITION_LOUEUR: readonly {
  valeur: StatutReservation;
  poids: number;
}[] = [
  { valeur: "cloturee", poids: 46 },
  { valeur: "confirmee", poids: 14 },
  { valeur: "en_cours", poids: 5 },
  { valeur: "payee", poids: 8 },
  { valeur: "demandee", poids: 9 },
  { valeur: "acceptee", poids: 5 },
  { valeur: "restituee", poids: 4 },
  { valeur: "annulee", poids: 5 },
  { valeur: "refusee", poids: 3 },
  { valeur: "expiree", poids: 1 },
];

/**
 * Répartition des statuts, vue du locataire.
 *
 * Elle diffère de celle du loueur, et ce n'est pas un oubli : un locataire
 * essuie rarement un refus — il fait peu de demandes, et les mène à leur terme.
 * Le loueur, lui, en refuse une part non négligeable. Reprendre la même
 * répartition des deux côtés donnerait un espace locataire jonché de refus que
 * personne ne connaît dans la vraie vie.
 */
export const REPARTITION_LOCATAIRE: readonly {
  valeur: StatutReservation;
  poids: number;
}[] = [
  { valeur: "cloturee", poids: 52 },
  { valeur: "confirmee", poids: 15 },
  { valeur: "en_cours", poids: 4 },
  { valeur: "payee", poids: 8 },
  { valeur: "demandee", poids: 8 },
  { valeur: "acceptee", poids: 4 },
  { valeur: "restituee", poids: 4 },
  { valeur: "annulee", poids: 3 },
  { valeur: "refusee", poids: 2 },
];

/**
 * Statuts retenus pour le chiffre d'affaires.
 *
 * Une seule définition, partagée par l'espace loueur, l'espace locataire et
 * l'administration. Elle existait en trois exemplaires : le jour où l'un
 * incluait « restituée » et l'autre non, deux écrans annonçaient deux chiffres
 * d'affaires différents pour le même mois, et rien ne disait lequel croire.
 */
export const STATUTS_ENCAISSES: readonly StatutReservation[] = [
  "payee",
  "confirmee",
  "en_cours",
  "restituee",
  "cloturee",
];
