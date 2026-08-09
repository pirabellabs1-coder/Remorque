import { getFormatter, getTranslations } from "next-intl/server";

import { ActionsDemande } from "@/components/espace/actions-demande";
import type { TicketDossier } from "@/server/support/depot";

/**
 * Corps d'une demande d'assistance, commun aux deux côtés.
 *
 * Le demandeur et l'assistance lisent le même fil — à une exception près, qui
 * est écrite dans la requête et non ici : les notes internes ne sortent pas.
 * Ce composant se contente de les signaler quand il en reçoit, ce qui n'arrive
 * qu'à l'assistance.
 */
export async function DossierDemande({ ticket }: { ticket: TicketDossier }) {
  const t = await getTranslations("espaces.support");
  const format = await getFormatter();

  const clos = ticket.statut === "resolu";

  const date = (valeur: Date) =>
    format.dateTime(valeur, {
      day: "numeric",
      month: "long",
      hour: "numeric",
      minute: "numeric",
    });

  return (
    <div className="mt-8 space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <span
          className={
            clos
              ? "inline-block rounded-full bg-succes/15 px-3 py-1 text-sm font-medium text-succes"
              : "inline-block rounded-full bg-attention/15 px-3 py-1 text-sm font-medium text-attention"
          }
        >
          {t(`statuts.${ticket.statut}` as never)}
        </span>

        <span className="text-sm text-texte-attenue">
          {t(`priorites.${ticket.priorite}` as never)}
        </span>

        {/* Le retard se dit là où il se constate, pas dans un rapport
            mensuel : c'est la seule façon qu'il serve encore à quelque chose. */}
        {ticket.enRetard ? (
          <span className="inline-block rounded-full bg-danger/15 px-3 py-1 text-sm font-medium text-danger">
            {t("enRetard", { heures: ticket.delaiHeures })}
          </span>
        ) : null}
      </div>

      <section className="rounded-carte border border-bordure bg-fond-eleve p-5 shadow-(--ombre-carte)">
        <h2 className="text-[0.9375rem] font-semibold">{ticket.sujet}</h2>
        <dl className="mt-3 space-y-2 text-[0.9375rem]">
          <div className="flex flex-wrap justify-between gap-2">
            <dt className="text-texte-attenue">{t("ouvertLe")}</dt>
            <dd>{date(ticket.ouvertLe)}</dd>
          </div>
          {ticket.reservationReference ? (
            <div className="flex flex-wrap justify-between gap-2">
              <dt className="text-texte-attenue">{t("location")}</dt>
              <dd className="font-mono text-sm">{ticket.reservationReference}</dd>
            </div>
          ) : null}
          <div className="flex flex-wrap justify-between gap-2">
            <dt className="text-texte-attenue">{t("premiereReponse")}</dt>
            <dd>
              {ticket.premiereReponseLe ? date(ticket.premiereReponseLe) : t("enAttente")}
            </dd>
          </div>
          {ticket.assigneA ? (
            <div className="flex flex-wrap justify-between gap-2">
              <dt className="text-texte-attenue">{t("assigneA")}</dt>
              <dd>{ticket.assigneA}</dd>
            </div>
          ) : null}
        </dl>
      </section>

      {/* Le fil, dans l'ordre où il s'est écrit. Le message d'ouverture y
          figure comme les autres : un échange qui commencerait par une
          réponse serait illisible. */}
      <section className="rounded-carte border border-bordure bg-fond-eleve p-5 shadow-(--ombre-carte)">
        <h2 className="text-[0.9375rem] font-semibold">{t("fil")}</h2>

        <ol className="mt-3 space-y-3">
          {ticket.messages.map((message) => (
            <li
              key={message.id}
              className={
                message.interne
                  ? "rounded-champ border border-attention/40 bg-attention/5 p-3"
                  : message.auteurRole === "assistance"
                    ? "rounded-champ bg-accent/5 p-3"
                    : "rounded-champ bg-fond-doux p-3"
              }
            >
              <p className="text-sm text-texte-attenue">
                {message.auteurRole === "assistance"
                  ? t("parAssistance")
                  : ticket.aMoi
                    ? t("parMoi")
                    : message.auteur}{" "}
                · {date(message.date)}
                {message.interne ? ` · ${t("noteInterne")}` : ""}
              </p>
              <p className="mt-1 text-[0.9375rem] whitespace-pre-wrap">
                {message.corps}
              </p>
            </li>
          ))}
        </ol>
      </section>

      {clos ? (
        <p className="rounded-carte border border-bordure bg-fond-eleve p-5 text-[0.9375rem] text-texte-attenue">
          {t("close", { date: ticket.resoluLe ? date(ticket.resoluLe) : "" })}
        </p>
      ) : null}

      <ActionsDemande
        ticketId={ticket.id}
        statut={ticket.statut}
        role={ticket.monRole}
      />
    </div>
  );
}
