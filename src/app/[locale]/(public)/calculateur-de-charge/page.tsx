import { getTranslations, setRequestLocale } from "next-intl/server";

import { OutilCharge } from "@/components/outils/outil-charge";
import { PageEditoriale } from "@/components/ui/mise-en-page";
import type { Market } from "@/config/markets";
import { Link } from "@/i18n/navigation";
import { metadonneesPage } from "@/lib/metadonnees";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "outilCharge" });

  return metadonneesPage({
    locale: locale as Market,
    href: "/calculateur-de-charge",
    titre: t("metaTitre"),
    description: t("metaDescription"),
  });
}

export default async function PageCharge({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("outilCharge");

  return (
    <PageEditoriale
      surtitre={t("surtitre")}
      titre={t("titre")}
      chapo={t("chapo")}
      densite="large"
    >
        <OutilCharge />

        <section className="mt-16 max-w-2xl">
          <h2 className="text-2xl font-semibold">{t("comprendre.titre")}</h2>
          <p className="mt-4 text-texte-attenue">{t("comprendre.texte")}</p>
          <p className="mt-4 text-texte-attenue">
            {t.rich("comprendre.lien", {
              permis: (contenu) => (
                <Link
                  href="/quel-permis-pour-quelle-remorque"
                  className="underline underline-offset-4"
                >
                  {contenu}
                </Link>
              ),
            })}
          </p>
        </section>
    </PageEditoriale>
  );
}
