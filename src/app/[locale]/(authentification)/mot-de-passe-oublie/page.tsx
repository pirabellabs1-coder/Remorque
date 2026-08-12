import { getTranslations, setRequestLocale } from "next-intl/server";

import { CoquilleAuthentification } from "@/components/compte/coquille-authentification";
import { FormulaireOubli } from "@/components/compte/formulaire-oubli";
import type { Market } from "@/config/markets";
import { Link } from "@/i18n/navigation";
import { metadonneesPage } from "@/lib/metadonnees";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "compte.oubli" });

  return {
    ...metadonneesPage({
      locale: locale as Market,
      href: "/mot-de-passe-oublie",
      titre: t("metaTitre"),
      description: t("metaDescription"),
    }),
    robots: { index: false, follow: true },
  };
}

/**
 * Mot de passe oublié.
 *
 * L'adresse était déclarée dans le routage et le lien « Oublié ? » figurait
 * sous le champ de mot de passe depuis l'origine — il menait à une page
 * introuvable. De tous les manques du site, c'était le seul à faire perdre un
 * usager pour de bon : quelqu'un qui oublie son mot de passe perd son compte,
 * ses réservations et ses documents de location.
 */
export default async function PageMotDePasseOublie({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("compte.oubli");

  return (
    <CoquilleAuthentification
      titre={t("titre")}
      sousTitre={t("sousTitre")}
      illustration="/images/hero.webp"
      illustrationAlt={t("illustration")}
      bas={t.rich("basRetour", {
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
      <FormulaireOubli />
    </CoquilleAuthentification>
  );
}
