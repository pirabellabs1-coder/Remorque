import { getTranslations, setRequestLocale } from "next-intl/server";

import { DocumentLegal } from "@/components/legal/document-legal";
import type { Market } from "@/config/markets";
import { metadonneesPage } from "@/lib/metadonnees";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "legal.cgv" });

  return metadonneesPage({
    locale: locale as Market,
    href: "/cgv",
    titre: t("metaTitre"),
    description: t("metaDescription"),
  });
}

export default async function Page({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("legal.cgv");
  const a = (cle: string) => t(`articles.${cle}` as never);

  return (
    <DocumentLegal
      surtitre={t("surtitre")}
      titre={t("titre")}
      chapo={t("chapo")}
      pointsCles={[
        {
          icone: "euro",
          titre: t("cles.caution.titre"),
          texte: t("cles.caution.texte"),
        },
        {
          icone: "bouclier",
          titre: t("cles.assurance.titre"),
          texte: t("cles.assurance.texte"),
        },
        {
          icone: "balance",
          titre: t("cles.transparence.titre"),
          texte: t("cles.transparence.texte"),
        },
      ]}
      articles={[
        {
          cle: "formation",
          titre: a("formation.titre"),
          contenu: [
            { type: "p", texte: a("formation.p1") },
            { type: "p", texte: a("formation.p2") },
            { type: "p", texte: a("formation.p3") },
          ],
        },
        {
          cle: "prix",
          titre: a("prix.titre"),
          contenu: [
            { type: "p", texte: a("prix.p1") },
            { type: "p", texte: a("prix.p2") },
            { type: "encadre", ton: "info", texte: a("prix.encadre") },
          ],
        },
        {
          cle: "paiement",
          titre: a("paiement.titre"),
          contenu: [
            { type: "p", texte: a("paiement.p1") },
            { type: "p", texte: a("paiement.p2") },
          ],
        },
        {
          cle: "caution",
          titre: a("caution.titre"),
          contenu: [
            { type: "soustitre", texte: a("caution.soustitre") },
            { type: "p", texte: a("caution.p1") },
            { type: "p", texte: a("caution.p2") },
            { type: "encadre", ton: "attention", texte: a("caution.encadre") },
            { type: "p", texte: a("caution.p3") },
          ],
        },
        {
          cle: "etat-des-lieux",
          titre: a("etatDesLieux.titre"),
          contenu: [
            { type: "p", texte: a("etatDesLieux.p1") },
            { type: "p", texte: a("etatDesLieux.p2") },
          ],
        },
        {
          cle: "annulation",
          titre: a("annulation.titre"),
          contenu: [
            { type: "p", texte: a("annulation.p1") },
            { type: "liste", entrees: t.raw("articles.annulation.politiques") as string[] },
            { type: "p", texte: a("annulation.p2") },
            { type: "soustitre", texte: a("annulation.soustitre") },
            { type: "p", texte: a("annulation.p3") },
          ],
        },
        {
          cle: "assurance",
          titre: a("assurance.titre"),
          contenu: [
            { type: "p", texte: a("assurance.p1") },
            { type: "p", texte: a("assurance.p2") },
            { type: "encadre", ton: "attention", texte: a("assurance.encadre") },
          ],
        },
        {
          cle: "obligations",
          titre: a("obligations.titre"),
          contenu: [
            { type: "soustitre", texte: a("obligations.soustitre") },
            { type: "liste", entrees: t.raw("articles.obligations.proprietaire") as string[] },
            { type: "soustitre", texte: a("obligations.soustitre2") },
            { type: "liste", entrees: t.raw("articles.obligations.locataire") as string[] },
          ],
        },
        {
          cle: "retard",
          titre: a("retard.titre"),
          contenu: [{ type: "p", texte: a("retard.p1") }],
        },
        {
          cle: "litiges",
          titre: a("litiges.titre"),
          contenu: [
            { type: "p", texte: a("litiges.p1") },
            { type: "p", texte: a("litiges.p2") },
          ],
        },
        {
          cle: "mediation",
          titre: a("mediation.titre"),
          contenu: [{ type: "p", texte: a("mediation.p1") }],
        },
      ]}
    />
  );
}
