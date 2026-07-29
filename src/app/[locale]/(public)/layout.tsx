import { setRequestLocale } from "next-intl/server";
import type { ReactNode } from "react";

import { EnTetePublic } from "@/components/navigation/en-tete-public";
import { PiedPagePublic } from "@/components/navigation/pied-page-public";

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

  return (
    <>
      <EnTetePublic />
      {children}
      <PiedPagePublic />
    </>
  );
}
