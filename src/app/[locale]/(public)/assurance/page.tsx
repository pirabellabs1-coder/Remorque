import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";

import { Etapes } from "@/components/marketing/etapes";
import { Faq } from "@/components/ui/faq";
import { Bouton } from "@/components/ui/bouton";
import { Carte, DonneesStructurees } from "@/components/ui/carte";
import { PageEditoriale } from "@/components/ui/mise-en-page";
import { GARANTIES, PARTENAIRE_CONFIRME } from "@/config/assurance";
import { MARKETS, type Market } from "@/config/markets";
import { Link } from "@/i18n/navigation";
import { metadonneesPage } from "@/lib/metadonnees";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "assurance" });

  return metadonneesPage({
    locale: locale as Market,
    href: "/assurance",
    titre: t("metaTitre"),
    description: t("metaDescription"),
  });
}

export default async function PageAssurance({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("assurance");
  const format = await getFormatter();
  const devise = MARKETS[locale as Market].currency;

  const montant = (centimes: number) =>
    format.number(centimes / 100, {
      style: "currency",
      currency: devise,
      maximumFractionDigits: 0,
    });

  const etapesSinistre = [1, 2, 3, 4].map((numero) => ({
    titre: t(`sinistre.etapes.e${numero}.titre`),
    texte: t(`sinistre.etapes.e${numero}.texte`),
  }));

  const questions = [
    { question: t("faq.q1"), reponse: t("faq.r1") },
    { question: t("faq.q2"), reponse: t("faq.r2") },
    { question: t("faq.q3"), reponse: t("faq.r3") },
    { question: t("faq.q4"), reponse: t("faq.r4") },
  ];

  return (
    <PageEditoriale
      surtitre={t("surtitre")}
      titre={t("titre")}
      chapo={t("chapo")}
      densite="mixte"
    >
        {/* --- Le mécanisme ---------------------------------------------- */}
        <section>
          <h2 className="text-2xl font-semibold tracking-tight">
            {t("mecanisme.titre")}
          </h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <Carte>
              <h3 className="font-semibold">
                {t("mecanisme.declenchement.titre")}
              </h3>
              <p className="mt-2 text-sm text-texte-attenue">
                {t("mecanisme.declenchement.texte")}
              </p>
            </Carte>
            <Carte>
              <h3 className="font-semibold">
                {t("mecanisme.attestation.titre")}
              </h3>
              <p className="mt-2 text-sm text-texte-attenue">
                {t("mecanisme.attestation.texte")}
              </p>
            </Carte>
            <Carte>
              <h3 className="font-semibold">{t("mecanisme.periode.titre")}</h3>
              <p className="mt-2 text-sm text-texte-attenue">
                {t("mecanisme.periode.texte")}
              </p>
            </Carte>
          </div>
        </section>

        {/* --- Garanties chiffrées, seulement si le contrat est signé ------ */}
        {PARTENAIRE_CONFIRME && GARANTIES ? (
          <section className="mt-16">
            <h2 className="text-2xl font-semibold tracking-tight">
              {t("garanties.titre")}
            </h2>
            <p className="mt-3 text-texte-attenue">
              {t("garanties.partenaire", { partenaire: GARANTIES.partenaire })}
            </p>
            <dl className="mt-6 space-y-3">
              <div className="flex justify-between border-t border-bordure pt-3">
                <dt className="text-texte-attenue">{t("garanties.plafond")}</dt>
                <dd className="tabular-nums">
                  {montant(GARANTIES.plafondParSinistre)}
                </dd>
              </div>
              <div className="flex justify-between border-t border-bordure pt-3">
                <dt className="text-texte-attenue">
                  {t("garanties.franchise")}
                </dt>
                <dd className="tabular-nums">
                  {montant(GARANTIES.franchiseStandard)}
                </dd>
              </div>
            </dl>
          </section>
        ) : (
          <section className="mt-16">
            <h2 className="text-2xl font-semibold tracking-tight">
              {t("garanties.titre")}
            </h2>
            <p className="mt-3 max-w-2xl text-texte-attenue">
              {t("garanties.ouTrouver")}
            </p>
          </section>
        )}

        {/* --- Caution et franchise ---------------------------------------- */}
        <section className="mt-16">
          <h2 className="text-2xl font-semibold tracking-tight">
            {t("caution.titre")}
          </h2>
          <p className="mt-3 max-w-2xl text-texte-attenue">
            {t("caution.chapo")}
          </p>
          <ul className="mt-6 space-y-4 text-texte-attenue">
            <li className="border-t border-bordure pt-4">
              {t("caution.empreinte")}
            </li>
            <li className="border-t border-bordure pt-4">
              {t("caution.difference")}
            </li>
            <li className="border-t border-bordure pt-4">
              {t("caution.liberation")}
            </li>
            <li className="border-t border-bordure pt-4">
              {t("caution.contestation")}
            </li>
          </ul>
        </section>

        {/* --- Déclarer un sinistre ---------------------------------------- */}
        <section className="mt-16">
          <h2 className="text-2xl font-semibold tracking-tight">
            {t("sinistre.titre")}
          </h2>
          <p className="mt-3 max-w-2xl text-texte-attenue">
            {t("sinistre.chapo")}
          </p>
          <div className="mt-8">
            <Etapes etapes={etapesSinistre} />
          </div>
        </section>

        {/* --- Le rôle des états des lieux --------------------------------- */}
        <section className="mt-16 rounded-carte border border-bordure bg-fond-eleve p-8">
          <h2 className="text-2xl font-semibold tracking-tight">
            {t("preuve.titre")}
          </h2>
          <p className="mt-3 max-w-2xl text-texte-attenue">
            {t("preuve.chapo")}
          </p>
          <p className="mt-4 max-w-2xl text-texte-attenue">
            {t("preuve.consequence")}
          </p>
        </section>

        {/* --- Questions fréquentes ---------------------------------------- */}
        <section className="mt-16">
          <h2 className="text-2xl font-semibold tracking-tight">
            {t("faq.titre")}
          </h2>
          <Faq questions={questions} className="mt-10" />
        </section>

        <div className="mt-16 flex flex-wrap gap-3">
          <Bouton as={Link} href="/recherche" taille="grand">
            {t("action")}
          </Bouton>
          <Bouton as={Link} href="/aide" variante="secondaire" taille="grand">
            {t("actionAide")}
          </Bouton>
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
    </PageEditoriale>
  );
}
