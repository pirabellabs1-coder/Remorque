import { getTranslations, setRequestLocale } from "next-intl/server";

import { DocumentLegal } from "@/components/legal/document-legal";
import type { Market } from "@/config/markets";
import { metadonneesPage } from "@/lib/metadonnees";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "legal.cgu" });

  return metadonneesPage({
    locale: locale as Market,
    href: "/cgu",
    titre: t("metaTitre"),
    description: t("metaDescription"),
  });
}

export default async function Page({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("legal.cgu");
  const a = (cle: string) => t(`articles.${cle}` as never);

  return (
    <DocumentLegal
      surtitre={t("surtitre")}
      titre={t("titre")}
      chapo={t("chapo")}
      pointsCles={[
        {
          icone: "cle",
          titre: t("cles.compte.titre"),
          texte: t("cles.compte.texte"),
        },
        {
          icone: "balance",
          titre: t("cles.moderation.titre"),
          texte: t("cles.moderation.texte"),
        },
        {
          icone: "bouclier",
          titre: t("cles.contournement.titre"),
          texte: t("cles.contournement.texte"),
        },
      ]}
      articles={[
        {
          cle: "objet",
          titre: a("objet.titre"),
          contenu: [
            { type: "p", texte: a("objet.p1") },
            { type: "p", texte: a("objet.p2") },
          ],
        },
        {
          cle: "definitions",
          titre: a("definitions.titre"),
          contenu: [
            {
              type: "definitions",
              entrees: [
                { terme: "Plateforme", sens: a("definitions.plateforme") },
                { terme: "Propriétaire", sens: a("definitions.proprietaire") },
                { terme: "Locataire", sens: a("definitions.locataire") },
                { terme: "Annonce", sens: a("definitions.annonce") },
                { terme: "Location", sens: a("definitions.location") },
              ],
            },
          ],
        },
        {
          cle: "compte",
          titre: a("compte.titre"),
          contenu: [
            { type: "p", texte: a("compte.p1") },
            { type: "p", texte: a("compte.p2") },
            { type: "soustitre", texte: a("compte.soustitre") },
            { type: "p", texte: a("compte.p3") },
            { type: "p", texte: a("compte.p4") },
          ],
        },
        {
          cle: "usage",
          titre: a("usage.titre"),
          contenu: [
            { type: "p", texte: a("usage.p1") },
            { type: "liste", entrees: t.raw("articles.usage.interdits") as string[] },
            { type: "encadre", ton: "attention", texte: a("usage.encadre") },
          ],
        },
        {
          cle: "contenus",
          titre: a("contenus.titre"),
          contenu: [
            { type: "p", texte: a("contenus.p1") },
            { type: "p", texte: a("contenus.p2") },
          ],
        },
        {
          cle: "moderation",
          titre: a("moderation.titre"),
          contenu: [
            { type: "p", texte: a("moderation.p1") },
            { type: "p", texte: a("moderation.p2") },
            { type: "encadre", ton: "attention", texte: a("moderation.encadre") },
          ],
        },
        {
          cle: "disponibilite",
          titre: a("disponibilite.titre"),
          contenu: [{ type: "p", texte: a("disponibilite.p1") }],
        },
        {
          cle: "duree",
          titre: a("duree.titre"),
          contenu: [
            { type: "p", texte: a("duree.p1") },
            { type: "p", texte: a("duree.p2") },
          ],
        },
        {
          cle: "droit",
          titre: a("droit.titre"),
          contenu: [
            { type: "p", texte: a("droit.p1") },
            { type: "p", texte: a("droit.p2") },
          ],
        },
      ]}
    />
  );
}
