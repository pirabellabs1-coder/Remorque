import { ALL_MARKETS, DEFAULT_MARKET, MARKETS, type Market } from "@/config/markets";

/**
 * Découpage des traductions par espace applicatif.
 *
 * Motif : `NextIntlClientProvider` sérialise dans le HTML tout ce qu'on lui
 * confie. Avec un fichier unique, un visiteur de la page d'accueil
 * téléchargerait aussi les libellés de l'espace propriétaire et de
 * l'administration — c'est-à-dire, à terme, la majorité des chaînes du
 * projet, pour un espace où il n'ira jamais.
 *
 * Chaque espace charge donc son propre fichier. Le serveur dispose toujours de
 * l'ensemble ; seul ce qui part vers le navigateur est restreint.
 */
export const ESPACES = [
  "commun",
  "public",
  "reservation",
  "compte",
  "espaces",
  // Gabarits des courriels sortants et des documents PDF : rendus côté serveur
  // uniquement, jamais transmis au navigateur — aucun espace client ne doit les
  // demander.
  "courriels",
  "documents",
] as const;

export type Espace = (typeof ESPACES)[number];

export type Messages = Record<string, unknown>;

/**
 * Marché dont un autre emprunte les textes, faute d'en avoir de propres.
 *
 * Un marché est un couple pays × langue : la Belgique francophone et la France
 * partagent la langue et n'ont donc presque rien à traduire — ce qui les
 * sépare tient dans une poignée de mentions légales et de barèmes, et ces
 * derniers vivent en base. Dupliquer huit fichiers pour changer trois phrases
 * garantirait qu'ils divergent : une correction appliquée d'un côté, oubliée
 * de l'autre.
 *
 * Le marché n'a donc à porter que ses différences ; le reste est emprunté au
 * premier marché ouvert qui parle la même langue.
 */
function marcheDeRepli(locale: Market): Market | null {
  const langue = MARKETS[locale].language;

  return (
    ALL_MARKETS.find(
      (candidat) =>
        candidat !== locale &&
        MARKETS[candidat].language === langue &&
        candidat === DEFAULT_MARKET,
    ) ??
    ALL_MARKETS.find(
      (candidat) => candidat !== locale && MARKETS[candidat].language === langue,
    ) ??
    null
  );
}

async function charger(locale: Market, espace: Espace): Promise<Messages> {
  try {
    return (await import(`../messages/${locale}/${espace}.json`)).default;
  } catch {
    const repli = marcheDeRepli(locale);
    // Sans repli possible, l'absence est une vraie erreur de configuration :
    // on la laisse remonter plutôt que de rendre une interface vide de textes.
    if (!repli) throw new Error(`Traductions introuvables : ${locale}/${espace}`);

    return (await import(`../messages/${repli}/${espace}.json`)).default;
  }
}

/** Toutes les traductions — pour le rendu serveur, qui n'a aucun coût réseau. */
export async function chargerToutesLesTraductions(
  locale: Market,
): Promise<Messages> {
  const fichiers = await Promise.all(
    ESPACES.map((espace) => charger(locale, espace)),
  );

  return Object.assign({}, ...fichiers) as Messages;
}

/**
 * Sous-ensemble transmis au navigateur pour un espace donné.
 * `commun` est toujours inclus : en-tête, pied de page et messages d'erreur
 * sont présents partout.
 */
export async function chargerTraductionsClient(
  locale: Market,
  ...espaces: Espace[]
): Promise<Messages> {
  const fichiers = await Promise.all(
    ["commun" as const, ...espaces].map((espace) => charger(locale, espace)),
  );

  return Object.assign({}, ...fichiers) as Messages;
}
