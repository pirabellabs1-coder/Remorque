import { getTranslations, setRequestLocale } from "next-intl/server";

import { DocumentLegal } from "@/components/legal/document-legal";
import type { Market } from "@/config/markets";
import { metadonneesPage } from "@/lib/metadonnees";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "legal.cookies" });

  return metadonneesPage({
    locale: locale as Market,
    href: "/cookies",
    titre: t("metaTitre"),
    description: t("metaDescription"),
  });
}

export default async function Page({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("legal.cookies");
  const a = (cle: string) => t(`articles.${cle}` as never);

  return (
    <DocumentLegal
      surtitre={t("surtitre")}
      titre={t("titre")}
      chapo={t("chapo")}
      pointsCles={[
        {
          icone: "bouclier",
          titre: t("cles.aucun.titre"),
          texte: t("cles.aucun.texte"),
        },
        {
          icone: "donnees",
          titre: t("cles.necessaire.titre"),
          texte: t("cles.necessaire.texte"),
        },
        {
          icone: "cle",
          titre: t("cles.refus.titre"),
          texte: t("cles.refus.texte"),
        },
      ]}
      articles={[
        {
          cle: "principe",
          titre: a("principe.titre"),
          contenu: [
            { type: "p", texte: a("principe.p1") },
            { type: "encadre", ton: "info", texte: a("principe.encadre") },
          ],
        },
        {
          cle: "liste",
          titre: a("liste.titre"),
          contenu: [
            {
              type: "definitions",
              entrees: [
                { terme: "remorque_session", sens: a("liste.session") },
                { terme: "remorque_barre", sens: a("liste.preference") },
                { terme: "remorque_csrf", sens: a("liste.securite") },
              ],
            },
          ],
        },
        {
          cle: "refus",
          titre: a("refus.titre"),
          contenu: [{ type: "p", texte: a("refus.p1") }],
        },
        {
          cle: "tiers",
          titre: a("tiers.titre"),
          contenu: [{ type: "p", texte: a("tiers.p1") }],
        },
      ]}
    />
  );
}
