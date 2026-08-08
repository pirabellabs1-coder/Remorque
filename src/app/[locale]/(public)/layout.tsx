import { NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { ReactNode } from "react";

import { BandeauMarche } from "@/components/navigation/bandeau-marche";
import { EnTetePublic } from "@/components/navigation/en-tete-public";
import { PiedPagePublic } from "@/components/navigation/pied-page-public";
import { getMarket, type Market } from "@/config/markets";
import { nomDuPays } from "@/config/villes";
import { marcheSuggere } from "@/server/marches/suggestion";
import { Link } from "@/i18n/navigation";
import { chargerTraductionsClient } from "@/i18n/messages";
import { enMaintenance } from "@/server/administration/parametres";

/**
 * Coquille de l'espace public — celui qui apporte tout le trafic (section 03).
 * Tout ce qui s'y trouve doit être indexable, rapide et lisible sur mobile.
 *
 * `setRequestLocale` est indispensable ici : sans lui, l'en-tête et le pied de
 * page basculeraient l'ensemble de l'espace public en rendu à la demande, et
 * l'on perdrait la pré-génération statique dont dépend le référencement (M15).
 */
export default async function LayoutPublic({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Traductions de l'espace public uniquement, en plus des communes.
  const messages = await chargerTraductionsClient(locale as Market, "public");

  // Le mode maintenance ne coupe que l'espace public : les espaces connectés
  // et l'administration — qui sert justement à le lever — restent ouverts.
  // La bascule revalide tout le site, si bien que les pages pré-générées se
  // reconstruisent avec la bonne valeur dès la requête suivante.
  if (await enMaintenance()) {
    const t = await getTranslations("maintenance");

    return (
      <main className="grid min-h-svh place-items-center px-4">
        <div className="max-w-lg text-center">
          <h1 className="text-[1.75rem] font-bold tracking-[-0.02em]">
            {t("titre")}
          </h1>
          <p className="mt-3 text-[1.0625rem] text-texte-attenue">
            {t("texte")}
          </p>
          <Link
            href="/connexion"
            className="mt-6 inline-block rounded-champ border border-bordure px-5 py-2.5 text-sm font-medium transition-colors hover:border-accent hover:text-accent"
          >
            {t("espace")}
          </Link>
        </div>
      </main>
    );
  }

  // Le pays du visiteur ne correspond pas toujours au marché servi. On le lui
  // signale sans rien décider à sa place — voir `marches/suggestion.ts`.
  const suggere = await marcheSuggere(locale as Market);

  return (
    <NextIntlClientProvider messages={messages}>
      {suggere ? (
        <BandeauMarche
          courant={locale}
          suggere={suggere}
          paysSuggere={nomDuPays(getMarket(suggere).country)}
          prefixeCourant={getMarket(locale as Market).pathPrefix ?? ""}
          prefixeSuggere={getMarket(suggere).pathPrefix ?? ""}
        />
      ) : null}
      <EnTetePublic />
      {children}
      <PiedPagePublic />
    </NextIntlClientProvider>
  );
}
