"use client";

import { useSyncExternalStore } from "react";

const CLE = "flexitrailer.barre-laterale";

/**
 * Préférence de repli de la barre latérale.
 *
 * Lue par `useSyncExternalStore` plutôt que par un effet qui appellerait
 * `setState` : c'est le primitif prévu pour lire un état extérieur à React.
 * Il fournit un instantané distinct pour le rendu serveur — indispensable ici,
 * puisque le serveur ne connaît pas `localStorage` et qu'un rendu initial
 * divergent provoquerait une erreur d'hydratation.
 */

const abonnes = new Set<() => void>();

function sabonner(rappel: () => void) {
  abonnes.add(rappel);
  // Un second onglet peut modifier la préférence : `storage` prévient.
  window.addEventListener("storage", rappel);
  return () => {
    abonnes.delete(rappel);
    window.removeEventListener("storage", rappel);
  };
}

function lire(): boolean {
  return window.localStorage.getItem(CLE) === "replie";
}

/** Le serveur rend toujours la barre dépliée. */
function lireSurLeServeur(): boolean {
  return false;
}

export function useBarreRepliee(): [boolean, () => void] {
  const replie = useSyncExternalStore(sabonner, lire, lireSurLeServeur);

  const basculer = () => {
    window.localStorage.setItem(CLE, replie ? "deplie" : "replie");
    for (const rappel of abonnes) rappel();
  };

  return [replie, basculer];
}

/**
 * Sommes-nous au-delà du point où la barre est ancrée ?
 *
 * Il faut le savoir en JavaScript et non seulement en CSS, parce que le même
 * bouton doit accomplir deux gestes différents : ouvrir un tiroir sous `lg`,
 * replier une colonne au-delà. Une classe conditionnelle ne peut pas changer
 * ce que fait un `onClick`.
 *
 * `1024px` reprend le point de rupture `lg` de Tailwind. Le nombre est écrit
 * ici parce qu'il n'existe nulle part ailleurs sous forme lisible — et il est
 * accompagné de son nom, pour que celui qui changera l'un pense à l'autre.
 *
 * Comme pour la préférence de repli, `useSyncExternalStore` fournit un
 * instantané serveur distinct : le serveur ne connaît pas la largeur de
 * l'écran, et rendre `true` de son côté provoquerait une divergence
 * d'hydratation à chaque chargement.
 */
const GRAND_ECRAN = "(min-width: 1024px)";

function sabonnerLargeur(rappel: () => void) {
  const requete = window.matchMedia(GRAND_ECRAN);
  requete.addEventListener("change", rappel);
  return () => requete.removeEventListener("change", rappel);
}

function lireLargeur(): boolean {
  return window.matchMedia(GRAND_ECRAN).matches;
}

/** Le serveur suppose le petit écran : c'est le cas le plus fréquent ici. */
function lireLargeurSurLeServeur(): boolean {
  return false;
}

export function useGrandEcran(): boolean {
  return useSyncExternalStore(
    sabonnerLargeur,
    lireLargeur,
    lireLargeurSurLeServeur,
  );
}
