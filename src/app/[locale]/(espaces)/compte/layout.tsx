import type { ReactNode } from "react";

import { CoquilleEspace } from "@/components/espace/coquille-espace";
import { BandeauVerification } from "@/components/espace/verification/bandeau-verification";
import { NAVIGATION_LOCATAIRE } from "@/components/espace/navigation-espace";
import { exigerProfil } from "@/server/authentification/garde";

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
  const compte = await exigerProfil(locale, "/compte", "locataire");

  return (
    <CoquilleEspace
      espace="locataire"
      navigation={NAVIGATION_LOCATAIRE}
      nomCompte={[compte.prenom, compte.nom].filter(Boolean).join(" ")}
      courrielCompte={compte.email}
    >
      <BandeauVerification espace="locataire" />
      {children}
    </CoquilleEspace>
  );
}
