"use server";

import { retenirMarche } from "./suggestion";

/**
 * Le visiteur a tranché : on note son choix et on ne le redemande plus.
 *
 * Retenir le refus autant que l'acceptation est le point important — un
 * bandeau qui reparaît à chaque page est plus agaçant que la mauvaise langue
 * qu'il propose de corriger.
 */
export async function choisirMarche(marche: string): Promise<{ ok: true }> {
  await retenirMarche(marche);
  return { ok: true };
}
