import { defineRouting } from "next-intl/routing";

import {
  DEFAULT_MARKET,
  ENABLED_MARKETS,
  MARKETS,
  type Market,
} from "@/config/markets";

const prefixes = Object.fromEntries(
  ENABLED_MARKETS.filter((market) => MARKETS[market].pathPrefix !== null).map(
    (market) => [market, MARKETS[market].pathPrefix as string],
  ),
) as Record<Market, string>;

/**
 * Adresses internes → adresses publiques.
 *
 * Section 04 : les adresses sont données en français, elles seront traduites
 * et adaptées pour chaque pays ouvert. Tant qu'un seul marché est routé, une
 * chaîne unique suffit ; à l'ouverture d'un marché d'une autre langue, chaque
 * entrée devient un objet `{ 'fr-FR': '/recherche', 'de-DE': '/suche' }`.
 * Les adresses localisées sont une condition du référencement local — elles
 * ne doivent jamais être remplacées par un simple préfixe de langue.
 */
export const pathnames = {
  "/": "/",
  "/recherche": "/recherche",
  "/categories": "/categories",
  "/categories/[categorie]": "/categories/[categorie]",
  "/remorque/[ville]/[slug]": "/remorque/[ville]/[slug]",
  "/location-remorque/[ville]": "/location-remorque/[ville]",
  "/location-remorque/[ville]/[type]": "/location-remorque/[ville]/[type]",
  "/mettre-en-location": "/mettre-en-location",
  "/assurance": "/assurance",
  "/comment-ca-marche": "/comment-ca-marche",
  "/comment-ca-marche/louer": "/comment-ca-marche/louer",
  "/comment-ca-marche/mettre-en-location":
    "/comment-ca-marche/mettre-en-location",
  "/tarifs": "/tarifs",
  "/pro": "/pro",
  "/quel-permis-pour-quelle-remorque": "/quel-permis-pour-quelle-remorque",
  "/calculateur-de-charge": "/calculateur-de-charge",
  "/aide": "/aide",
  "/blog": "/blog",
  "/blog/[slug]": "/blog/[slug]",
  "/avis": "/avis",
  "/a-propos": "/a-propos",
  "/contact": "/contact",
  "/recrutement": "/recrutement",
  "/connexion": "/connexion",
  "/inscription": "/inscription",
  "/mot-de-passe-oublie": "/mot-de-passe-oublie",
  "/cgu": "/cgu",
  "/cgv": "/cgv",
  "/confidentialite": "/confidentialite",
  "/cookies": "/cookies",
  "/mentions-legales": "/mentions-legales",
  "/mediation": "/mediation",
  "/plan-du-site": "/plan-du-site",
} as const;

export const routing = defineRouting({
  locales: ENABLED_MARKETS,
  defaultLocale: DEFAULT_MARKET,
  localePrefix: { mode: "as-needed", prefixes },
  localeDetection: false,
  pathnames,
});
