import type { Metadata } from "next";

import { clientEnv } from "@/config/env-client";
import { ENABLED_MARKETS, MARKETS, type Market } from "@/config/markets";
import { getPathname } from "@/i18n/navigation";
import type { pathnames } from "@/i18n/routing";

/**
 * Adresses sans segment dynamique. Les pages de ville, de catégorie et les
 * fiches d'annonce construisent leurs métadonnées à partir de leurs propres
 * données : elles ont besoin de leurs paramètres, que cet assistant n'a pas.
 */
type AdresseStatique = Exclude<
  keyof typeof pathnames,
  `${string}[${string}`
>;

/**
 * Construit les métadonnées d'une page publique.
 *
 * Deux exigences de la section M15 sont traitées ici et nulle part ailleurs :
 * l'adresse canonique, et les balises de langue déclarant les équivalences
 * entre versions linguistiques d'une même page. Les oublier revient à faire
 * concurrence à ses propres pages dans les moteurs de recherche.
 */
export function metadonneesPage({
  locale,
  href,
  titre,
  description,
}: {
  locale: Market;
  href: AdresseStatique;
  titre: string;
  description: string;
}): Metadata {
  const base = clientEnv.NEXT_PUBLIC_SITE_URL;
  const canonique = new URL(getPathname({ locale, href }), base).toString();

  const languages = Object.fromEntries(
    ENABLED_MARKETS.map((marche) => [
      marche,
      new URL(getPathname({ locale: marche, href }), base).toString(),
    ]),
  );

  return {
    title: titre,
    description,
    alternates: { canonical: canonique, languages },
    openGraph: {
      title: titre,
      description,
      url: canonique,
      locale,
      type: "website",
    },
  };
}

/** Marché courant, pour les composants qui ont besoin de sa devise. */
export function marcheDe(locale: string) {
  return MARKETS[locale as Market];
}
