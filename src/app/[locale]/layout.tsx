import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { MARKETS, type Market } from "@/config/markets";
import { chargerTraductionsClient } from "@/i18n/messages";
import { routing } from "@/i18n/routing";

import "../globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

/** Les marchés ouverts sont connus à la compilation : rendu statique possible. */
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "commun" });

  return {
    title: {
      default: t("nomPlateforme"),
      template: `%s — ${t("nomPlateforme")}`,
    },
  };
}

export default async function MarketLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  // Indispensable au rendu statique des pages publiques (M15 — rendu serveur).
  setRequestLocale(locale);

  const market = MARKETS[locale as Market];

  return (
    <html
      lang={market.language}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        {/*
          Seules les traductions communes descendent jusqu'ici : en-tête, pied
          de page et messages d'erreur. Chaque espace applicatif ajoute les
          siennes dans sa propre coquille, afin qu'un visiteur ne télécharge
          jamais les libellés d'un espace où il n'ira pas.
        */}
        <NextIntlClientProvider
          messages={await chargerTraductionsClient(locale as Market)}
        >
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
