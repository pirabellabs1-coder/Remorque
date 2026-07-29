import { getTranslations, setRequestLocale } from "next-intl/server";

import { Bouton } from "@/components/ui/bouton";
import { Carte, EnTetePage } from "@/components/ui/carte";
import type { Market } from "@/config/markets";
import { Link } from "@/i18n/navigation";
import { metadonneesPage } from "@/lib/metadonnees";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "commentCaMarche" });

  return metadonneesPage({
    locale: locale as Market,
    href: "/comment-ca-marche",
    titre: t("metaTitre"),
    description: t("metaDescription"),
  });
}

export default async function PageCommentCaMarche({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("commentCaMarche");

  return (
    <main>
      <EnTetePage titre={t("titre")} chapo={t("chapo")} />

      <div className="mx-auto grid w-full max-w-4xl gap-6 px-4 pb-20 sm:px-6 md:grid-cols-2">
        <Carte className="flex flex-col">
          <h2 className="text-xl font-semibold">{t("locataire.titre")}</h2>
          <p className="mt-3 flex-1 text-texte-attenue">
            {t("locataire.texte")}
          </p>
          <Bouton
            as={Link}
            href="/comment-ca-marche/louer"
            className="mt-6 self-start"
          >
            {t("locataire.action")}
          </Bouton>
        </Carte>

        <Carte className="flex flex-col">
          <h2 className="text-xl font-semibold">{t("proprietaire.titre")}</h2>
          <p className="mt-3 flex-1 text-texte-attenue">
            {t("proprietaire.texte")}
          </p>
          <Bouton
            as={Link}
            href="/comment-ca-marche/mettre-en-location"
            variante="secondaire"
            className="mt-6 self-start"
          >
            {t("proprietaire.action")}
          </Bouton>
        </Carte>
      </div>
    </main>
  );
}
