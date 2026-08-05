import { getTranslations, setRequestLocale } from "next-intl/server";

import { Etapes } from "@/components/marketing/etapes";
import { Bouton } from "@/components/ui/bouton";
import {
  AppelAction,
  ListePoints,
  PageEditoriale,
  SectionEditoriale,
} from "@/components/ui/mise-en-page";
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

/** Les quatre garanties, dans l'ordre où elles rassurent. */
const GARANTIES = ["assurance", "paiement", "selection", "calendrier"] as const;

export default async function PageParcoursProprietaire({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("parcoursProprietaire");

  const etapes = [1, 2, 3, 4].map((numero) => ({
    titre: t(`etapes.e${numero}.titre` as never),
    texte: t(`etapes.e${numero}.texte` as never),
  }));

  const garanties = GARANTIES.map((cle) => ({
    titre: t(`garanties.${cle}Titre` as never),
    texte: t(`garanties.${cle}` as never),
  }));

  return (
    <PageEditoriale
      surtitre={t("surtitre")}
      titre={t("titre")}
      chapo={t("chapo")}
      densite="large"
    >
      <SectionEditoriale titre={t("etapesTitre")}>
        <Etapes etapes={etapes} />
      </SectionEditoriale>

      <SectionEditoriale
        titre={t("garanties.titre")}
        chapo={t("garantiesChapo")}
      >
        <ListePoints points={garanties} />
      </SectionEditoriale>

      <AppelAction titre={t("action")}>
        <Bouton as={Link} href="/mettre-en-location" taille="grand">
          {t("action")}
        </Bouton>
        <Bouton
          as={Link}
          href="/comment-ca-marche/louer"
          taille="grand"
          variante="secondaire"
        >
          {t("actionSecondaire")}
        </Bouton>
      </AppelAction>
    </PageEditoriale>
  );
}
