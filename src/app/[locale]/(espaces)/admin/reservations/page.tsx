import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";

import { EnTeteEspace } from "@/components/espace/coquille-espace";
import { Barres } from "@/components/espace/graphique";
import { PastilleStatut } from "@/components/espace/statut";
import { Cellule, Tableau } from "@/components/espace/tableau";
import { ActionsAdministrationReservation } from "@/components/espace/actions-administration-reservation";
import {
  STATUTS,
  type StatutReservation,
} from "@/domain/reservation/machine";
import { PRIX_AFFICHE } from "@/lib/cn";
import {
  listerReservationsPlateforme,
} from "@/server/espaces/administration";

type Props = { params: Promise<{ locale: string }> };

export const metadata = { robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function PageReservationsAdmin({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("espaces.admin.reservations");
  const tStatuts = await getTranslations("espaces.statuts");
  const format = await getFormatter();

  const reservations = await listerReservationsPlateforme();

  // Répartition par statut : elle raconte la santé du parcours. Beaucoup
  // d'« expirée » signale des loueurs qui ne répondent pas ; beaucoup
  // d'« annulée » un problème de qualité d'annonce.
  const repartition = STATUTS.map((statut) => ({
    etiquette: tStatuts(statut),
    valeur: reservations.filter((reservation) => reservation.statut === statut)
      .length,
  })).filter((entree) => entree.valeur > 0);

  const jour = (date: Date) =>
    format.dateTime(date, { day: "2-digit", month: "2-digit", year: "2-digit" });

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-8 sm:py-10">
      <EnTeteEspace titre={t("titre")} sousTitre={t("chapo")} />

      <section className="mt-8 rounded-carte border border-bordure bg-fond-eleve p-6 shadow-(--ombre-carte)">
        <h2 className="text-[1.0625rem] font-semibold">
          {t("repartitionTitre")}
        </h2>
        <div className="mt-6">
          <Barres points={repartition} />
        </div>
      </section>

      <Tableau
        className="mt-8"
        colonnes={[
          { cle: "reference", entete: t("reference") },
          { cle: "locataire", entete: t("locataire"), secondaire: true },
          { cle: "materiel", entete: t("materiel") },
          { cle: "dates", entete: t("dates"), secondaire: true },
          { cle: "brut", entete: t("brut"), numerique: true },
          { cle: "commission", entete: t("commission"), numerique: true, secondaire: true },
          { cle: "statut", entete: t("statut") },
        ]}
      >
        {reservations.slice(0, 60).map((reservation) => (
          <tr key={reservation.id}>
            <th
              scope="row"
              className="px-5 py-3.5 text-left font-mono text-sm font-normal whitespace-nowrap"
            >
              {reservation.reference}
            </th>
            <Cellule secondaire>{reservation.locataire}</Cellule>
            <Cellule className="max-w-56 truncate">
              {reservation.annonceTitre}
              <span className="block text-sm text-texte-attenue">
                {reservation.ville}
              </span>
            </Cellule>
            <Cellule secondaire attenue className="whitespace-nowrap">
              {jour(reservation.debut)} → {jour(reservation.fin)}
            </Cellule>
            <Cellule numerique>
              {format.number(reservation.montantTotal / 100, {
                ...PRIX_AFFICHE,
                currency: reservation.devise,
              })}
            </Cellule>
            <Cellule numerique secondaire attenue>
              {format.number(reservation.commission / 100, {
                ...PRIX_AFFICHE,
                currency: reservation.devise,
              })}
            </Cellule>
            <Cellule>
              <PastilleStatut statut={reservation.statut} />
              {/* La commande vit sous la pastille, repliée. Le tableau reste
                  un écran de consultation ; forcer une transition demande un
                  geste délibéré, puis un motif. */}
              <ActionsAdministrationReservation
                reservationId={reservation.id}
                statut={reservation.statut as StatutReservation}
              />
            </Cellule>
          </tr>
        ))}
      </Tableau>
    </div>
  );
}
