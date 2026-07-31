import { NextIntlClientProvider } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import type { ReactNode } from "react";

import type { Market } from "@/config/markets";
import { chargerTraductionsClient } from "@/i18n/messages";

/**
 * Racine des trois espaces authentifiés.
 *
 * Ils ne reçoivent ni l'en-tête ni le pied de page publics : la coquille d'un
 * espace de travail n'est pas celle d'un site qui vend.
 *
 * L'authentification n'est pas encore branchée. Quand elle le sera, c'est ici
 * que se fera la vérification de session — un seul point d'entrée pour les
 * trois espaces, chacun affinant ensuite selon son rôle.
 */
export default async function LayoutEspaces({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const messages = await chargerTraductionsClient(
    locale as Market,
    "espaces",
    "reservation",
  );

  return (
    <NextIntlClientProvider messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}
