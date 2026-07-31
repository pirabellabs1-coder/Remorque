import { getTranslations, setRequestLocale } from "next-intl/server";

import { EnTeteEspace } from "@/components/espace/coquille-espace";
import {
  BanniereEnAttente,
  CarteIndicateur,
} from "@/components/espace/indicateurs";
import { PAYS } from "@/config/villes";

type Props = { params: Promise<{ locale: string }> };

export const metadata = { robots: { index: false, follow: false } };

export default async function VueDensembleAdmin({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("espaces.admin");
  const tCommun = await getTranslations("espaces");
  const tPays = await getTranslations("accueil.villes.pays");

  const filesAttente = ["moderation", "verifications", "litiges", "sinistres"] as const;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8 sm:py-10">
      <EnTeteEspace titre={t("tableau.titre")} sousTitre={t("tableau.chapo")} />

      <div className="mt-8 space-y-10">
        <BanniereEnAttente>{tCommun("enAttente")}</BanniereEnAttente>

        <section>
          <h2 className="text-[1.0625rem] font-semibold">
            {t("tableau.activite")}
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <CarteIndicateur
              libelle={t("tableau.volume")}
              precision={t("tableau.volumePrecision")}
            />
            <CarteIndicateur
              libelle={t("tableau.reservations")}
              precision={t("tableau.reservationsPrecision")}
            />
            <CarteIndicateur
              libelle={t("tableau.commission")}
              precision={t("tableau.commissionPrecision")}
            />
            <CarteIndicateur
              libelle={t("tableau.densite")}
              precision={t("tableau.densitePrecision")}
            />
          </div>
        </section>

        {/*
          Files d'attente : c'est le vrai tableau de bord d'un administrateur.
          Ce qu'il vient voir en arrivant, ce n'est pas le chiffre d'affaires,
          c'est ce qui l'attend — une annonce à modérer, une identité à
          vérifier, un litige à arbitrer.
        */}
        <section>
          <h2 className="text-[1.0625rem] font-semibold">
            {t("tableau.files")}
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {filesAttente.map((file) => (
              <CarteIndicateur
                key={file}
                libelle={t(`tableau.file.${file}`)}
                precision={t(`tableau.file.${file}Precision`)}
              />
            ))}
          </div>
        </section>

        {/*
          Comparaison entre pays (M19). Les pays sont connus dès maintenant,
          leurs chiffres non : la structure du tableau est donc en place, ses
          cellules attendent la base.
        */}
        <section>
          <h2 className="text-[1.0625rem] font-semibold">
            {t("tableau.pays")}
          </h2>
          <div className="mt-4 overflow-x-auto rounded-carte border border-bordure bg-fond-eleve shadow-(--ombre-carte)">
            <table className="w-full min-w-[36rem] text-[0.9375rem]">
              <caption className="sr-only">{t("tableau.pays")}</caption>
              <thead>
                <tr className="border-b border-bordure text-left text-[0.8125rem] text-texte-attenue">
                  <th scope="col" className="px-5 py-3 font-medium">
                    {t("tableau.colonne.pays")}
                  </th>
                  <th scope="col" className="px-5 py-3 text-right font-medium">
                    {t("tableau.colonne.annonces")}
                  </th>
                  <th scope="col" className="px-5 py-3 text-right font-medium">
                    {t("tableau.colonne.reservations")}
                  </th>
                  <th scope="col" className="px-5 py-3 text-right font-medium">
                    {t("tableau.colonne.volume")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {PAYS.map((pays) => (
                  <tr key={pays} className="border-b border-bordure last:border-0">
                    <th scope="row" className="px-5 py-3 text-left font-normal">
                      {tPays(pays)}
                    </th>
                    <td className="px-5 py-3 text-right text-texte-attenue">—</td>
                    <td className="px-5 py-3 text-right text-texte-attenue">—</td>
                    <td className="px-5 py-3 text-right text-texte-attenue">—</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
