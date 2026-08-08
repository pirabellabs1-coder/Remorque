/**
 * Marché simulé pour les tests d'intégration.
 *
 * Le catalogue public est désormais borné au pays du marché servi — règle 7 —
 * et le marché se lit dans la requête en cours, par `getLocale`. Or les tests
 * s'exécutent là où il n'y a pas de requête : sept d'entre eux sont tombés
 * d'un coup, non parce qu'ils étaient faux, mais parce qu'ils n'ont pas de
 * marché courant à lire.
 *
 * Faire tolérer l'absence de requête à `marcheCourant` en repliant sur le
 * marché de référence aurait rendu les tests verts et vides : les huit annonces
 * de la démonstration sont belges, un repli français les aurait toutes
 * écartées, et les vérifications de cohérence n'auraient plus rien comparé.
 *
 * On remplace donc le module de marché au banc d'essai, et lui seul, par le
 * marché de la démonstration. C'est le pendant exact de `test/session.ts` :
 * les tests s'exécutent au nom d'un compte réel, et sur le marché où ce compte
 * loue réellement.
 */
import { sql, type SQL } from "drizzle-orm";

import { getMarket, type Market } from "@/config/markets";
import { annonce } from "@/server/db/schema";

/** Le marché du catalogue de démonstration : la Belgique. */
export const MARCHE_DEMO: Market = "fr-BE";

export async function marcheCourant(): Promise<Market> {
  return MARCHE_DEMO;
}

export function paysDuMarche(marche: Market): string {
  return getMarket(marche).country;
}

export async function annonceDuMarche(): Promise<SQL> {
  const code = paysDuMarche(await marcheCourant());

  return sql`${annonce.paysId} in (
    select p.id from pays p where p.code = ${code}
  )`;
}
