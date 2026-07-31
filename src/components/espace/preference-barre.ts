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
