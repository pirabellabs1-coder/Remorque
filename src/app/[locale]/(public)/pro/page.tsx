import { getTranslations, setRequestLocale } from "next-intl/server";

import { Faq } from "@/components/ui/faq";
import { Bouton } from "@/components/ui/bouton";
import { Carte, DonneesStructurees, EnTetePage } from "@/components/ui/carte";
import type { Market } from "@/config/markets";
import { Link } from "@/i18n/navigation";
import { metadonneesPage } from "@/lib/metadonnees";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "pro" });

  return metadonneesPage({
    locale: locale as Market,
    href: "/pro",
    titre: t("metaTitre"),
    description: t("metaDescription"),
  });
}

export default async function PagePro({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("pro");

  const disponible = ["visibilite", "paiement", "assurance", "contrat", "calendrier", "annuaire"] as const;
  const enPreparation = ["flotte", "agences", "equipe", "facturation", "ical", "abonnement", "api"] as const;

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
        <div className="flex flex-wrap gap-3">
          <Bouton as={Link} href="/contact" taille="grand">
            {t("action")}
          </Bouton>
          <Bouton
            as={Link}
            href="/mettre-en-location"
            variante="secondaire"
            taille="grand"
          >
            {t("actionSecondaire")}
          </Bouton>
        </div>

        {/* --- Pourquoi ---------------------------------------------------- */}
        <section className="mt-20">
          <h2 className="text-2xl font-semibold tracking-tight">
            {t("pourquoi.titre")}
          </h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <Carte>
              <h3 className="font-semibold">{t("pourquoi.creneaux.titre")}</h3>
              <p className="mt-2 text-sm text-texte-attenue">
                {t("pourquoi.creneaux.texte")}
              </p>
            </Carte>
            <Carte>
              <h3 className="font-semibold">{t("pourquoi.acquisition.titre")}</h3>
              <p className="mt-2 text-sm text-texte-attenue">
                {t("pourquoi.acquisition.texte")}
              </p>
            </Carte>
            <Carte>
              <h3 className="font-semibold">{t("pourquoi.risque.titre")}</h3>
              <p className="mt-2 text-sm text-texte-attenue">
                {t("pourquoi.risque.texte")}
              </p>
            </Carte>
          </div>
        </section>

        {/* --- Ce qui est disponible --------------------------------------- */}
        <section className="mt-16">
          <h2 className="text-2xl font-semibold tracking-tight">
            {t("disponible.titre")}
          </h2>
          <p className="mt-3 max-w-2xl text-texte-attenue">
            {t("disponible.chapo")}
          </p>
          <ul className="mt-6 grid gap-x-8 gap-y-4 sm:grid-cols-2">
            {disponible.map((cle) => (
              <li key={cle} className="border-t border-bordure pt-4">
                <p className="font-medium">{t(`disponible.${cle}.titre`)}</p>
                <p className="mt-1 text-sm text-texte-attenue">
                  {t(`disponible.${cle}.texte`)}
                </p>
              </li>
            ))}
          </ul>
        </section>

        {/* --- Feuille de route ------------------------------------------- */}
        <section className="mt-16">
          <div className="flex flex-wrap items-baseline gap-3">
            <h2 className="text-2xl font-semibold tracking-tight">
              {t("preparation.titre")}
            </h2>
            <span className="rounded-full bg-attention/10 px-3 py-1 text-xs font-medium text-attention">
              {t("preparation.etiquette")}
            </span>
          </div>
          <p className="mt-3 max-w-2xl text-texte-attenue">
            {t("preparation.chapo")}
          </p>
          <ul className="mt-6 grid gap-x-8 gap-y-4 sm:grid-cols-2">
            {enPreparation.map((cle) => (
              <li key={cle} className="border-t border-bordure pt-4">
                <p className="font-medium">{t(`preparation.${cle}.titre`)}</p>
                <p className="mt-1 text-sm text-texte-attenue">
                  {t(`preparation.${cle}.texte`)}
                </p>
              </li>
            ))}
          </ul>
        </section>

        {/* --- Partenaires de lancement ------------------------------------ */}
        <section className="mt-16 rounded-carte border border-bordure bg-fond-eleve p-8 sm:p-12">
          <h2 className="text-2xl font-semibold tracking-tight">
            {t("lancement.titre")}
          </h2>
          <p className="mt-4 max-w-2xl text-texte-attenue">
            {t("lancement.chapo")}
          </p>
          <ul className="mt-6 space-y-3 text-texte-attenue">
            <li className="border-t border-bordure pt-3">
              {t("lancement.accompagnement")}
            </li>
            <li className="border-t border-bordure pt-3">
              {t("lancement.reprise")}
            </li>
            <li className="border-t border-bordure pt-3">
              {t("lancement.influence")}
            </li>
          </ul>
          <Bouton as={Link} href="/contact" taille="grand" className="mt-8">
            {t("lancement.action")}
          </Bouton>
        </section>

        {/* --- Questions fréquentes ---------------------------------------- */}
        <section className="mt-16 max-w-3xl">
          <h2 className="text-2xl font-semibold tracking-tight">
            {t("faq.titre")}
          </h2>
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
