import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";

import { EnTeteEspace } from "@/components/espace/coquille-espace";
import { ListeVide } from "@/components/espace/indicateurs";
import { PastilleStatut } from "@/components/espace/statut";
import { Link } from "@/i18n/navigation";
import { cn, PRIX_AFFICHE } from "@/lib/cn";
import { listerReservations } from "@/server/espaces/activite";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ filtre?: string }>;
};

export const metadata = { robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * Les cinq filtres correspondent à des intentions, non à des statuts. Le
 * loueur ne se demande pas « quelles réservations sont au statut restituée »,
 * il se demande « qu'est-ce que je dois traiter aujourd'hui ».
 */
const FILTRES = {
  toutes: () => true,
  aTraiter: (statut: string) => ["demandee", "restituee"].includes(statut),
  aVenir: (statut: string) => ["acceptee", "payee", "confirmee"].includes(statut),
  enCours: (statut: string) => statut === "en_cours",
  terminees: (statut: string) =>
    ["cloturee", "annulee", "refusee", "expiree"].includes(statut),
} as const;

type ClefFiltre = keyof typeof FILTRES;

export default async function PageReservations({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { filtre } = await searchParams;
  const actif: ClefFiltre =
    filtre && filtre in FILTRES ? (filtre as ClefFiltre) : "toutes";

  const t = await getTranslations("espaces.loueur.reservations");
  const format = await getFormatter();

  const toutes = listerReservations();
  const reservations = toutes.filter((reservation) =>
    FILTRES[actif](reservation.statut),
  );

  const jour = (date: Date) =>
    format.dateTime(date, { day: "2-digit", month: "2-digit", year: "2-digit" });

  const duree = (debut: Date, fin: Date) =>
    Math.max(1, Math.round((fin.getTime() - debut.getTime()) / 86_400_000));

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8 sm:py-10">
      <EnTeteEspace
        titre={t("titre")}
        sousTitre={t("chapo", { nombre: toutes.length })}
      />

      {/* Onglets de filtre — de simples liens, donc partageables, ouvrables
          dans un nouvel onglet et fonctionnels sans JavaScript. */}
      <nav className="mt-6 flex flex-wrap gap-2">
        {(Object.keys(FILTRES) as ClefFiltre[]).map((clef) => {
          const nombre = toutes.filter((reservation) =>
            FILTRES[clef](reservation.statut),
          ).length;

          return (
            <Link
              key={clef}
              href={
                clef === "toutes"
                  ? { pathname: "/proprietaire/reservations" }
                  : { pathname: "/proprietaire/reservations", query: { filtre: clef } }
              }
              aria-current={clef === actif ? "page" : undefined}
              className={cn(
                "rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                clef === actif
                  ? "border-accent bg-accent text-accent-contraste"
                  : "border-bordure bg-fond-eleve hover:border-accent hover:text-accent",
              )}
            >
              {t(clef)}
              <span className="ml-2 tabular-nums opacity-70">{nombre}</span>
            </Link>
          );
        })}
      </nav>

      {reservations.length === 0 ? (
        <div className="mt-8">
          <ListeVide titre={t("vide.titre")} texte={t("vide.texte")} />
        </div>
      ) : (
        <>
          {/* Tableau sur grand écran. Le défilement horizontal est confié à un
              conteneur dédié : c'est la page entière qui ne doit jamais
              défiler latéralement. */}
          <div className="mt-8 hidden overflow-x-auto rounded-carte border border-bordure bg-fond-eleve shadow-(--ombre-carte) lg:block">
            <table className="w-full text-left text-[0.9375rem]">
              <thead className="border-b border-bordure text-sm text-texte-attenue">
                <tr>
                  <th scope="col" className="px-5 py-3 font-medium">
                    {t("reference")}
                  </th>
                  <th scope="col" className="px-5 py-3 font-medium">
                    {t("locataire")}
                  </th>
                  <th scope="col" className="px-5 py-3 font-medium">
                    {t("materiel")}
                  </th>
                  <th scope="col" className="px-5 py-3 font-medium">
                    {t("dates")}
                  </th>
                  <th scope="col" className="px-5 py-3 text-right font-medium">
                    {t("montant")}
                  </th>
                  <th scope="col" className="px-5 py-3 font-medium">
                    {t("statut")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-bordure">
                {reservations.map((reservation) => (
                  <tr key={reservation.id}>
                    <td className="px-5 py-4 font-mono text-sm whitespace-nowrap text-texte-attenue">
                      {reservation.reference}
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      {reservation.locataire}
                    </td>
                    <td className="max-w-56 truncate px-5 py-4">
                      {reservation.annonceTitre}
                      <span className="block text-sm text-texte-attenue">
                        {reservation.ville}
                      </span>
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      {jour(reservation.debut)} → {jour(reservation.fin)}
                      <span className="block text-sm text-texte-attenue">
                        {t("duree", {
                          nombre: duree(reservation.debut, reservation.fin),
                        })}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right font-medium tabular-nums whitespace-nowrap">
                      {format.number(reservation.netProprietaire / 100, {
                        ...PRIX_AFFICHE,
                        currency: reservation.devise,
                      })}
                    </td>
                    <td className="px-5 py-4">
                      <PastilleStatut statut={reservation.statut} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Cartes sur petit écran : un tableau à six colonnes ne se lit pas
              sur un téléphone, quel que soit le défilement proposé. */}
          <ul className="mt-8 space-y-3 lg:hidden">
            {reservations.map((reservation) => (
              <li
                key={reservation.id}
                className="rounded-carte border border-bordure bg-fond-eleve p-4 shadow-(--ombre-carte)"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 flex-1 font-medium">
                    {reservation.annonceTitre}
                  </p>
                  <PastilleStatut statut={reservation.statut} />
                </div>
                <p className="mt-2 text-sm text-texte-attenue">
                  {reservation.locataire} · {reservation.ville}
                </p>
                <div className="mt-3 flex items-baseline justify-between gap-3 border-t border-bordure pt-3 text-sm">
                  <span>
                    {jour(reservation.debut)} → {jour(reservation.fin)}
                  </span>
                  <span className="font-bold tabular-nums">
                    {format.number(reservation.netProprietaire / 100, {
                      ...PRIX_AFFICHE,
                      currency: reservation.devise,
                    })}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
