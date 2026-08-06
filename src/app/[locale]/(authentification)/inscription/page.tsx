import { getTranslations, setRequestLocale } from "next-intl/server";

import { Inscription } from "@/components/compte/inscription";
import type { Market } from "@/config/markets";
import { metadonneesPage } from "@/lib/metadonnees";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "compte.inscription" });

  return {
    ...metadonneesPage({
      locale: locale as Market,
      href: "/inscription",
      titre: t("metaTitre"),
      description: t("metaDescription"),
    }),
    robots: { index: false, follow: true },
  };
}

/**
 * L'écran d'inscription est entièrement client : le rôle choisi commande à la
 * fois le formulaire et le panneau de droite, qui change de contenu et de côté.
 * Un partage d'état entre deux colonnes ne passe pas par une coquille serveur
 * sans un aller-retour réseau à chaque clic.
 */
export default async function PageInscription({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <Inscription />;
}
