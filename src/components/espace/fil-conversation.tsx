import { getFormatter, getTranslations } from "next-intl/server";

import { FormulaireMessage } from "@/components/espace/formulaire-message";
import type { Fil, MessageFil } from "@/server/messagerie/depot";

/**
 * Corps d'un fil de discussion, commun aux deux espaces.
 *
 * Le locataire et le loueur voient exactement la même conversation — seuls
 * l'habillage de l'espace et le chemin de retour diffèrent, et ils restent
 * dans les pages. Deux rendus séparés finiraient par diverger sur un détail
 * (l'ordre, les dates, la mention de masquage) et ce genre d'écart se découvre
 * en général au beau milieu d'un litige.
 */
export async function FilConversation({
  fil,
  messages,
}: {
  fil: Fil;
  messages: MessageFil[];
}) {
  const t = await getTranslations("espaces.fil");
  const format = await getFormatter();

  return (
    <div className="mt-8">
      <ol className="space-y-4">
        {messages.map((message) => (
          <li
            key={message.id}
            className={message.deMoi ? "flex justify-end" : "flex justify-start"}
          >
            <div
              className={
                message.deMoi
                  ? "max-w-[85%] rounded-carte rounded-br-sm bg-accent px-4 py-3 text-accent-contraste sm:max-w-[70%]"
                  : "max-w-[85%] rounded-carte rounded-bl-sm border border-bordure bg-fond-eleve px-4 py-3 sm:max-w-[70%]"
              }
            >
              <p className="whitespace-pre-wrap text-[0.9375rem]">
                {message.contenu}
              </p>

              {message.coordonneesMasquees ? (
                <p
                  className={
                    message.deMoi
                      ? "mt-1.5 text-xs text-accent-contraste/80"
                      : "mt-1.5 text-xs text-texte-attenue"
                  }
                >
                  {t("coordonneesMasquees")}
                </p>
              ) : null}

              <p
                className={
                  message.deMoi
                    ? "mt-1.5 text-right text-xs text-accent-contraste/80"
                    : "mt-1.5 text-right text-xs text-texte-attenue"
                }
              >
                {format.dateTime(message.date, {
                  day: "numeric",
                  month: "short",
                  hour: "numeric",
                  minute: "numeric",
                })}
              </p>
            </div>
          </li>
        ))}
      </ol>

      {/* Sans réservation rattachée, on ne sait pas vers quel dossier écrire :
          le fil reste lisible, la saisie disparaît. */}
      {fil.reservationId ? (
        <FormulaireMessage reservationId={fil.reservationId} />
      ) : null}
    </div>
  );
}
