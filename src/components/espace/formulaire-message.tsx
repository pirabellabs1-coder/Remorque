"use client";

import { useTranslations } from "next-intl";
import { useRef, useState, useTransition } from "react";

import { useRouter } from "@/i18n/navigation";
import { envoyerMessage } from "@/server/messagerie/actions";

/**
 * Zone de saisie d'un fil de discussion.
 *
 * Le champ se vide à l'envoi réussi et seulement à ce moment-là : vider avant
 * la réponse du serveur ferait perdre le texte au premier incident réseau —
 * et un message perdu dans une conversation de litige ne se retape pas de
 * mémoire.
 */
export function FormulaireMessage({ reservationId }: { reservationId: string }) {
  const t = useTranslations("espaces.fil");
  const router = useRouter();
  const zone = useRef<HTMLTextAreaElement>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();

  function soumettre(evenement: React.FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    setErreur(null);

    const donnees = new FormData(evenement.currentTarget);

    demarrer(async () => {
      const resultat = await envoyerMessage(donnees);

      if (resultat.ok) {
        if (zone.current) zone.current.value = "";
        router.refresh();
        return;
      }

      const connues = ["invalide", "interdit", "connexionRequise"];
      setErreur(
        connues.includes(resultat.cle)
          ? t(`erreurs.${resultat.cle}` as never)
          : t("erreurs.echec"),
      );
    });
  }

  return (
    <form onSubmit={soumettre} className="mt-6">
      <input type="hidden" name="reservationId" value={reservationId} />

      <div className="rounded-carte border border-bordure bg-fond-eleve p-3 shadow-(--ombre-carte)">
        <textarea
          ref={zone}
          name="contenu"
          required
          maxLength={4000}
          rows={3}
          placeholder={t("placeholder")}
          className="w-full resize-y rounded-champ bg-transparent px-2 py-1.5 text-[0.9375rem] outline-none placeholder:text-texte-attenue"
        />

        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-md text-xs text-texte-attenue">
            {t("confidentialite")}
          </p>
          <button
            type="submit"
            disabled={enCours}
            className="rounded-champ bg-accent px-5 py-2.5 text-sm font-medium text-accent-contraste transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {enCours ? t("envoi") : t("envoyer")}
          </button>
        </div>
      </div>

      {erreur ? (
        <p role="alert" className="mt-2 text-sm text-danger">
          {erreur}
        </p>
      ) : null}
    </form>
  );
}
