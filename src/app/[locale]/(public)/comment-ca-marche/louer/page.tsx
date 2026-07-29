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
  const t = await getTranslations({ locale, namespace: "parcoursLocataire" });

  return metadonneesPage({
    locale: locale as Market,
    href: "/comment-ca-marche/louer",
    titre: t("metaTitre"),
    description: t("metaDescription"),
  });
}

export default async function PageParcoursLocataire({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("parcoursLocataire");

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
          <h2 className="text-2xl font-semibold">{t("protection.titre")}</h2>
          <ul className="mt-6 space-y-4 text-texte-attenue">
            <li className="border-t border-bordure pt-4">
              {t("protection.assurance")}
            </li>
            <li className="border-t border-bordure pt-4">
              {t("protection.caution")}
            </li>
            <li className="border-t border-bordure pt-4">
              {t("protection.etatDesLieux")}
            </li>
            <li className="border-t border-bordure pt-4">
              {t("protection.litige")}
            </li>
          </ul>

          <Bouton as={Link} href="/recherche" taille="grand" className="mt-8">
            {t("action")}
          </Bouton>
        </section>
      </div>
    </main>
  );
}
