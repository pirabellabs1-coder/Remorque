"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { useRouter } from "@/i18n/navigation";
import { repondreAvis } from "@/server/annonces/reponse-avis";

/**
 * Réponse à un avis reçu.
 *
 * Repliée par défaut : la page des avis se parcourt d'abord pour lire, et une
 * dizaine de zones de saisie ouvertes en même temps transformeraient la lecture
 * en formulaire. L'avertissement sur le caractère définitif est donné avant la
 * saisie, non après — le dire au moment d'envoyer serait un piège.
 */
export function FormulaireReponseAvis({ avisId }: { avisId: string }) {
  const t = useTranslations("espaces.loueur.avis.reponse");
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();

  function soumettre(evenement: React.FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    setErreur(null);

    const donnees = new FormData(evenement.currentTarget);

    demarrer(async () => {
      const resultat = await repondreAvis(donnees);

      if (resultat.ok) {
        setOuvert(false);
        router.refresh();
        return;
      }

      const connues = ["invalide", "impossible", "connexionRequise"];
      setErreur(
        connues.includes(resultat.cle)
          ? t(`erreurs.${resultat.cle}` as never)
          : t("erreurs.echec"),
      );
    });
  }

  if (!ouvert) {
    return (
      <button
        type="button"
        onClick={() => setOuvert(true)}
        className="mt-3 rounded-champ border border-bordure px-3.5 py-2 text-sm font-medium transition-colors hover:border-accent hover:text-accent"
      >
        {t("repondre")}
      </button>
    );
  }

  return (
    <form onSubmit={soumettre} className="mt-4">
      <input type="hidden" name="avisId" value={avisId} />

      <label htmlFor={`reponse-${avisId}`} className="text-sm font-medium">
        {t("titre")}
      </label>
      <p className="mt-1 text-sm text-texte-attenue">{t("definitive")}</p>

      <textarea
        id={`reponse-${avisId}`}
        name="reponse"
        required
        minLength={10}
        maxLength={1000}
        rows={3}
        placeholder={t("exemple")}
        className="mt-2 w-full resize-y rounded-champ border border-bordure bg-fond px-4 py-3 text-[0.9375rem] placeholder:text-texte-attenue/70 focus:border-accent"
      />

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={enCours}
          className="rounded-champ bg-accent px-4 py-2 text-sm font-medium text-accent-contraste transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {enCours ? t("envoi") : t("publier")}
        </button>
        <button
          type="button"
          onClick={() => setOuvert(false)}
          className="rounded-champ border border-bordure px-4 py-2 text-sm font-medium transition-colors hover:border-accent"
        >
          {t("annuler")}
        </button>
      </div>

      {erreur ? (
        <p role="alert" className="mt-2 text-sm text-danger">
          {erreur}
        </p>
      ) : null}
    </form>
  );
}
