import { getTranslations, setRequestLocale } from "next-intl/server";

import { Etapes } from "@/components/marketing/etapes";
import { Bouton } from "@/components/ui/bouton";
import { EnTetePage } from "@/components/ui/carte";
import type { Market } from "@/config/markets";
import { Link } from "@/i18n/navigation";
import { metadonneesPage } from "@/lib/metadonnees";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({
    locale,
    namespace: "parcoursProprietaire",
  });

  return metadonneesPage({
    locale: locale as Market,
    href: "/comment-ca-marche/mettre-en-location",
    titre: t("metaTitre"),
    description: t("metaDescription"),
  });
}

export default async function PageParcoursProprietaire({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("parcoursProprietaire");

  const etapes = [1, 2, 3, 4].map((numero) => ({
    titre: t(`etapes.e${numero}.titre`),
    texte: t(`etapes.e${numero}.texte`),
  }));

  return (
    <main>
      <EnTetePage
        surtitre={t("surtitre")}
        titre={t("titre")}
        chapo={t("chapo")}
      />

      <div className="mx-auto w-full max-w-5xl px-4 pb-20 sm:px-6">
        <Etapes etapes={etapes} />

        <section className="mt-16 max-w-2xl">
          <h2 className="text-2xl font-semibold">{t("garanties.titre")}</h2>
          <ul className="mt-6 space-y-4 text-texte-attenue">
            <li className="border-t border-bordure pt-4">
              {t("garanties.assurance")}
            </li>
            <li className="border-t border-bordure pt-4">
              {t("garanties.paiement")}
            </li>
            <li className="border-t border-bordure pt-4">
              {t("garanties.selection")}
            </li>
            <li className="border-t border-bordure pt-4">
              {t("garanties.calendrier")}
            </li>
          </ul>

          <Bouton
            as={Link}
            href="/mettre-en-location"
            taille="grand"
            className="mt-8"
          >
            {t("action")}
          </Bouton>
        </section>
      </div>
    </main>
  );
}
