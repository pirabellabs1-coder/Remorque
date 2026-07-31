import { NextIntlClientProvider } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import type { ReactNode } from "react";

import type { Market } from "@/config/markets";
import { chargerTraductionsClient } from "@/i18n/messages";

/**
 * Coquille des écrans d'authentification.
 *
 * Volontairement dépourvue de l'en-tête et du pied de page publics : sur un
 * écran de connexion, chaque lien sortant est une occasion d'abandonner. Seul
 * subsiste le logo, qui ramène à l'accueil. C'est la convention de tous les
 * services transactionnels, et elle se justifie par les chiffres.
 */
export default async function LayoutAuthentification({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const messages = await chargerTraductionsClient(locale as Market, "compte");

  return (
    <NextIntlClientProvider messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}
