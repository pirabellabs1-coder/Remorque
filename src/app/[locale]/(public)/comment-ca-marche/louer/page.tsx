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
  const t = await getTranslations({ locale, namespace: "parcoursLocataire" });

  return metadonneesPage({
    locale: locale as Market,
    href: "/comment-ca-marche/louer",
    titre: t("metaTitre"),
    description: t("metaDescription"),
  });
}

/** Les quatre protections, dans l'ordre où elles interviennent. */
const PROTECTIONS = ["assurance", "caution", "etatDesLieux", "litige"] as const;

export default async function PageParcoursLocataire({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("parcoursLocataire");

  const etapes = [1, 2, 3, 4].map((numero) => ({
    titre: t(`etapes.e${numero}.titre` as never),
    texte: t(`etapes.e${numero}.texte` as never),
  }));

  // En cartes titrées. Ces protections étaient rendues en paragraphes séparés
  // par un simple filet : quatre engagements empilés sous un même titre se
  // lisent comme un seul pavé gris, et aucun ne pouvait plus être cité,
  // comparé ni contesté.
  const protections = PROTECTIONS.map((cle) => ({
    titre: t(`protection.${cle}Titre` as never),
    texte: t(`protection.${cle}` as never),
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
        titre={t("protection.titre")}
        chapo={t("protection.chapo")}
      >
        <ListePoints points={protections} />
      </SectionEditoriale>

      <AppelAction titre={t("action")}>
        <Bouton as={Link} href="/recherche" taille="grand">
          {t("action")}
        </Bouton>
        <Bouton
          as={Link}
          href="/comment-ca-marche/mettre-en-location"
          taille="grand"
          variante="secondaire"
        >
          {t("actionSecondaire")}
        </Bouton>
      </AppelAction>
    </PageEditoriale>
  );
}
