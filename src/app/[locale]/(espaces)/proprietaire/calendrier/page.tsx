import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";

import { EnTeteEspace } from "@/components/espace/coquille-espace";
import { PastilleStatut } from "@/components/espace/statut";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { listerReservations } from "@/server/espaces/activite";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ mois?: string }>;
};

export const metadata = { robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Statuts qui occupent réellement le matériel — les autres ne bloquent rien. */
const OCCUPANTS = ["acceptee", "payee", "confirmee", "en_cours", "restituee", "cloturee"];

/**
 * Calendrier du loueur.
 *
 * La navigation entre les mois passe par un paramètre d'adresse et non par un
 * état client : le mois consulté devient partageable, ouvrable dans un nouvel
 * onglet, et l'écran fonctionne sans JavaScript.
 *
 * La semaine commence le lundi, comme partout en Europe continentale — c'est
 * la norme ISO 8601, et un calendrier qui commence le dimanche se lit de
 * travers ici.
 */
export default async function PageCalendrier({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { mois: moisDemande } = await searchParams;
  const t = await getTranslations("espaces.loueur.calendrier");
  const format = await getFormatter();

  // Format attendu : « 2026-07 ». Toute autre valeur retombe sur le mois courant
  // plutôt que de produire une date invalide.
  const aujourdhui = new Date();
  const correspondance = /^(\d{4})-(\d{2})$/.exec(moisDemande ?? "");
  const annee = correspondance ? Number(correspondance[1]) : aujourdhui.getFullYear();
  const numeroMois = correspondance
    ? Number(correspondance[2]) - 1
    : aujourdhui.getMonth();

  const premier = new Date(annee, numeroMois, 1);
  const dernier = new Date(annee, numeroMois + 1, 0);

  const clefMois = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

  const precedent = new Date(annee, numeroMois - 1, 1);
  const suivant = new Date(annee, numeroMois + 1, 1);

  const reservations = listerReservations().filter(
    (reservation) =>
      reservation.debut <= dernier &&
      reservation.fin >= premier &&
      OCCUPANTS.concat("demandee").includes(reservation.statut),
  );

  // Décalage du premier jour : `getDay()` rend 0 pour dimanche, on ramène à
  // une semaine commençant le lundi.
  const decalage = (premier.getDay() + 6) % 7;

  const cases: (number | null)[] = [
    ...Array.from({ length: decalage }, () => null),
    ...Array.from({ length: dernier.getDate() }, (_, index) => index + 1),
  ];

  function etatDuJour(numero: number) {
    const jour = new Date(annee, numeroMois, numero);
    const concernees = reservations.filter(
      (reservation) =>
        jour >= new Date(reservation.debut.getFullYear(), reservation.debut.getMonth(), reservation.debut.getDate()) &&
        jour <= new Date(reservation.fin.getFullYear(), reservation.fin.getMonth(), reservation.fin.getDate()),
    );

    if (concernees.some((reservation) => OCCUPANTS.includes(reservation.statut))) {
      return "louee" as const;
    }
    if (concernees.length > 0) return "demande" as const;
    return "libre" as const;
  }

  const estAujourdhui = (numero: number) =>
    aujourdhui.getFullYear() === annee &&
    aujourdhui.getMonth() === numeroMois &&
    aujourdhui.getDate() === numero;

  const JOURS = ["L", "M", "M", "J", "V", "S", "D"];

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-8 sm:py-10">
      <EnTeteEspace titre={t("titre")} sousTitre={t("chapo")} />

      <div className="mt-8 rounded-carte border border-bordure bg-fond-eleve p-4 shadow-(--ombre-carte) sm:p-6">
        <div className="flex items-center justify-between gap-4">
          <Link
            href={{
              pathname: "/proprietaire/calendrier",
              query: { mois: clefMois(precedent) },
            }}
            aria-label={t("moisPrecedent")}
            className="grid size-10 place-items-center rounded-champ border border-bordure transition-colors hover:border-accent hover:text-accent"
          >
            <svg viewBox="0 0 24 24" aria-hidden className="size-5" fill="none">
              <path
                d="M15 6l-6 6 6 6"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>

          <p className="text-[1.0625rem] font-semibold capitalize">
            {format.dateTime(premier, { month: "long", year: "numeric" })}
          </p>

          <Link
            href={{
              pathname: "/proprietaire/calendrier",
              query: { mois: clefMois(suivant) },
            }}
            aria-label={t("moisSuivant")}
            className="grid size-10 place-items-center rounded-champ border border-bordure transition-colors hover:border-accent hover:text-accent"
          >
            <svg viewBox="0 0 24 24" aria-hidden className="size-5" fill="none">
              <path
                d="M9 6l6 6-6 6"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
        </div>

        <div className="mt-6 grid grid-cols-7 gap-1 text-center text-xs text-texte-attenue">
          {JOURS.map((initiale, index) => (
            <span key={index}>{initiale}</span>
          ))}
        </div>

        <div className="mt-2 grid grid-cols-7 gap-1">
          {cases.map((numero, index) => {
            if (numero === null) return <div key={`vide-${index}`} />;

            const etat = etatDuJour(numero);

            return (
              <div
                key={numero}
                className={cn(
                  "aspect-square rounded-[0.5rem] border p-1.5 text-sm tabular-nums sm:p-2",
                  etat === "louee" && "border-accent/30 bg-accent/10 font-medium text-accent",
                  etat === "demande" &&
                    "border-attention/30 bg-attention/10 font-medium text-attention",
                  etat === "libre" && "border-bordure text-texte-attenue",
                  estAujourdhui(numero) && "ring-2 ring-texte ring-offset-1",
                )}
              >
                {numero}
              </div>
            );
          })}
        </div>

        <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 border-t border-bordure pt-4 text-sm text-texte-attenue">
          <li className="flex items-center gap-2">
            <span aria-hidden className="size-3 rounded-[3px] border border-accent/30 bg-accent/10" />
            {t("legendeLouee")}
          </li>
          <li className="flex items-center gap-2">
            <span
              aria-hidden
              className="size-3 rounded-[3px] border border-attention/30 bg-attention/10"
            />
            {t("legendeDemande")}
          </li>
          <li className="flex items-center gap-2">
            <span aria-hidden className="size-3 rounded-[3px] border border-bordure" />
            {t("legendeLibre")}
          </li>
        </ul>
      </div>

      {/* Le calendrier montre l'occupation ; la liste dit de quoi il s'agit.
          L'un ne remplace pas l'autre, et un lecteur d'écran n'a que la liste. */}
      <section className="mt-8">
        <h2 className="text-[1.0625rem] font-semibold">{t("detailMois")}</h2>

        {reservations.length === 0 ? (
          <p className="mt-4 rounded-carte border border-bordure bg-fond-eleve px-5 py-8 text-center text-[0.9375rem] text-texte-attenue">
            {t("aucuneCeMois")}
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {reservations
              .slice()
              .sort((a, b) => a.debut.getTime() - b.debut.getTime())
              .map((reservation) => (
                <li
                  key={reservation.id}
                  className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-carte border border-bordure bg-fond-eleve px-5 py-4"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {reservation.annonceTitre}
                    </p>
                    <p className="mt-0.5 text-sm text-texte-attenue">
                      {reservation.locataire} ·{" "}
                      {format.dateTime(reservation.debut, {
                        day: "numeric",
                        month: "short",
                      })}{" "}
                      →{" "}
                      {format.dateTime(reservation.fin, {
                        day: "numeric",
                        month: "short",
                      })}
                    </p>
                  </div>
                  <PastilleStatut statut={reservation.statut} />
                </li>
              ))}
          </ul>
        )}
      </section>
    </div>
  );
}
