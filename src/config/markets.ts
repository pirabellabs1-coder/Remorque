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
  /**
   * Ouvert : c'est le marché que le client a demandé en tête (section 10, et
   * ordre du tableau `PAYS` dans `config/villes.ts`). Il partage la langue du
   * marché de référence et lui emprunte donc ses textes — seuls ses barèmes,
   * lus en base, lui sont propres.
   */
  "fr-BE": {
    country: "BE",
    language: "fr",
    currency: "EUR",
    pathPrefix: "/be",
    enabled: true,
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

/**
 * Le marché ouvert qui sert un pays donné.
 *
 * Une annonce appartient au marché de son pays, jamais à celui que son
 * propriétaire consultait au moment de la publier. Sans cette correspondance,
 * un loueur qui met en ligne depuis le site français une remorque garée à
 * Charleroi est renvoyé, après publication, vers une adresse française où le
 * cloisonnement par pays rend son annonce introuvable : elle existe, elle est
 * publiée, et il voit une page « introuvable ».
 *
 * Rend `undefined` pour un pays dont le marché n'est pas encore ouvert —
 * l'appelant décide alors quoi faire, plutôt que d'hériter d'un repli
 * silencieux qui le ramènerait au même défaut.
 */
export function marchePourPays(code: string): Market | undefined {
  return ENABLED_MARKETS.find((marche) => MARKETS[marche].country === code);
}

export function isMarket(value: string): value is Market {
  return (ALL_MARKETS as string[]).includes(value);
}
