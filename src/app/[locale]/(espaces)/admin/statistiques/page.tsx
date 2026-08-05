import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";

import { EnTeteEspace } from "@/components/espace/coquille-espace";
import { Anneau, Barres, Courbe } from "@/components/espace/graphique";
import { CarteIndicateur } from "@/components/espace/indicateurs";
import { CATEGORIES } from "@/config/categories";
import { PRIX_AFFICHE } from "@/lib/cn";
import { listerAnnonces } from "@/server/annonces/depot";
import { listerReservations, revenusParMois } from "@/server/espaces/activite";
import {
  comparaisonPays,
  inscriptionsParMois,
  listerLitiges,
  listerSinistres,
  syntheseAdmin,
} from "@/server/espaces/administration";

type Props = { params: Promise<{ locale: string }> };

export const metadata = { robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const ENCAISSES = ["payee", "confirmee", "en_cours", "restituee", "cloturee"];

/**
 * Statistiques.
 *
 * Trois familles, dans cet ordre : la croissance, le marché, la qualité de
 * service. Les taux de litige et de sinistre sont les plus importants et les
 * plus faciles à oublier — ce sont eux qui décident du coût de l'assurance et,
 * à terme, de la viabilité du modèle.
 */
export default async function PageStatistiques({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("espaces.admin.statistiques");
  const tPays = await getTranslations("accueil.villes.pays");
  const format = await getFormatter();

  const synthese = syntheseAdmin();
  const mois = revenusParMois(12);
  const inscriptions = inscriptionsParMois(12);
  const pays = comparaisonPays();

  const reservations = listerReservations().filter((reservation) =>
    ENCAISSES.includes(reservation.statut),
  );
  const annonces = await listerAnnonces();

  const montant = (centimes: number) =>
    format.number(centimes / 100, {
      ...PRIX_AFFICHE,
      currency: synthese.devise,
    });

  const idsParCategorie = new Map(
    annonces.map((annonce) => [annonce.id, annonce.categorie]),
  );

  const parCategorie = CATEGORIES.map((categorie) => ({
    etiquette: categorie.nom,
    valeur: reservations.filter(
      (reservation) => idsParCategorie.get(reservation.annonceId) === categorie.slug,
    ).length,
  }))
    .filter((entree) => entree.valeur > 0)
    .sort((a, b) => b.valeur - a.valeur);

  const parVille = [
    ...reservations.reduce((compte, reservation) => {
      compte.set(reservation.ville, (compte.get(reservation.ville) ?? 0) + 1);
      return compte;
    }, new Map<string, number>()),
  ]
    .map(([ville, nombre]) => ({ etiquette: ville, valeur: nombre }))
    .sort((a, b) => b.valeur - a.valeur)
    .slice(0, 8);

  // Taux rapportés aux locations encaissées, non au total : une demande
  // refusée n'a jamais pu produire ni litige ni sinistre, l'inclure au
  // dénominateur diluerait artificiellement les deux taux.
  const tauxLitige =
    reservations.length > 0
      ? (listerLitiges().length / reservations.length) * 100
      : null;
  const tauxSinistre =
    reservations.length > 0
      ? (listerSinistres().length / reservations.length) * 100
      : null;

  const panierMoyen =
    reservations.length > 0
      ? Math.round(synthese.volumeAffaires / reservations.length)
      : 0;

  const TEINTES = ["var(--accent)", "#5b8def", "#8fb4f5", "#c3d6f9"];

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8 sm:py-10">
      <EnTeteEspace titre={t("titre")} sousTitre={t("chapo")} />

      {/* ---------- Croissance ---------- */}
      <section className="mt-8">
        <h2 className="text-[1.0625rem] font-semibold">{t("croissance")}</h2>

        <div className="mt-4 grid gap-6 lg:grid-cols-2">
          <div className="rounded-carte border border-bordure bg-fond-eleve p-6 shadow-(--ombre-carte)">
            <h3 className="text-[0.9375rem] font-medium">
              {t("inscriptionsTitre")}
            </h3>
            <div className="mt-6">
              <Courbe
                points={inscriptions}
                description={t("inscriptionsLegende")}
                format={(valeur) => format.number(valeur)}
              />
            </div>
          </div>

          <div className="rounded-carte border border-bordure bg-fond-eleve p-6 shadow-(--ombre-carte)">
            <h3 className="text-[0.9375rem] font-medium">{t("volumeTitre")}</h3>
            <div className="mt-6">
              <Courbe
                points={mois.map((entree) => ({
                  etiquette: entree.etiquette,
                  valeur: entree.brut / 100,
                }))}
                description={t("volumeLegende")}
                format={(valeur) =>
                  format.number(valeur, {
                    ...PRIX_AFFICHE,
                    currency: synthese.devise,
                  })
                }
              />
            </div>
          </div>
        </div>
      </section>

      {/* ---------- Marché ---------- */}
      <section className="mt-10">
        <h2 className="text-[1.0625rem] font-semibold">{t("marche")}</h2>

        <div className="mt-4 grid gap-6 lg:grid-cols-3">
          <div className="rounded-carte border border-bordure bg-fond-eleve p-6 shadow-(--ombre-carte)">
            <h3 className="text-[0.9375rem] font-medium">{t("parPays")}</h3>
            <div className="mt-6">
              <Anneau
                parts={pays
                  .filter((ligne) => ligne.volume > 0)
                  .slice(0, 4)
                  .map((ligne, index) => ({
                    etiquette: tPays(ligne.pays),
                    valeur: ligne.volume,
                    teinte: TEINTES[index],
                  }))}
                centre={montant(synthese.volumeAffaires)}
                legende={t("parPaysLegende")}
              />
            </div>
          </div>

          <div className="rounded-carte border border-bordure bg-fond-eleve p-6 shadow-(--ombre-carte)">
            <h3 className="text-[0.9375rem] font-medium">{t("parCategorie")}</h3>
            <div className="mt-6">
              <Barres points={parCategorie} />
            </div>
          </div>

          <div className="rounded-carte border border-bordure bg-fond-eleve p-6 shadow-(--ombre-carte)">
            <h3 className="text-[0.9375rem] font-medium">{t("parVille")}</h3>
            <div className="mt-6">
              <Barres points={parVille} />
            </div>
          </div>
        </div>
      </section>

      {/* ---------- Qualité de service ---------- */}
      <section className="mt-10">
        <h2 className="text-[1.0625rem] font-semibold">{t("qualite")}</h2>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <CarteIndicateur
            libelle={t("tauxLitige")}
            valeur={
              tauxLitige === null
                ? undefined
                : `${format.number(tauxLitige, { maximumFractionDigits: 1 })} %`
            }
            precision={t("tauxLitigePrecision")}
          />
          <CarteIndicateur
            libelle={t("tauxSinistre")}
            valeur={
              tauxSinistre === null
                ? undefined
                : `${format.number(tauxSinistre, { maximumFractionDigits: 1 })} %`
            }
            precision={t("tauxSinistrePrecision")}
          />
          <CarteIndicateur
            libelle={t("noteMoyenne")}
            valeur={
              synthese.noteMoyenne === null
                ? undefined
                : format.number(synthese.noteMoyenne, {
                    maximumFractionDigits: 2,
                  })
            }
            precision={t("noteMoyennePrecision")}
          />
          <CarteIndicateur
            libelle={t("panierMoyen")}
            valeur={montant(panierMoyen)}
            precision={t("panierMoyenPrecision")}
          />
        </div>
      </section>
    </div>
  );
}
