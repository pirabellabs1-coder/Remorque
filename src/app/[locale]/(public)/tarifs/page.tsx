import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";

import { Carte } from "@/components/ui/carte";
import { PageEditoriale } from "@/components/ui/mise-en-page";
import { BAREME_PAR_DEFAUT, EXEMPLE_TARIFS } from "@/config/baremes";
import { MARKETS, type Market } from "@/config/markets";
import { calculerDevis } from "@/domain/tarification/devis";
import { metadonneesPage } from "@/lib/metadonnees";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "tarifs" });

  return metadonneesPage({
    locale: locale as Market,
    href: "/tarifs",
    titre: t("metaTitre"),
    description: t("metaDescription"),
  });
}

export default async function PageTarifs({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("tarifs");
  const format = await getFormatter();
  const devise = MARKETS[locale as Market].currency;

  const devis = calculerDevis({
    prixJour: EXEMPLE_TARIFS.prixJour,
    nombreJours: EXEMPLE_TARIFS.nombreJours,
    primeAssurance: EXEMPLE_TARIFS.primeAssurance,
    bareme: BAREME_PAR_DEFAUT,
  });

  const euros = (centimes: number) =>
    format.number(centimes / 100, { style: "currency", currency: devise });

  const pourcent = (bp: number) =>
    format.number(bp / 10_000, { style: "percent", maximumFractionDigits: 1 });

  // Le droit de la consommation impose un affichage clair du prix total et une
  // transparence sur les frais (section 11) : cette page n'est pas une page
  // marketing, c'est une obligation d'information précontractuelle.
  const lignes = [
    {
      libelle: t("ligne.loyer", {
        jours: EXEMPLE_TARIFS.nombreJours,
        prix: euros(EXEMPLE_TARIFS.prixJour),
      }),
      montant: euros(devis.loyer),
      destinataire: t("destinataire.base"),
    },
    {
      libelle: t("ligne.fraisService", {
        taux: pourcent(BAREME_PAR_DEFAUT.commissionLocataireBp),
      }),
      montant: euros(devis.fraisService),
      destinataire: t("destinataire.plateforme"),
    },
    {
      libelle: t("ligne.assurance"),
      montant: euros(devis.primeAssurance),
      destinataire: t("destinataire.assureur"),
    },
  ];

  return (
    <PageEditoriale
      surtitre={t("surtitre")}
      titre={t("titre")}
      chapo={t("chapo")}
      densite="texte"
    >
        <Carte>
          <h2 className="text-lg font-semibold">{t("exemple.titre")}</h2>
          <p className="mt-2 text-sm text-texte-attenue">
            {t("exemple.contexte", {
              jours: EXEMPLE_TARIFS.nombreJours,
              prix: euros(EXEMPLE_TARIFS.prixJour),
            })}
          </p>

          <table className="mt-6 w-full text-sm">
            <caption className="sr-only">{t("exemple.titre")}</caption>
            <thead>
              <tr className="text-left text-texte-attenue">
                <th scope="col" className="pb-2 font-medium">
                  {t("colonne.ligne")}
                </th>
                <th scope="col" className="pb-2 text-right font-medium">
                  {t("colonne.montant")}
                </th>
                <th scope="col" className="pb-2 text-right font-medium">
                  {t("colonne.destinataire")}
                </th>
              </tr>
            </thead>
            <tbody>
              {lignes.map((ligne) => (
                <tr key={ligne.libelle} className="border-t border-bordure">
                  <th scope="row" className="py-3 text-left font-normal">
                    {ligne.libelle}
                  </th>
                  <td className="py-3 text-right tabular-nums">
                    {ligne.montant}
                  </td>
                  <td className="py-3 text-right text-texte-attenue">
                    {ligne.destinataire}
                  </td>
                </tr>
              ))}
              <tr className="border-t-2 border-texte font-semibold">
                <th scope="row" className="py-3 text-left">
                  {t("ligne.total")}
                </th>
                <td className="py-3 text-right tabular-nums">
                  {euros(devis.totalLocataire)}
                </td>
                <td />
              </tr>
            </tbody>
          </table>

          <p className="mt-6 rounded-champ bg-fond p-4 text-sm text-texte-attenue">
            {t("exemple.caution", {
              montant: euros(EXEMPLE_TARIFS.caution),
              heures: BAREME_PAR_DEFAUT.cautionLiberationHeures,
            })}
          </p>
        </Carte>

        <section className="mt-12">
          <h2 className="text-2xl font-semibold">{t("proprietaire.titre")}</h2>
          <p className="mt-4 text-texte-attenue">
            {t("proprietaire.texte", {
              taux: pourcent(BAREME_PAR_DEFAUT.commissionProprietaireBp),
            })}
          </p>

          <dl className="mt-6 space-y-3 text-sm">
            <div className="flex justify-between border-t border-bordure pt-3">
              <dt className="text-texte-attenue">
                {t("proprietaire.commission")}
              </dt>
              <dd className="tabular-nums">
                − {euros(devis.commissionProprietaire)}
              </dd>
            </div>
            <div className="flex justify-between border-t border-bordure pt-3 font-semibold">
              <dt>{t("proprietaire.reverse")}</dt>
              <dd className="tabular-nums">{euros(devis.montantReverse)}</dd>
            </div>
          </dl>
        </section>

        <section className="mt-12">
          <h2 className="text-2xl font-semibold">{t("engagements.titre")}</h2>
          <ul className="mt-6 space-y-4 text-texte-attenue">
            <li className="border-t border-bordure pt-4">
              {t("engagements.sansFraisCaches")}
            </li>
            <li className="border-t border-bordure pt-4">
              {t("engagements.publication")}
            </li>
            <li className="border-t border-bordure pt-4">
              {t("engagements.annulation")}
            </li>
          </ul>
        </section>

        <p className="mt-12 text-sm text-texte-attenue">{t("mentionBareme")}</p>
    </PageEditoriale>
  );
}
