import { getTranslations, setRequestLocale } from "next-intl/server";

import { CoquilleAuthentification } from "@/components/compte/coquille-authentification";
import { FormulaireInscription } from "@/components/compte/formulaire-inscription";
import type { Market } from "@/config/markets";
import { Link } from "@/i18n/navigation";
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

export default async function PageInscription({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("compte.inscription");

  return (
    <CoquilleAuthentification
      titre={t("titre")}
      sousTitre={t("sousTitre")}
      illustration="/images/etat-des-lieux.webp"
      illustrationAlt={t("illustration")}
      bas={t.rich("dejaInscrit", {
        lien: (contenu) => (
          <Link
            href="/connexion"
            className="font-medium text-accent underline underline-offset-4"
          >
            {contenu}
          </Link>
        ),
      })}
    >
      <FormulaireInscription />
    </CoquilleAuthentification>
  );
}
