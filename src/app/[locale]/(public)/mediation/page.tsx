import { getTranslations, setRequestLocale } from "next-intl/server";

import { DocumentLegal } from "@/components/legal/document-legal";
import type { Market } from "@/config/markets";
import { metadonneesPage } from "@/lib/metadonnees";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "legal.mediation" });

  return metadonneesPage({
    locale: locale as Market,
    href: "/mediation",
    titre: t("metaTitre"),
    description: t("metaDescription"),
  });
}

export default async function Page({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("legal.mediation");
  const a = (cle: string) => t(`articles.${cle}` as never);

  return (
    <DocumentLegal
      surtitre={t("surtitre")}
      titre={t("titre")}
      chapo={t("chapo")}
      pointsCles={[
        {
          icone: "euro",
          titre: t("cles.gratuit.titre"),
          texte: t("cles.gratuit.texte"),
        },
        {
          icone: "balance",
          titre: t("cles.independant.titre"),
          texte: t("cles.independant.texte"),
        },
        {
          icone: "bouclier",
          titre: t("cles.sansRenoncer.titre"),
          texte: t("cles.sansRenoncer.texte"),
        },
      ]}
      articles={[
        {
          cle: "avant",
          titre: a("avant.titre"),
          contenu: [
            { type: "p", texte: a("avant.p1") },
            { type: "p", texte: a("avant.p2") },
            { type: "encadre", ton: "attention", texte: a("avant.encadre") },
          ],
        },
        {
          cle: "saisine",
          titre: a("saisine.titre"),
          contenu: [
            { type: "p", texte: a("saisine.p1") },
            { type: "p", texte: a("saisine.p2") },
          ],
        },
        {
          cle: "europeenne",
          titre: a("europeenne.titre"),
          contenu: [{ type: "p", texte: a("europeenne.p1") }],
        },
        {
          cle: "juridiction",
          titre: a("juridiction.titre"),
          contenu: [{ type: "p", texte: a("juridiction.p1") }],
        },
      ]}
    />
  );
}
