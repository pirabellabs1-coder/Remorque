import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";

import { EnTeteEspace } from "@/components/espace/coquille-espace";
import { CarteIndicateur, ListeVide } from "@/components/espace/indicateurs";
import { Cellule, Pastille, Tableau } from "@/components/espace/tableau";
import { Link } from "@/i18n/navigation";
import { listerTickets, type TicketSupport } from "@/server/espaces/administration";

type Props = { params: Promise<{ locale: string }> };

export const metadata = { robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const TONS_STATUT: Record<TicketSupport["statut"], "attente" | "actif" | "succes"> = {
  ouvert: "attente",
  en_cours: "actif",
  resolu: "succes",
};

const TONS_PRIORITE: Record<TicketSupport["priorite"], "neutre" | "attente" | "danger"> = {
  basse: "neutre",
  normale: "attente",
  haute: "danger",
};

export default async function PageSupport({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("espaces.admin.support");
  const format = await getFormatter();

  const tickets = (await listerTickets());
  const ouverts = tickets.filter((ticket) => ticket.statut !== "resolu");

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-8 sm:py-10">
      <EnTeteEspace titre={t("titre")} sousTitre={t("chapo")} />

      {tickets.length === 0 ? (
        <div className="mt-8">
          <ListeVide titre={t("vide.titre")} texte={t("vide.texte")} />
        </div>
      ) : (
        <>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <CarteIndicateur libelle={t("statuts.ouvert")} valeur={ouverts.length} />
            <CarteIndicateur
              libelle={t("priorites.haute")}
              valeur={ouverts.filter((ticket) => ticket.priorite === "haute").length}
            />
            <CarteIndicateur
              libelle={t("statuts.resolu")}
              valeur={tickets.filter((ticket) => ticket.statut === "resolu").length}
            />
          </div>

          <Tableau
            className="mt-8"
            colonnes={[
              { cle: "reference", entete: t("reference") },
              { cle: "sujet", entete: t("sujet") },
              { cle: "demandeur", entete: t("demandeur"), secondaire: true },
              { cle: "canal", entete: t("canal"), secondaire: true },
              { cle: "ouvert", entete: t("ouvertLe"), secondaire: true },
              { cle: "priorite", entete: t("priorite") },
              { cle: "statut", entete: t("statut") },
            ]}
          >
            {tickets.map((ticket) => (
              <tr key={ticket.id}>
                <th
                  scope="row"
                  className="px-5 py-3.5 text-left font-mono text-sm font-normal whitespace-nowrap"
                >
                  {/* La référence mène au dossier : c'est là qu'on prend,
                      qu'on répond et qu'on clôt. */}
                  <Link
                    href={{
                      pathname: "/admin/support/[demande]",
                      params: { demande: ticket.id },
                    }}
                    className="underline-offset-4 transition-colors hover:text-accent hover:underline"
                  >
                    {ticket.reference}
                  </Link>
                </th>
                <Cellule className="max-w-80">{ticket.sujet}</Cellule>
                <Cellule secondaire attenue>
                  {ticket.demandeur}
                </Cellule>
                <Cellule secondaire attenue>
                  {t(`canaux.${ticket.canal}` as never)}
                </Cellule>
                <Cellule secondaire attenue className="whitespace-nowrap">
                  {format.dateTime(ticket.ouvertLe, {
                    day: "2-digit",
                    month: "2-digit",
                    year: "2-digit",
                  })}
                </Cellule>
                <Cellule>
                  <Pastille ton={TONS_PRIORITE[ticket.priorite]}>
                    {t(`priorites.${ticket.priorite}` as never)}
                  </Pastille>
                </Cellule>
                <Cellule>
                  <Pastille ton={TONS_STATUT[ticket.statut]}>
                    {t(`statuts.${ticket.statut}` as never)}
                  </Pastille>
                </Cellule>
              </tr>
            ))}
          </Tableau>
        </>
      )}
    </div>
  );
}
