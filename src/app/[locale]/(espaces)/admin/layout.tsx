import type { ReactNode } from "react";

import { CoquilleEspace } from "@/components/espace/coquille-espace";
import { NAVIGATION_ADMIN } from "@/components/espace/navigation-espace";
import { exigerAdministration } from "@/server/authentification/garde";

/**
 * La garde est posée dans le layout, donc **avant** le rendu de toute page
 * enfant : aucune donnée ne peut fuir avant la vérification. La poser dans
 * chaque page laisserait une chance d'en oublier une.
 */
export default async function Layout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await exigerAdministration(locale, "/admin");

  return (
    <CoquilleEspace espace="admin" navigation={NAVIGATION_ADMIN}>
      {children}
    </CoquilleEspace>
  );
}
