import { getTranslations, setRequestLocale } from "next-intl/server";

import { OutilPermis } from "@/components/outils/outil-permis";
import { Carte, DonneesStructurees, EnTetePage } from "@/components/ui/carte";
import { Faq } from "@/components/ui/faq";
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

  return (
    <main>
      <EnTetePage
        surtitre={t("surtitre")}
        titre={t("titre")}
        chapo={t("chapo")}
      />

      <div className="mx-auto w-full max-w-5xl px-4 pb-20 sm:px-6">
        <OutilPermis />

        <section className="mt-16">
          <h2 className="text-2xl font-semibold">{t("lesRegles")}</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <Carte>
              <p className="font-mono text-sm font-semibold">B</p>
              <p className="mt-2 text-sm text-texte-attenue">
                {t("regleB", { plafond: BAREME_FR.plafondEnsembleB })}
              </p>
            </Carte>
            <Carte>
              <p className="font-mono text-sm font-semibold">B96</p>
              <p className="mt-2 text-sm text-texte-attenue">
                {t("regleB96", {
                  plancher: BAREME_FR.plafondEnsembleB,
                  plafond: BAREME_FR.plafondEnsembleB96,
                })}
              </p>
            </Carte>
            <Carte>
              <p className="font-mono text-sm font-semibold">BE</p>
              <p className="mt-2 text-sm text-texte-attenue">
                {t("regleBE", {
                  plafond: BAREME_FR.plafondEnsembleBE,
                  remorque: BAREME_FR.plafondRemorqueBE,
                })}
              </p>
            </Carte>
          </div>
        </section>

        <section className="mt-16">
          <h2 className="text-2xl font-semibold">{t("faq.titre")}</h2>
          <Faq questions={questions} className="mt-10" />
        </section>
      </div>

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
    </main>
  );
}
