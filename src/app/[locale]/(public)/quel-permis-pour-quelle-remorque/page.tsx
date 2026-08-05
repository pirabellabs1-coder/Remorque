import { getTranslations, setRequestLocale } from "next-intl/server";

import { OutilPermis } from "@/components/outils/outil-permis";
import { Carte, DonneesStructurees } from "@/components/ui/carte";
import { Faq } from "@/components/ui/faq";
import {
  PageEditoriale,
  SectionEditoriale,
} from "@/components/ui/mise-en-page";
import type { Market } from "@/config/markets";
import { BAREME_FR } from "@/domain/compatibilite/permis";
import { metadonneesPage } from "@/lib/metadonnees";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "outilPermis" });

  return metadonneesPage({
    locale: locale as Market,
    href: "/quel-permis-pour-quelle-remorque",
    titre: t("metaTitre"),
    description: t("metaDescription"),
  });
}

export default async function PagePermis({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("outilPermis");

  // Questions fréquentes balisées : elles alimentent les extraits enrichis et
  // captent une part importante des recherches sur ce sujet (M15).
  const questions = [
    { question: t("faq.q1"), reponse: t("faq.r1") },
    { question: t("faq.q2"), reponse: t("faq.r2") },
    { question: t("faq.q3"), reponse: t("faq.r3") },
  ];

  /**
   * Les trois catégories, avec leurs plafonds tirés du barème du domaine.
   *
   * Aucun nombre n'est écrit dans la page : 3 500 et 4 250 kg sont des valeurs
   * réglementaires, et le jour où elles changent, elles doivent changer au seul
   * endroit qui fasse autorité — celui que les tests couvrent.
   */
  const regles = [
    {
      categorie: "B",
      texte: t("regleB", { plafond: BAREME_FR.plafondEnsembleB }),
    },
    {
      categorie: "B96",
      texte: t("regleB96", {
        plancher: BAREME_FR.plafondEnsembleB,
        plafond: BAREME_FR.plafondEnsembleB96,
      }),
    },
    {
      categorie: "BE",
      texte: t("regleBE", {
        plafond: BAREME_FR.plafondEnsembleBE,
        remorque: BAREME_FR.plafondRemorqueBE,
      }),
    },
  ];

  return (
    <PageEditoriale
      surtitre={t("surtitre")}
      titre={t("titre")}
      chapo={t("chapo")}
      densite="large"
    >
      <SectionEditoriale>
        <OutilPermis />
      </SectionEditoriale>

      <SectionEditoriale titre={t("lesRegles")}>
        <div className="grid gap-4 sm:grid-cols-3">
          {regles.map((regle) => (
            <Carte key={regle.categorie}>
              <p className="inline-flex rounded-full bg-accent px-3 py-1 font-mono text-sm font-semibold text-accent-contraste">
                {regle.categorie}
              </p>
              <p className="mt-3 text-[0.9375rem] text-pretty text-texte-attenue">
                {regle.texte}
              </p>
            </Carte>
          ))}
        </div>
      </SectionEditoriale>

      <SectionEditoriale titre={t("faq.titre")}>
        <Faq questions={questions} />
      </SectionEditoriale>

      <DonneesStructurees
        donnees={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: questions.map((entree) => ({
            "@type": "Question",
            name: entree.question,
            acceptedAnswer: { "@type": "Answer", text: entree.reponse },
          })),
        }}
      />
    </PageEditoriale>
  );
}
