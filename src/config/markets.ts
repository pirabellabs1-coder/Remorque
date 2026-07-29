/**
 * Catalogue des marchés (pays × langue).
 *
 * Section 10 du cadrage : l'expansion n'est pas une phase ultérieure, c'est une
 * contrainte d'architecture. Un « marché » porte une langue, une devise, un
 * préfixe d'adresse et un pays. Les paramètres qui évoluent en exploitation
 * — barème de commission, TVA, assureur, CGV — vivent en base (table `pays`)
 * et sont pilotés depuis l'administration : ce fichier ne contient que ce qui
 * conditionne le routage et le rendu.
 */

export const MARKETS = {
  "fr-FR": {
    country: "FR",
    language: "fr",
    currency: "EUR",
    /** Marché de référence : servi à la racine, sans préfixe. */
    pathPrefix: null,
    enabled: true,
    wave: 1,
  },
  "fr-BE": {
    country: "BE",
    language: "fr",
    currency: "EUR",
    pathPrefix: "/be",
    enabled: false,
    wave: 2,
  },
  "fr-CH": {
    country: "CH",
    language: "fr",
    currency: "CHF",
    pathPrefix: "/ch",
    enabled: false,
    wave: 2,
  },
  "fr-LU": {
    country: "LU",
    language: "fr",
    currency: "EUR",
    pathPrefix: "/lu",
    enabled: false,
    wave: 2,
  },
  "de-DE": {
    country: "DE",
    language: "de",
    currency: "EUR",
    pathPrefix: "/de",
    enabled: false,
    wave: 3,
  },
  "nl-NL": {
    country: "NL",
    language: "nl",
    currency: "EUR",
    pathPrefix: "/nl",
    enabled: false,
    wave: 3,
  },
} as const satisfies Record<string, MarketDefinition>;

export type MarketDefinition = {
  /** Code pays ISO 3166-1 alpha-2. */
  country: string;
  /** Code langue ISO 639-1. */
  language: string;
  /** Devise ISO 4217 — aucun montant n'existe sans sa devise. */
  currency: string;
  /** Préfixe d'adresse ; `null` pour le marché servi à la racine. */
  pathPrefix: string | null;
  /** Un marché désactivé n'est pas routé et n'apparaît pas dans le plan de site. */
  enabled: boolean;
  /** Vague d'ouverture prévue (section 10). */
  wave: 1 | 2 | 3 | 4;
};

export type Market = keyof typeof MARKETS;

export const ALL_MARKETS = Object.keys(MARKETS) as Market[];

/** Seuls les marchés ouverts sont routés. */
export const ENABLED_MARKETS = ALL_MARKETS.filter(
  (market) => MARKETS[market].enabled,
);

/** Marché servi à la racine. */
export const DEFAULT_MARKET: Market = "fr-FR";

export function getMarket(market: Market): MarketDefinition {
  return MARKETS[market];
}

export function isMarket(value: string): value is Market {
  return (ALL_MARKETS as string[]).includes(value);
}
