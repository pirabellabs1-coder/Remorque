import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";

import { ContenuLocal } from "@/components/local/contenu-local";
import { clientEnv } from "@/config/env-client";
import { MARKETS, type Market } from "@/config/markets";
import { VILLES, trouverVille } from "@/config/villes";
import { getPathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { PRIX_AFFICHE } from "@/lib/cn";
import {
  annoncesDeLaVille,
  prixMinimumDansLaVille,
} from "@/server/annonces/catalogue";

type Props = { params: Promise<{ locale: string; ville: string }> };

/**
 * Les pages locales sont pré-générées : elles doivent être servies
 * instantanément et intégralement rendues côté serveur, sans quoi le
 * référencement local — soit 60 à 80 % du trafic attendu — ne fonctionne pas.
 */
export function generateStaticParams() {
  return routing.locales.flatMap((locale) =>
    VILLES.map((ville) => ({ locale, ville: ville.slug })),
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, ville: slug } = await params;
  const ville = trouverVille(slug);
  if (!ville) return {};

  const t = await getTranslations({ locale, namespace: "pageLocale" });
  const format = await getFormatter({ locale });

  const annonces = await annoncesDeLaVille(ville.slug);
  const prixMinimum = await prixMinimumDansLaVille(ville.slug);
  const devise = MARKETS[locale as Market].currency;

  // La description reprend le prix d'appel seulement s'il existe réellement.
  const description =
    prixMinimum !== null
      ? t("metaDescription", {
          ville: ville.nom,
          nombre: annonces.length,
          prix: format.number(prixMinimum / 100, {
            ...PRIX_AFFICHE,
            currency: devise,
          }),
        })
      : t("metaDescriptionVide", { ville: ville.nom });

  const chemin = getPathname({
    locale: locale as Market,
    href: { pathname: "/location-remorque/[ville]", params: { ville: ville.slug } },
  });
  const canonique = new URL(chemin, clientEnv.NEXT_PUBLIC_SITE_URL).toString();

  return {
    title: t("metaTitre", { ville: ville.nom, departement: ville.departement }),
    description,
    alternates: { canonical: canonique },
    openGraph: { url: canonique, type: "website" },
  };
}

export default async function PageVille({ params }: Props) {
  const { locale, ville: slug } = await params;
  setRequestLocale(locale);

  const ville = trouverVille(slug);
  if (!ville) notFound();

  return <ContenuLocal locale={locale as Market} ville={ville} />;
}
