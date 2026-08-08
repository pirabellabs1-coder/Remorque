"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { deposerAvis } from "@/server/annonces/avis-actions";

/**
 * Formulaire de dépôt d'avis.
 *
 * La note n'a pas de valeur par défaut : cinq étoiles préremplies seraient
 * une note qu'on n'a pas donnée, et c'est la moyenne publique de l'annonce
 * qui en hériterait. Le bouton reste inerte tant que la note manque.
 */
export function FormulaireAvis({ reservationId }: { reservationId: string }) {
  const t = useTranslations("espaces.locataire.avis.formulaire");
  const router = useRouter();
  const [note, setNote] = useState<number | null>(null);
  const [survol, setSurvol] = useState<number | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();

  function soumettre(evenement: React.FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    setErreur(null);

    const donnees = new FormData(evenement.currentTarget);

    demarrer(async () => {
      const resultat = await deposerAvis(donnees);

      if (resultat.ok) {
        router.push("/compte/avis");
        router.refresh();
        return;
      }

      const connues = [
        "invalide",
        "interdit",
        "nonCloturee",
        "fenetreFermee",
        "dejaDepose",
        "connexionRequise",
      ];
      setErreur(
        connues.includes(resultat.cle)
          ? t(`erreurs.${resultat.cle}` as never)
          : t("erreurs.echec"),
      );
    });
  }

  const affichee = survol ?? note ?? 0;

  return (
    <form onSubmit={soumettre} className="mt-8 space-y-6">
      <input type="hidden" name="reservationId" value={reservationId} />

      <fieldset className="rounded-carte border border-bordure bg-fond-eleve p-5 shadow-(--ombre-carte)">
        <legend className="px-2 text-[0.9375rem] font-semibold">{t("note")}</legend>

        <div
          className="mt-2 flex gap-1"
          role="radiogroup"
          aria-label={t("note")}
          onMouseLeave={() => setSurvol(null)}
        >
          {[1, 2, 3, 4, 5].map((valeur) => (
            <label
              key={valeur}
              className="cursor-pointer p-1"
              onMouseEnter={() => setSurvol(valeur)}
            >
              <input
                type="radio"
                name="note"
                value={valeur}
                checked={note === valeur}
                onChange={() => setNote(valeur)}
                className="sr-only"
                aria-label={t("etoiles", { nombre: valeur })}
              />
              <svg
                viewBox="0 0 24 24"
                className={cn(
                  "size-9 transition-colors",
                  valeur <= affichee ? "text-accent" : "text-bordure",
                )}
                fill="currentColor"
                aria-hidden
              >
                <path d="M12 2.6 14.9 8.7l6.4.8-4.7 4.4 1.2 6.3-5.8-3.1-5.8 3.1 1.2-6.3L2.7 9.5l6.4-.8Z" />
              </svg>
            </label>
          ))}
        </div>

        {note !== null ? (
          <p className="mt-1 text-sm text-texte-attenue">
            {t(`niveaux.${note}` as never)}
          </p>
        ) : null}
      </fieldset>

      <div className="rounded-carte border border-bordure bg-fond-eleve p-5 shadow-(--ombre-carte)">
        <label htmlFor="commentaire" className="text-[0.9375rem] font-semibold">
          {t("commentaire")}
        </label>
        <p className="mt-1 text-sm text-texte-attenue">{t("commentaireAide")}</p>
        <textarea
          id="commentaire"
          name="commentaire"
          required
          minLength={20}
          maxLength={2000}
          rows={5}
          className="mt-3 w-full resize-y rounded-champ border border-bordure bg-fond-eleve px-4 py-3 text-base focus:border-accent"
        />
      </div>

      <div>
        <button
          type="submit"
          disabled={note === null || enCours}
          className="w-full rounded-champ bg-accent px-6 py-3.5 text-base font-medium text-accent-contraste transition-opacity hover:opacity-90 disabled:opacity-50 sm:w-auto"
        >
          {enCours ? t("envoi") : t("publier")}
        </button>

        {note === null ? (
          <p className="mt-2 text-sm text-texte-attenue">{t("noteManquante")}</p>
        ) : null}

        {erreur ? (
          <p role="alert" className="mt-2 text-sm text-danger">
            {erreur}
          </p>
        ) : null}
      </div>
    </form>
  );
}
