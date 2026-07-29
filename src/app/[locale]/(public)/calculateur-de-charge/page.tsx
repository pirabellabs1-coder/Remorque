import { getTranslations, setRequestLocale } from "next-intl/server";

import { OutilCharge } from "@/components/outils/outil-charge";
import { EnTetePage } from "@/components/ui/carte";
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
    <main>
      <EnTetePage
        surtitre={t("surtitre")}
        titre={t("titre")}
        chapo={t("chapo")}
      />

      <div className="mx-auto w-full max-w-5xl px-4 pb-20 sm:px-6">
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
      </div>
    </main>
  );
}
