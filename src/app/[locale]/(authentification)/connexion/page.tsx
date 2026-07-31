import { getTranslations, setRequestLocale } from "next-intl/server";

import { CoquilleAuthentification } from "@/components/compte/coquille-authentification";
import { FormulaireConnexion } from "@/components/compte/formulaire-connexion";
import type { Market } from "@/config/markets";
import { Link } from "@/i18n/navigation";
import { metadonneesPage } from "@/lib/metadonnees";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "compte.connexion" });

  return {
    ...metadonneesPage({
      locale: locale as Market,
      href: "/connexion",
      titre: t("metaTitre"),
      description: t("metaDescription"),
    }),
    // Un écran de connexion n'a rien à faire dans un index de recherche.
    robots: { index: false, follow: true },
  };
}

export default async function PageConnexion({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("compte.connexion");

  return (
    <CoquilleAuthentification
      titre={t("titre")}
      sousTitre={t("sousTitre")}
      illustration="/images/hero.webp"
      illustrationAlt={t("illustration")}
      bas={t.rich("pasDeCompte", {
        lien: (contenu) => (
          <Link
            href="/inscription"
            className="font-medium text-accent underline underline-offset-4"
          >
            {contenu}
          </Link>
        ),
      })}
    >
      <FormulaireConnexion />
    </CoquilleAuthentification>
  );
}
