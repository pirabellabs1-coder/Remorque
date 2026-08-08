import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";

import { CompteReversement } from "@/components/espace/compte-reversement";
import { EnTeteEspace } from "@/components/espace/coquille-espace";
import { Anneau, Barres, Courbe } from "@/components/espace/graphique";
import { CarteIndicateur } from "@/components/espace/indicateurs";
import { PRIX_AFFICHE } from "@/lib/cn";
import { etatCompteReversement } from "@/server/paiements/reversement";
import {
  revenusParAnnonce,
  revenusParMois,
  syntheseLoueur,
} from "@/server/espaces/activite";

type Props = { params: Promise<{ locale: string }> };

export const metadata = { robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * Revenus du loueur.
 *
 * La commission est affichée explicitement, mois par mois, à côté du brut et
 * du net. Une place de marché qui cache son prélèvement derrière un seul
 * « net perçu » se prépare des tickets de support et des soupçons ; celle qui
 * l'écrit n'en reçoit pas.
 */
export default async function PageRevenus({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("espaces.loueur.revenus");
  const format = await getFormatter();

  const synthese = await syntheseLoueur();
  const mois = await revenusParMois(12);
  const parAnnonce = await revenusParAnnonce();

  const montant = (centimes: number) =>
    format.number(centimes / 100, {
      ...PRIX_AFFICHE,
      currency: synthese.devise,
    });

  const totaux = mois.reduce(
    (somme, entree) => ({
      brut: somme.brut + entree.brut,
      commission: somme.commission + entree.commission,
      net: somme.net + entree.net,
      locations: somme.locations + entree.locations,
    }),
    { brut: 0, commission: 0, net: 0, locations: 0 },
  );

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8 sm:py-10">
      <EnTeteEspace titre={t("titre")} sousTitre={t("chapo")} />

      {/* Sans compte de reversement, aucun virement n'est possible : la
          question passe donc avant les chiffres, puisqu'elle les conditionne. */}
      <CompteReversement etat={await etatCompteReversement()} />

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <CarteIndicateur libelle={t("brut")} valeur={montant(totaux.brut)} />
        <CarteIndicateur
          libelle={t("commission")}
          valeur={montant(totaux.commission)}
        />
        <CarteIndicateur libelle={t("net")} valeur={montant(totaux.net)} />
        <CarteIndicateur libelle={t("locations")} valeur={totaux.locations} />
      </div>

      <section className="mt-8 rounded-carte border border-bordure bg-fond-eleve p-6 shadow-(--ombre-carte)">
        <h2 className="text-[1.0625rem] font-semibold">{t("courbeTitre")}</h2>
        <div className="mt-6">
          <Courbe
            points={mois.map((entree) => ({
              etiquette: entree.etiquette,
              valeur: entree.net / 100,
            }))}
            description={t("courbeLegende")}
            format={(valeur) =>
              format.number(valeur, {
                ...PRIX_AFFICHE,
                currency: synthese.devise,
              })
            }
          />
        </div>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-carte border border-bordure bg-fond-eleve p-6 shadow-(--ombre-carte)">
          <h2 className="text-[1.0625rem] font-semibold">
            {t("commissionTitre")}
          </h2>
          <div className="mt-6">
            <Anneau
              parts={[
                {
                  etiquette: t("partNet"),
                  valeur: totaux.net,
                  teinte: "var(--accent)",
                },
                {
                  etiquette: t("partCommission"),
                  valeur: totaux.commission,
                  teinte: "#c3d6f9",
                },
              ]}
              centre={montant(totaux.brut)}
              legende={t("commissionLegende")}
            />
          </div>
        </section>

        <section className="rounded-carte border border-bordure bg-fond-eleve p-6 shadow-(--ombre-carte)">
          <h2 className="text-[1.0625rem] font-semibold">
            {t("parAnnonceTitre")}
          </h2>
          <div className="mt-6">
            <Barres
              points={parAnnonce.slice(0, 6).map((entree) => ({
                etiquette: entree.titre,
                valeur: entree.net,
              }))}
              format={montant}
            />
          </div>
        </section>
      </div>

      {/* ---------- Détail mensuel ---------- */}
      <section className="mt-8">
        <h2 className="text-[1.0625rem] font-semibold">{t("detailTitre")}</h2>

        <div className="mt-4 overflow-x-auto rounded-carte border border-bordure bg-fond-eleve shadow-(--ombre-carte)">
          <table className="w-full text-left text-[0.9375rem]">
            <thead className="border-b border-bordure text-sm text-texte-attenue">
              <tr>
                <th scope="col" className="px-5 py-3 font-medium">
                  {t("mois")}
                </th>
                <th scope="col" className="px-5 py-3 text-right font-medium">
                  {t("locations")}
                </th>
                <th scope="col" className="px-5 py-3 text-right font-medium">
                  {t("brut")}
                </th>
                <th scope="col" className="px-5 py-3 text-right font-medium">
                  {t("commission")}
                </th>
                <th scope="col" className="px-5 py-3 text-right font-medium">
                  {t("net")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-bordure">
              {mois.map((entree) => (
                <tr key={entree.cle}>
                  <th scope="row" className="px-5 py-3 font-normal capitalize">
                    {entree.etiquette}
                  </th>
                  <td className="px-5 py-3 text-right tabular-nums">
                    {entree.locations}
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums">
                    {montant(entree.brut)}
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums text-texte-attenue">
                    −{montant(entree.commission)}
                  </td>
                  <td className="px-5 py-3 text-right font-medium tabular-nums">
                    {montant(entree.net)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-bordure font-semibold">
              <tr>
                <th scope="row" className="px-5 py-3 text-left">
                  {t("total")}
                </th>
                <td className="px-5 py-3 text-right tabular-nums">
                  {totaux.locations}
                </td>
                <td className="px-5 py-3 text-right tabular-nums">
                  {montant(totaux.brut)}
                </td>
                <td className="px-5 py-3 text-right tabular-nums">
                  −{montant(totaux.commission)}
                </td>
                <td className="px-5 py-3 text-right tabular-nums">
                  {montant(totaux.net)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <section className="mt-8 rounded-carte border border-bordure bg-fond-doux p-6">
        <h2 className="text-[0.9375rem] font-semibold">{t("versementTitre")}</h2>
        <p className="mt-2 max-w-2xl text-[0.9375rem] text-texte-attenue">
          {t("versementTexte")}
        </p>
      </section>
    </div>
  );
}
