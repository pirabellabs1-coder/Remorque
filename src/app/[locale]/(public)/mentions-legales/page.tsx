import { getTranslations, setRequestLocale } from "next-intl/server";

import { DocumentLegal } from "@/components/legal/document-legal";
import { FicheEditeur } from "@/components/legal/fiche-editeur";
import type { Market } from "@/config/markets";
import { metadonneesPage } from "@/lib/metadonnees";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "legal.mentions" });

  return metadonneesPage({
    locale: locale as Market,
    href: "/mentions-legales",
    titre: t("metaTitre"),
    description: t("metaDescription"),
  });
}

export default async function PageMentionsLegales({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("legal.mentions");
  const a = (cle: string) => t(`articles.${cle}` as never);

  return (
    <DocumentLegal
      surtitre={t("surtitre")}
      titre={t("titre")}
      chapo={t("chapo")}
      pointsCles={[
        {
          icone: "balance",
          titre: t("cles.editeur.titre"),
          texte: t("cles.editeur.texte"),
        },
        {
          icone: "donnees",
          titre: t("cles.hebergement.titre"),
          texte: t("cles.hebergement.texte"),
        },
        {
          icone: "cle",
          titre: t("cles.contact.titre"),
          texte: t("cles.contact.texte"),
        },
      ]}
      articles={[
        {
          cle: "editeur",
          titre: a("editeur.titre"),
          contenu: [{ type: "p", texte: a("editeur.p1") }],
        },
        {
          cle: "hebergeur",
          titre: a("hebergeur.titre"),
          contenu: [{ type: "p", texte: a("hebergeur.p1") }],
        },
        {
          cle: "propriete",
          titre: a("propriete.titre"),
          contenu: [
            { type: "p", texte: a("propriete.p1") },
            { type: "p", texte: a("propriete.p2") },
          ],
        },
        {
          cle: "responsabilite",
          titre: a("responsabilite.titre"),
          contenu: [
            { type: "p", texte: a("responsabilite.p1") },
            {
              type: "encadre",
              ton: "info",
              texte: a("responsabilite.encadre"),
            },
          ],
        },
        {
          cle: "liens",
          titre: a("liens.titre"),
          contenu: [{ type: "p", texte: a("liens.p1") }],
        },
        {
          cle: "contact",
          titre: a("contact.titre"),
          contenu: [{ type: "p", texte: a("contact.p1") }],
        },
      ]}
      apres={<FicheEditeur />}
    />
  );
}
