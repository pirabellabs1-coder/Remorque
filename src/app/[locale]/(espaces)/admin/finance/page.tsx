import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";

import { EnTeteEspace } from "@/components/espace/coquille-espace";
import { Anneau, Courbe } from "@/components/espace/graphique";
import { CarteIndicateur } from "@/components/espace/indicateurs";
import { Cellule, Tableau } from "@/components/espace/tableau";
import { PRIX_AFFICHE } from "@/lib/cn";
import { revenusParMois } from "@/server/espaces/activite";
import {
  listerLitiges,
  listerSinistres,
  syntheseAdmin,
} from "@/server/espaces/administration";

type Props = { params: Promise<{ locale: string }> };

export const metadata = { robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * Finance de la plateforme.
 *
 * Le volume d'affaires n'est pas le revenu : la plateforme encaisse le premier
 * et ne garde que la commission. Les deux sont donc affichés côte à côte, avec
 * ce qui est reversé aux loueurs — confondre les trois est l'erreur la plus
 * coûteuse qu'un tableau de bord de place de marché puisse induire.
 */
export default async function PageFinance({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("espaces.admin.finance");
  const format = await getFormatter();

  const synthese = syntheseAdmin();
  const mois = revenusParMois(12);

  const montant = (centimes: number) =>
    format.number(centimes / 100, {
      ...PRIX_AFFICHE,
      currency: synthese.devise,
    });

  const reverse = synthese.volumeAffaires - synthese.commissionPercue;

  const geleParLitiges = listerLitiges()
    .filter((litige) => litige.statut !== "resolu")
    .reduce((somme, litige) => somme + litige.fondsGeles, 0);
  const geleParSinistres = listerSinistres()
    .filter((sinistre) => ["declare", "transmis"].includes(sinistre.statut))
    .reduce((somme, sinistre) => somme + sinistre.montantEstime, 0);

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

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <CarteIndicateur
          libelle={t("volume")}
          valeur={montant(synthese.volumeAffaires)}
          precision={t("volumePrecision")}
        />
        <CarteIndicateur
          libelle={t("commission")}
          valeur={montant(synthese.commissionPercue)}
          precision={t("commissionPrecision")}
        />
        <CarteIndicateur
          libelle={t("reverse")}
          valeur={montant(reverse)}
          precision={t("reversePrecision")}
        />
        <CarteIndicateur
          libelle={t("gel")}
          valeur={montant(synthese.fondsGeles)}
          precision={t("gelPrecision")}
        />
      </div>

      <section className="mt-8 rounded-carte border border-bordure bg-fond-eleve p-6 shadow-(--ombre-carte)">
        <h2 className="text-[1.0625rem] font-semibold">{t("courbeTitre")}</h2>
        <div className="mt-6">
          <Courbe
            points={mois.map((entree) => ({
              etiquette: entree.etiquette,
              valeur: entree.brut / 100,
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
            {t("repartitionTitre")}
          </h2>
          <div className="mt-6">
            <Anneau
              parts={[
                {
                  etiquette: t("partLoueurs"),
                  valeur: reverse,
                  teinte: "var(--accent)",
                },
                {
                  etiquette: t("partCommission"),
                  valeur: synthese.commissionPercue,
                  teinte: "#c3d6f9",
                },
              ]}
              centre={montant(synthese.volumeAffaires)}
              legende={t("repartitionLegende")}
            />
          </div>
        </section>

        {/* Détail du gel : un chiffre unique ne dit pas s'il faut relancer un
            assureur ou arbitrer un litige. */}
        <section className="rounded-carte border border-bordure bg-fond-eleve p-6 shadow-(--ombre-carte)">
          <h2 className="text-[1.0625rem] font-semibold">{t("gelTitre")}</h2>

          <Tableau
            className="mt-6 border-0 shadow-none"
            colonnes={[
              { cle: "origine", entete: t("gelOrigine") },
              { cle: "montant", entete: t("montant"), numerique: true },
            ]}
          >
            <tr>
              <th scope="row" className="px-5 py-3.5 text-left font-normal">
                {t("gelLitiges")}
              </th>
              <Cellule numerique>{montant(geleParLitiges)}</Cellule>
            </tr>
            <tr>
              <th scope="row" className="px-5 py-3.5 text-left font-normal">
                {t("gelSinistres")}
              </th>
              <Cellule numerique>{montant(geleParSinistres)}</Cellule>
            </tr>
          </Tableau>

          <p className="mt-4 text-[0.9375rem] text-texte-attenue">
            {t("gelTexte")}
          </p>
        </section>
      </div>

      <section className="mt-8">
        <h2 className="text-[1.0625rem] font-semibold">{t("detailTitre")}</h2>
        <Tableau
          className="mt-4"
          colonnes={[
            { cle: "mois", entete: t("mois") },
            { cle: "locations", entete: t("locations"), numerique: true },
            { cle: "brut", entete: t("volume"), numerique: true },
            { cle: "commission", entete: t("commission"), numerique: true },
            { cle: "net", entete: t("net"), numerique: true },
          ]}
          pied={
            <tr>
              <th scope="row" className="px-5 py-3.5 text-left">
                {t("detailTitre")}
              </th>
              <Cellule numerique>{totaux.locations}</Cellule>
              <Cellule numerique>{montant(totaux.brut)}</Cellule>
              <Cellule numerique>{montant(totaux.commission)}</Cellule>
              <Cellule numerique>{montant(totaux.net)}</Cellule>
            </tr>
          }
        >
          {mois.map((entree) => (
            <tr key={entree.cle}>
              <th scope="row" className="px-5 py-3.5 text-left font-normal capitalize">
                {entree.etiquette}
              </th>
              <Cellule numerique>{entree.locations}</Cellule>
              <Cellule numerique>{montant(entree.brut)}</Cellule>
              <Cellule numerique attenue>
                {montant(entree.commission)}
              </Cellule>
              <Cellule numerique>{montant(entree.net)}</Cellule>
            </tr>
          ))}
        </Tableau>
      </section>
    </div>
  );
}
