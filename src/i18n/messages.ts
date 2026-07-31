import type { Market } from "@/config/markets";

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
] as const;

export type Espace = (typeof ESPACES)[number];

export type Messages = Record<string, unknown>;

async function charger(locale: Market, espace: Espace): Promise<Messages> {
  return (await import(`../messages/${locale}/${espace}.json`)).default;
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
