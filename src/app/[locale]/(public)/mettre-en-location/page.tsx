import { getTranslations, setRequestLocale } from "next-intl/server";

import { Etapes } from "@/components/marketing/etapes";
import { SimulateurRevenus } from "@/components/proprietaire/simulateur-revenus";
import { Faq } from "@/components/ui/faq";
import { Bouton } from "@/components/ui/bouton";
import { Carte, DonneesStructurees } from "@/components/ui/carte";
import { MARKETS, type Market } from "@/config/markets";
import { Link } from "@/i18n/navigation";
import { metadonneesPage } from "@/lib/metadonnees";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "mettreEnLocation" });

  return metadonneesPage({
    locale: locale as Market,
    href: "/mettre-en-location",
    titre: t("metaTitre"),
    description: t("metaDescription"),
  });
}

export default async function PageMettreEnLocation({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("mettreEnLocation");
  const tParcours = await getTranslations("parcoursProprietaire");
  const devise = MARKETS[locale as Market].currency;

  const etapes = [1, 2, 3, 4].map((numero) => ({
    titre: tParcours(`etapes.e${numero}.titre`),
    texte: tParcours(`etapes.e${numero}.texte`),
  }));

  const questions = [
    { question: t("faq.q1"), reponse: t("faq.r1") },
    { question: t("faq.q2"), reponse: t("faq.r2") },
    { question: t("faq.q3"), reponse: t("faq.r3") },
    { question: t("faq.q4"), reponse: t("faq.r4") },
  ];

  return (
    <main>
      {/* --- Accroche et simulateur --------------------------------------- */}
      <section className="border-b border-bordure bg-fond-eleve">
        <div className="mx-auto grid w-full max-w-6xl gap-12 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-2 lg:items-start">
          <div>
            <p className="text-sm font-medium uppercase tracking-widest text-accent">
              {t("surtitre")}
            </p>
            <h1 className="mt-4 text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
              {t("titre")}
            </h1>
            <p className="mt-6 text-pretty text-lg text-texte-attenue">
              {t("chapo")}
            </p>

            <ul className="mt-8 space-y-3 text-texte-attenue">
              <li className="border-t border-bordure pt-3">
                {t("arguments.gratuit")}
              </li>
              <li className="border-t border-bordure pt-3">
                {t("arguments.assurance")}
              </li>
              <li className="border-t border-bordure pt-3">
                {t("arguments.controle")}
              </li>
              <li className="border-t border-bordure pt-3">
                {t("arguments.paiement")}
              </li>
            </ul>

            <Bouton
              as={Link}
              href="/inscription"
              taille="grand"
              className="mt-8"
            >
              {t("action")}
            </Bouton>
          </div>

          <SimulateurRevenus devise={devise} />
        </div>
      </section>

      {/* --- Parcours de publication -------------------------------------- */}
      <section className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
        <h2 className="text-3xl font-semibold tracking-tight">
          {t("publication.titre")}
        </h2>
        <p className="mt-3 max-w-2xl text-texte-attenue">
          {t("publication.chapo")}
        </p>

        <div className="mt-10">
          <Etapes etapes={etapes} />
        </div>
      </section>

      {/* --- Ce que couvre la plateforme ---------------------------------- */}
      <section className="border-y border-bordure bg-fond-eleve">
        <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
          <h2 className="text-3xl font-semibold tracking-tight">
            {t("couverture.titre")}
          </h2>
          <p className="mt-3 max-w-2xl text-texte-attenue">
            {t("couverture.chapo")}
          </p>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            <Carte>
              <h3 className="font-semibold">{t("couverture.sinistre.titre")}</h3>
              <p className="mt-2 text-sm text-texte-attenue">
                {t("couverture.sinistre.texte")}
              </p>
            </Carte>
            <Carte>
              <h3 className="font-semibold">{t("couverture.impaye.titre")}</h3>
              <p className="mt-2 text-sm text-texte-attenue">
                {t("couverture.impaye.texte")}
              </p>
            </Carte>
            <Carte>
              <h3 className="font-semibold">{t("couverture.litige.titre")}</h3>
              <p className="mt-2 text-sm text-texte-attenue">
                {t("couverture.litige.texte")}
              </p>
            </Carte>
          </div>
        </div>
      </section>

      {/* --- Professionnels ------------------------------------------------ */}
      <section className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
        <div className="rounded-carte border border-bordure p-8 sm:p-12">
          <h2 className="text-3xl font-semibold tracking-tight">
            {t("pro.titre")}
          </h2>
          <p className="mt-4 max-w-2xl text-texte-attenue">{t("pro.chapo")}</p>
          <Bouton
            as={Link}
            href="/pro"
            variante="secondaire"
            taille="grand"
            className="mt-8"
          >
            {t("pro.action")}
          </Bouton>
        </div>
      </section>

      {/* --- Questions fréquentes ------------------------------------------ */}
      <section className="mx-auto w-full max-w-3xl px-4 pb-24 sm:px-6">
        <h2 className="text-3xl font-semibold tracking-tight">
          {t("faq.titre")}
        </h2>
        <Faq questions={questions} className="mt-10" />
      </section>

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
