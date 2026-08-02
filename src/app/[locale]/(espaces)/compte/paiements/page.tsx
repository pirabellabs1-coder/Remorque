import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";

import { EnTeteEspace } from "@/components/espace/coquille-espace";
import { CarteIndicateur, ListeVide } from "@/components/espace/indicateurs";
import { Cellule, Pastille, type TonPastille, Tableau } from "@/components/espace/tableau";
import { PRIX_AFFICHE } from "@/lib/cn";
import {
  type EtatCaution,
  mesPaiements,
  mesReservations,
  syntheseLocataire,
} from "@/server/espaces/locataire";

type Props = { params: Promise<{ locale: string }> };

export const metadata = { robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * Le ton dit l'urgence pour *le locataire*, pas l'état du dossier.
 *
 * « Gelée » est neutre : c'est le fonctionnement normal, rien n'a été prélevé.
 * « Suspendue » est en danger parce qu'un litige bloque la restitution de son
 * argent — c'est la seule ligne sur laquelle il doit agir.
 */
const TONS: Record<EtatCaution, TonPastille> = {
  empreinte: "neutre",
  en_liberation: "attente",
  liberee: "succes",
  gelee: "danger",
  retenue: "danger",
};

export default async function PagePaiements({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("espaces.locataire.paiements");
  const format = await getFormatter();

  const lignes = mesPaiements();
  const synthese = syntheseLocataire();
  const reservations = mesReservations();

  const montant = (centimes: number, devise: string) =>
    format.number(centimes / 100, { ...PRIX_AFFICHE, currency: devise });

  const retenueParReference = new Map(
    reservations
      .filter((reservation) => reservation.cautionRetenue > 0)
      .map((reservation) => [reservation.reference, reservation.cautionRetenue]),
  );

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-8 sm:py-10">
      <EnTeteEspace titre={t("titre")} sousTitre={t("chapo")} />

      {/* L'explication passe avant le relevé, et non en note de bas de page.
          C'est le malentendu le plus coûteux du parcours — « on m'a prélevé
          800 € » — et il se lève en une phrase, à condition de la lire avant
          les chiffres. */}
      <p className="mt-8 rounded-champ border border-accent/30 bg-accent/5 px-4 py-3 text-[0.9375rem]">
        {t("explication")}
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <CarteIndicateur
          libelle={t("cautionsGelees")}
          valeur={montant(synthese.cautionsGelees, synthese.devise)}
          precision={t("cautionsGeleesPrecision", {
            nombre: synthese.cautionsNombre,
          })}
        />
        <CarteIndicateur
          libelle={t("totalDepense")}
          valeur={montant(synthese.totalDepense, synthese.devise)}
          precision={t("totalDepensePrecision")}
        />
      </div>

      {lignes.length === 0 ? (
        <div className="mt-8">
          <ListeVide titre={t("vide.titre")} texte={t("vide.texte")} />
        </div>
      ) : (
        <Tableau
          className="mt-8"
          colonnes={[
            { cle: "date", entete: t("date") },
            { cle: "operation", entete: t("operation") },
            { cle: "moyen", entete: t("moyen"), secondaire: true },
            { cle: "montant", entete: t("montant"), numerique: true },
            { cle: "etat", entete: t("etat") },
          ]}
        >
          {lignes.map((ligne) => {
            const retenue =
              ligne.nature === "caution" && ligne.cautionEtat === "retenue"
                ? retenueParReference.get(ligne.reference)
                : undefined;

            return (
              <tr key={ligne.id}>
                <th
                  scope="row"
                  className="px-5 py-3.5 text-left text-sm font-normal whitespace-nowrap tabular-nums"
                >
                  {format.dateTime(ligne.date, {
                    day: "2-digit",
                    month: "2-digit",
                    year: "2-digit",
                  })}
                </th>

                <Cellule className="max-w-72">
                  <span className="block truncate">{ligne.annonceTitre}</span>
                  <span className="mt-0.5 block text-sm text-texte-attenue">
                    {t(`natures.${ligne.nature}` as never)}
                    {" · "}
                    <span className="font-mono">{ligne.reference}</span>
                  </span>
                </Cellule>

                <Cellule secondaire attenue className="whitespace-nowrap">
                  {ligne.moyen}
                </Cellule>

                <Cellule numerique>
                  {/* La caution n'est pas signée : elle n'est ni débitée ni
                      créditée, seulement immobilisée. Le remboursement l'est,
                      lui, et se lit d'emblée comme une entrée. */}
                  <span
                    className={
                      ligne.nature === "remboursement" ? "text-succes" : undefined
                    }
                  >
                    {ligne.nature === "remboursement" ? "+ " : ""}
                    {montant(ligne.montant, ligne.devise)}
                  </span>
                  {retenue ? (
                    <span className="mt-0.5 block text-xs font-normal text-danger">
                      {t("retenue", { montant: montant(retenue, ligne.devise) })}
                    </span>
                  ) : null}
                </Cellule>

                <Cellule>
                  {ligne.cautionEtat ? (
                    <>
                      <Pastille ton={TONS[ligne.cautionEtat]}>
                        {t(`cautions.${ligne.cautionEtat}` as never)}
                      </Pastille>
                      <span className="mt-1 block max-w-56 text-xs text-texte-attenue">
                        {t(`aides.${ligne.cautionEtat}` as never)}
                      </span>
                    </>
                  ) : (
                    <span className="text-texte-attenue">—</span>
                  )}
                </Cellule>
              </tr>
            );
          })}
        </Tableau>
      )}
    </div>
  );
}
