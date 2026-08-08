import "server-only";

import { sql, type SQL } from "drizzle-orm";
import { getLocale } from "next-intl/server";

import { getMarket, isMarket, DEFAULT_MARKET, type Market } from "@/config/markets";
import { annonce } from "@/server/db/schema";

/**
 * Cloisonnement du catalogue par marché — règle 7.
 *
 * « Toute entité publiée porte son pays. » Elle le portait ; personne ne le
 * lisait. Le marché français servait donc les remorques de Bruxelles, d'Anvers
 * et de Liège — une annonce qu'un visiteur français ne peut ni atteindre en une
 * heure de route, ni louer sous le barème qu'il voit affiché.
 *
 * La condition est **déduite de la requête en cours**, jamais passée en
 * paramètre. Un appelant peut oublier un argument ; il ne peut pas oublier le
 * marché dans lequel il se trouve. C'est le même raisonnement que pour les
 * gardes d'accès : la règle vit dans la lecture, pas chez celui qui lit.
 */

/** Le marché de la requête en cours, avec repli sur le marché de référence. */
export async function marcheCourant(): Promise<Market> {
  const locale = await getLocale();
  return isMarket(locale) ? locale : DEFAULT_MARKET;
}

/** Code pays ISO du marché donné. */
export function paysDuMarche(marche: Market): string {
  return getMarket(marche).country;
}

/**
 * Condition SQL restreignant les annonces au pays du marché.
 *
 * Sous-requête plutôt que jointure : les appelants ont déjà quatre jointures
 * et des colonnes calculées, et en ajouter une changerait la cardinalité de
 * requêtes délicates pour une comparaison sur deux caractères.
 */
export async function annonceDuMarche(): Promise<SQL> {
  const code = paysDuMarche(await marcheCourant());

  return sql`${annonce.paysId} in (
    select p.id from pays p where p.code = ${code}
  )`;
}
