import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";

import { EnTeteEspace } from "@/components/espace/coquille-espace";
import { Icone } from "@/components/espace/icone";
import { ListeVide } from "@/components/espace/indicateurs";
import { Bouton } from "@/components/ui/bouton";
import { Link } from "@/i18n/navigation";
import {
  constatsAfaire,
  mesConstats,
} from "@/server/locations/etats-des-lieux";

type Props = { params: Promise<{ locale: string }> };

export const metadata = { robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * États des lieux.
 *
 * Deux listes et non une seule : ce qui reste à faire est une file de travail,
 * ce qui est fait est une archive. Les mélanger obligerait à chercher dans
 * l'historique la seule ligne qui demande une action.
 */
export default async function PageEtatsDesLieux({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("espaces.loueur.etatsDesLieux");
  const format = await getFormatter();

  // Les constats réellement enregistrés, et ceux qui manquent encore. La
  // version précédente déduisait tout du statut : un constat déjà signé
  // continuait d'apparaître comme à faire.
  const [aFaire, realises] = await Promise.all([constatsAfaire(), mesConstats()]);

  const moment = (type: "depart" | "retour") =>
    type === "depart" ? t("depart") : t("retour");

  const dateConcernee = (entree: { type: string; debut: Date; fin: Date }) =>
    entree.type === "depart" ? entree.debut : entree.fin;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-8 sm:py-10">
      <EnTeteEspace titre={t("titre")} sousTitre={t("chapo")} />

      <section className="mt-8">
        <h2 className="text-[1.0625rem] font-semibold">{t("aFaire")}</h2>

        {aFaire.length === 0 ? (
          <div className="mt-4">
            <ListeVide titre={t("vide.titre")} texte={t("vide.texte")} />
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
            {aFaire.map((entree) => (
              <li
                key={`${entree.reservationId}-${entree.type}`}
                className="flex flex-wrap items-center gap-4 rounded-carte border border-bordure bg-fond-eleve p-5 shadow-(--ombre-carte)"
              >
                <span
                  aria-hidden
                  className="grid size-11 shrink-0 place-items-center rounded-champ bg-accent/10 text-accent"
                >
                  <Icone nom="photo" />
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {entree.annonceTitre}
                  </p>
                  <p className="mt-0.5 text-sm text-texte-attenue">
                    {moment(entree.type)} ·{" "}
                    {format.dateTime(dateConcernee(entree), {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                    })}{" "}
                    · {entree.interlocuteur}
                  </p>
                </div>

                <Bouton
                  as={Link}
                  href={{
                    pathname: "/proprietaire/etats-des-lieux/[reservation]/[type]",
                    params: { reservation: entree.reservationId, type: entree.type },
                  }}
                  taille="petit"
                  variante="secondaire"
                >
                  {t("faire")}
                </Bouton>
              </li>
            ))}
          </ul>
        )}
      </section>

      {realises.length > 0 ? (
        <section className="mt-10">
          <h2 className="text-[1.0625rem] font-semibold">{t("realises")}</h2>
          <ul className="mt-4 divide-y divide-bordure overflow-hidden rounded-carte border border-bordure bg-fond-eleve">
            {realises.map((constat) => (
              <li key={constat.id}>
                <Link
                  href={{
                    pathname: "/proprietaire/etats-des-lieux/[reservation]/[type]",
                    params: { reservation: constat.reservationId, type: constat.type },
                  }}
                  className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-fond-doux"
                >
                  {/* Une réserve au constat distingue une restitution sans
                      histoire d'un dossier qui peut devenir un litige. */}
                  <span
                    aria-hidden
                    className={
                      constat.reserve ? "shrink-0 text-attention" : "shrink-0 text-succes"
                    }
                  >
                    <svg viewBox="0 0 24 24" className="size-5" fill="none">
                      <path
                        d="m5 13 4 4L19 7"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                  <p className="min-w-0 flex-1 truncate text-[0.9375rem]">
                    {constat.annonceTitre}
                    <span className="ml-2 text-sm text-texte-attenue">
                      {moment(constat.type)}
                    </span>
                  </p>
                  <p className="shrink-0 text-sm text-texte-attenue">
                    {format.dateTime(constat.date, {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
