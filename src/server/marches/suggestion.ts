import "server-only";

import { cookies, headers } from "next/headers";

import {
  ENABLED_MARKETS,
  getMarket,
  isMarket,
  type Market,
} from "@/config/markets";

/**
 * Marché suggéré au visiteur d'après son pays.
 *
 * ─── Pourquoi une suggestion, et non une redirection ──────────────────────
 *
 * Rediriger d'autorité selon l'adresse IP est le moyen le plus sûr de perdre
 * le référencement que ce projet existe pour construire. Les robots explorent
 * depuis les États-Unis : redirigés vers un marché unique, ils n'indexeraient
 * jamais les autres, et les pages locales — 60 à 80 % du trafic attendu,
 * règle 8 — resteraient invisibles.
 *
 * Cela piège aussi des humains parfaitement légitimes : le Belge en
 * déplacement à Lille qui cherche une remorque *à Lille*, ou le Français qui
 * déménage vers Bruxelles. Une adresse IP dit où l'on se trouve, jamais ce
 * que l'on cherche.
 *
 * On propose donc, et l'on mémorise le choix. Le visiteur garde la main ;
 * l'adresse reste celle qu'il a demandée, et le robot voit exactement ce
 * qu'elle contient.
 */

/** Le visiteur a-t-il déjà tranché ? Son choix vaut pour tout le reste. */
export const COOKIE_MARCHE = "marche-choisi";

/**
 * Pays du visiteur, dans l'ordre de fiabilité décroissante.
 *
 * L'en-tête du réseau de diffusion est une géolocalisation réelle ; la langue
 * du navigateur n'en est qu'un indice — « fr-BE » est explicite, « fr » tout
 * seul ne dit rien du pays. On ne devine pas au-delà.
 */
function paysDuVisiteur(enTetes: Headers): string | null {
  const parCdn =
    enTetes.get("x-vercel-ip-country") ??
    enTetes.get("cf-ipcountry") ??
    enTetes.get("x-country-code");

  if (parCdn && /^[A-Za-z]{2}$/.test(parCdn)) return parCdn.toUpperCase();

  const langues = enTetes.get("accept-language") ?? "";
  const avecPays = langues
    .split(",")
    .map((entree) => entree.split(";")[0].trim())
    .find((entree) => /^[a-z]{2}-[A-Z]{2}$/.test(entree));

  return avecPays ? avecPays.split("-")[1] : null;
}

/**
 * Le marché à proposer, ou `null` s'il n'y a rien à proposer.
 *
 * Rien à proposer signifie : le visiteur est déjà au bon endroit, il a déjà
 * choisi, son pays n'est pas ouvert, ou on ne sait pas d'où il vient. Dans le
 * doute, on se tait — un bandeau affiché à tort use davantage qu'il ne sert.
 */
export async function marcheSuggere(marcheCourant: Market): Promise<Market | null> {
  const boite = await cookies();
  if (boite.get(COOKIE_MARCHE)) return null;

  const pays = paysDuVisiteur(await headers());
  if (!pays) return null;

  const correspondant = ENABLED_MARKETS.find(
    (marche) => getMarket(marche).country === pays,
  );

  if (!correspondant || correspondant === marcheCourant) return null;
  return correspondant;
}

/** Enregistre le choix du visiteur, pour ne plus le lui redemander. */
export async function retenirMarche(marche: string): Promise<void> {
  if (!isMarket(marche)) return;

  const boite = await cookies();
  boite.set(COOKIE_MARCHE, marche, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    httpOnly: true,
  });
}
