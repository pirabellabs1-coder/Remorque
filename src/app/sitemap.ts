import type { MetadataRoute } from "next";

import { CATEGORIES } from "@/config/categories";
import { clientEnv } from "@/config/env-client";
import { ENABLED_MARKETS, type Market } from "@/config/markets";
import { VILLES } from "@/config/villes";
import { getPathname } from "@/i18n/navigation";
import { pathnames } from "@/i18n/routing";
import { listerAdressesAnnonces } from "@/server/annonces/catalogue";

/**
 * Plan de site dynamique (M15).
 *
 * Il se met à jour de lui-même à chaque publication de page ou d'annonce : les
 * villes viennent de la configuration, les fiches du catalogue. Sans lui, les
 * pages locales — l'actif de référencement du projet — ne seraient découvertes
 * que par le maillage interne, donc lentement et partiellement.
 *
 * Les pages de compte, d'espace propriétaire et d'administration n'y figurent
 * pas : elles ne sont pas destinées à l'indexation.
 */

/**
 * Adresses éditoriales, à l'exclusion des adresses à segment dynamique : ces
 * dernières exigent leurs paramètres et sont énumérées séparément plus bas.
 */
type AdresseStatique = Exclude<keyof typeof pathnames, `${string}[${string}`>;

const ADRESSES_STATIQUES = Object.keys(pathnames).filter(
  (adresse): adresse is AdresseStatique => !adresse.includes("["),
);

/** Les pages sans intérêt d'indexation ou à faible valeur ajoutée. */
const EXCLUES = new Set<string>([
  "/connexion",
  "/inscription",
  "/mot-de-passe-oublie",
  "/plan-du-site",
]);

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = clientEnv.NEXT_PUBLIC_SITE_URL;
  const adresse = (chemin: string) => new URL(chemin, base).toString();
  const annonces = await listerAdressesAnnonces();

  const entrees: MetadataRoute.Sitemap = [];

  for (const locale of ENABLED_MARKETS as Market[]) {
    for (const href of ADRESSES_STATIQUES) {
      if (EXCLUES.has(href)) continue;
      entrees.push({
        url: adresse(getPathname({ locale, href })),
        changeFrequency: href === "/" ? "daily" : "monthly",
        priority: href === "/" ? 1 : 0.5,
      });
    }

    for (const ville of VILLES) {
      entrees.push({
        url: adresse(
          getPathname({
            locale,
            href: {
              pathname: "/location-remorque/[ville]",
              params: { ville: ville.slug },
            },
          }),
        ),
        changeFrequency: "daily",
        // Ce sont ces pages qui portent le trafic : elles passent avant le
        // reste du site dans l'ordre de priorité déclaré.
        priority: 0.9,
      });

      for (const categorie of CATEGORIES) {
        entrees.push({
          url: adresse(
            getPathname({
              locale,
              href: {
                pathname: "/location-remorque/[ville]/[type]",
                params: { ville: ville.slug, type: categorie.slug },
              },
            }),
          ),
          changeFrequency: "weekly",
          priority: 0.7,
        });
      }
    }

    for (const annonce of annonces) {
      entrees.push({
        url: adresse(
          getPathname({
            locale,
            href: {
              pathname: "/remorque/[ville]/[slug]",
              params: { ville: annonce.ville, slug: annonce.slug },
            },
          }),
        ),
        changeFrequency: "weekly",
        priority: 0.8,
      });
    }
  }

  return entrees;
}
