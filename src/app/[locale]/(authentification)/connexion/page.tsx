import { getTranslations, setRequestLocale } from "next-intl/server";

import { CoquilleAuthentification } from "@/components/compte/coquille-authentification";
import { FormulaireConnexion } from "@/components/compte/formulaire-connexion";
import type { Market } from "@/config/markets";
import { Link } from "@/i18n/navigation";
import { metadonneesPage } from "@/lib/metadonnees";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ suite?: string; change?: string }>;
};

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

export default async function PageConnexion({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { change } = await searchParams;
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
      {/* On revient ici après avoir changé son mot de passe : toutes les
          sessions ont été fermées, y compris celle d'ici. Sans ce mot, l'écran
          de connexion qui s'affiche donne l'impression que rien n'a marché. */}
      {change === "oui" ? (
        <div className="mb-6 rounded-carte border border-succes/30 bg-succes/5 px-4 py-3">
          <p className="text-sm font-medium">{t("motDePasseChange")}</p>
        </div>
      ) : null}

      <FormulaireConnexion />
    </CoquilleAuthentification>
  );
}
