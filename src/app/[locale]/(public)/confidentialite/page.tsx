import { getTranslations, setRequestLocale } from "next-intl/server";

import { DocumentLegal } from "@/components/legal/document-legal";
import type { Market } from "@/config/markets";
import { metadonneesPage } from "@/lib/metadonnees";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "legal.confidentialite" });

  return metadonneesPage({
    locale: locale as Market,
    href: "/confidentialite",
    titre: t("metaTitre"),
    description: t("metaDescription"),
  });
}

export default async function Page({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("legal.confidentialite");
  const a = (cle: string) => t(`articles.${cle}` as never);

  return (
    <DocumentLegal
      surtitre={t("surtitre")}
      titre={t("titre")}
      chapo={t("chapo")}
      pointsCles={[
        {
          icone: "donnees",
          titre: t("cles.minimum.titre"),
          texte: t("cles.minimum.texte"),
        },
        {
          icone: "bouclier",
          titre: t("cles.europe.titre"),
          texte: t("cles.europe.texte"),
        },
        {
          icone: "cle",
          titre: t("cles.maitrise.titre"),
          texte: t("cles.maitrise.texte"),
        },
      ]}
      articles={[
        {
          cle: "responsable",
          titre: a("responsable.titre"),
          contenu: [{ type: "p", texte: a("responsable.p1") }],
        },
        {
          cle: "donnees",
          titre: a("donnees.titre"),
          contenu: [
            { type: "soustitre", texte: a("donnees.soustitre") },
            { type: "liste", entrees: t.raw("articles.donnees.compte") as string[] },
            { type: "soustitre", texte: a("donnees.soustitre2") },
            { type: "liste", entrees: t.raw("articles.donnees.location") as string[] },
            { type: "soustitre", texte: a("donnees.soustitre3") },
            { type: "liste", entrees: t.raw("articles.donnees.technique") as string[] },
          ],
        },
        {
          cle: "finalites",
          titre: a("finalites.titre"),
          contenu: [
            { type: "p", texte: a("finalites.p1") },
            { type: "liste", entrees: t.raw("articles.finalites.entrees") as string[] },
          ],
        },
        {
          cle: "duree",
          titre: a("duree.titre"),
          contenu: [
            { type: "p", texte: a("duree.p1") },
            { type: "liste", entrees: t.raw("articles.duree.entrees") as string[] },
          ],
        },
        {
          cle: "destinataires",
          titre: a("destinataires.titre"),
          contenu: [
            { type: "p", texte: a("destinataires.p1") },
            { type: "liste", entrees: t.raw("articles.destinataires.entrees") as string[] },
            { type: "encadre", ton: "info", texte: a("destinataires.encadre") },
          ],
        },
        {
          cle: "transferts",
          titre: a("transferts.titre"),
          contenu: [{ type: "p", texte: a("transferts.p1") }],
        },
        {
          cle: "droits",
          titre: a("droits.titre"),
          contenu: [
            { type: "p", texte: a("droits.p1") },
            { type: "p", texte: a("droits.p2") },
            { type: "encadre", ton: "attention", texte: a("droits.encadre") },
            { type: "p", texte: a("droits.p3") },
          ],
        },
        {
          cle: "securite",
          titre: a("securite.titre"),
          contenu: [
            { type: "p", texte: a("securite.p1") },
            { type: "p", texte: a("securite.p2") },
          ],
        },
        {
          cle: "cookies",
          titre: a("cookies.titre"),
          contenu: [{ type: "p", texte: a("cookies.p1") }],
        },
      ]}
    />
  );
}
