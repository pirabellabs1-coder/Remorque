import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";

import { ContenuLocal } from "@/components/local/contenu-local";
import { CATEGORIES } from "@/config/categories";
import { clientEnv } from "@/config/env-client";
import { MARKETS, type Market } from "@/config/markets";
import { VILLES, trouverVille, type CodePays } from "@/config/villes";
import { getPathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { PRIX_AFFICHE } from "@/lib/cn";
import {
  annoncesDeLaVille,
  prixMinimumDansLaVille,
} from "@/server/annonces/catalogue";

type Props = {
  params: Promise<{ locale: string; ville: string; type: string }>;
};

/**
 * Croisement ville × catégorie — la longue traîne (section 4.1).
 *
 * « Remorque benne à Bruxelles » se cherche bien davantage que « location de
 * remorque » : ce sont ces pages qui captent l'intention précise, donc celle
 * qui convertit.
 *
 * Seuls les pays d'ouverture sont pré-générés. Une centaine de villes par dix
 * catégories feraient un millier de pages construites à chaque déploiement,
 * dont la grande majorité pour des marchés qui n'ouvrent pas avant plusieurs
 * mois. Les autres sont rendues à la première visite, puis servies depuis le
 * cache : le référencement n'y perd rien, la durée de compilation si.
 */
const PAYS_PRE_GENERES: readonly CodePays[] = ["BE", "FR"];

export function generateStaticParams() {
  const villes = VILLES.filter((ville) =>
    PAYS_PRE_GENERES.includes(ville.pays),
  );

  return routing.locales.flatMap((locale) =>
    villes.flatMap((ville) =>
      CATEGORIES.map((categorie) => ({
        locale,
        ville: ville.slug,
        type: categorie.slug,
      })),
    ),
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, ville: slugVille, type } = await params;
  const ville = trouverVille(slugVille);
  const categorie = CATEGORIES.find((entree) => entree.slug === type);
  if (!ville || !categorie) return {};

  const t = await getTranslations({ locale, namespace: "pageLocale" });
  const format = await getFormatter({ locale });

  const annonces = await annoncesDeLaVille(ville.slug, categorie.slug);
  const prixMinimum = await prixMinimumDansLaVille(ville.slug, categorie.slug);
  const devise = MARKETS[locale as Market].currency;

  const description =
    prixMinimum !== null
      ? t("metaDescriptionCategorie", {
          categorie: categorie.nomEnPhrase,
          ville: ville.nom,
          nombre: annonces.length,
          prix: format.number(prixMinimum / 100, {
            ...PRIX_AFFICHE,
            currency: devise,
          }),
        })
      : t("metaDescriptionCategorieVide", {
          categorie: categorie.nomEnPhrase,
          ville: ville.nom,
        });

  const chemin = getPathname({
    locale: locale as Market,
    href: {
      pathname: "/location-remorque/[ville]/[type]",
      params: { ville: ville.slug, type: categorie.slug },
    },
  });
  const canonique = new URL(chemin, clientEnv.NEXT_PUBLIC_SITE_URL).toString();

  return {
    title: t("metaTitreCategorie", {
      categorie: categorie.nomEnPhrase,
      ville: ville.nom,
    }),
    description,
    alternates: { canonical: canonique },
    openGraph: { url: canonique, type: "website" },
  };
}

export default async function PageVilleCategorie({ params }: Props) {
  const { locale, ville: slugVille, type } = await params;
  setRequestLocale(locale);

  const ville = trouverVille(slugVille);
  const categorie = CATEGORIES.find((entree) => entree.slug === type);
  if (!ville || !categorie) notFound();

  return (
    <ContenuLocal
      locale={locale as Market}
      ville={ville}
      categorie={categorie}
    />
  );
}
