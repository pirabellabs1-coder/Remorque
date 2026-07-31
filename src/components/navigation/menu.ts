import { CATEGORIES } from "@/config/categories";
import { VILLES } from "@/config/villes";
import type { pathnames } from "@/i18n/routing";

/**
 * Structure du méga-menu.
 *
 * Séparée du rendu pour deux raisons : la même structure sert à l'affichage
 * bureau et au tiroir mobile, et elle se relit d'un coup d'œil — ce qui est
 * précisément ce qu'on veut d'une navigation, dont la valeur tient à ce qu'on
 * y met, pas à la manière dont on l'anime.
 *
 * Les libellés sont des clés de traduction, jamais des chaînes.
 */

/**
 * Adresse sans segment dynamique. Typer `href` contre les adresses déclarées
 * plutôt que sur `string` fait échouer la compilation sur un lien mort — ce
 * qui, dans une navigation, est exactement la faute qu'on ne voit pas.
 */
type AdresseStatique = Exclude<keyof typeof pathnames, `${string}[${string}`>;

export type LienMenu = {
  /** Clé de traduction, dans l'espace de noms `menu`. */
  cle: string;
  href: AdresseStatique;
};

/** Les huit premières villes du catalogue, pour le maillage depuis l'en-tête. */
export const VILLES_EN_AVANT = VILLES.slice(0, 8);

/** Les six catégories les plus recherchées, en tête de colonne. */
export const CATEGORIES_EN_AVANT = CATEGORIES.slice(0, 6);

export const OUTILS = [
  { cle: "permis", href: "/quel-permis-pour-quelle-remorque" },
  { cle: "charge", href: "/calculateur-de-charge" },
] as const satisfies readonly LienMenu[];

export const LIENS_LOCATAIRE = [
  { cle: "rechercher", href: "/recherche" },
  { cle: "commentLouer", href: "/comment-ca-marche/louer" },
  { cle: "assurance", href: "/assurance" },
  { cle: "tarifs", href: "/tarifs" },
] as const satisfies readonly LienMenu[];

export const LIENS_PROPRIETAIRE = [
  { cle: "publier", href: "/mettre-en-location" },
  { cle: "commentPublier", href: "/comment-ca-marche/mettre-en-location" },
  { cle: "tarifsProprietaire", href: "/tarifs" },
  { cle: "pro", href: "/pro" },
] as const satisfies readonly LienMenu[];

export const LIENS_AIDE = [
  { cle: "centreAide", href: "/aide" },
  { cle: "contact", href: "/contact" },
  { cle: "mediation", href: "/mediation" },
] as const satisfies readonly LienMenu[];
