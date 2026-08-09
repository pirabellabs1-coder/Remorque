"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { useRouter } from "@/i18n/navigation";
import { declarerSinistre } from "@/server/sinistres/actions";

/**
 * Déclaration d'un sinistre.
 *
 * Le formulaire dit d'emblée ce que la déclaration déclenche : les fonds sont
 * immobilisés et le dossier partira chez l'assureur. C'est une information que
 * l'on n'a pas le droit de garder pour la page suivante — déclarer engage
 * l'argent de l'autre partie autant que le sien.
 *
 * L'estimation est demandée en euros et convertie au départ — règle 1 : elle
 * chiffre ce que le gel immobilise, et l'assureur ne reçoit pas de dossier
 * sans ordre de grandeur.
 */
export function FormulaireSinistre({
  reservationId,
}: {
  reservationId: string;
}) {
  const t = useTranslations("espaces.sinistre.formulaire");
  const router = useRouter();
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();

  function soumettre(evenement: React.FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    setErreur(null);

    const donnees = new FormData(evenement.currentTarget);

    const euros = Number(donnees.get("montantEuros"));
    if (!Number.isFinite(euros) || euros <= 0) {
      setErreur(t("erreurs.invalide"));
      return;
    }
    donnees.delete("montantEuros");
    donnees.set("montantEstime", String(Math.round(euros * 100)));

    demarrer(async () => {
      const resultat = await declarerSinistre(donnees);

      if (resultat.ok) {
        router.refresh();
        return;
      }

      const connues = [
        "invalide",
        "interdit",
        "dejaDeclare",
        "statutInadapte",
        "connexionRequise",
      ];
      setErreur(
        connues.includes(resultat.cle)
          ? t(`erreurs.${resultat.cle}` as never)
          : t("erreurs.echec"),
      );
    });
  }

  return (
    <form onSubmit={soumettre} className="mt-8 space-y-6">
      <input type="hidden" name="reservationId" value={reservationId} />

      <p className="rounded-carte border border-attention/40 bg-attention/10 p-4 text-[0.9375rem]">
        {t("avertissement")}
      </p>

      <div className="rounded-carte border border-bordure bg-fond-eleve p-5 shadow-(--ombre-carte)">
        <label
          htmlFor="montantEuros"
          className="block text-[0.9375rem] font-semibold"
        >
          {t("montant")}
        </label>
        <p className="mt-1 text-sm text-texte-attenue">{t("montantAide")}</p>
        <input
          id="montantEuros"
          name="montantEuros"
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0.01"
          required
          className="mt-2 h-12 w-full rounded-champ border border-bordure bg-fond-eleve px-4 text-base focus:border-accent"
        />

        <label
          htmlFor="description"
          className="mt-5 block text-[0.9375rem] font-semibold"
        >
          {t("description")}
        </label>
        <p className="mt-1 text-sm text-texte-attenue">{t("descriptionAide")}</p>
        <textarea
          id="description"
          name="description"
          required
          minLength={20}
          maxLength={4000}
          rows={5}
          className="mt-2 w-full resize-y rounded-champ border border-bordure bg-fond-eleve px-4 py-3 text-base focus:border-accent"
        />
      </div>

      <div>
        <button
          type="submit"
          disabled={enCours}
          className="w-full rounded-champ bg-danger px-6 py-3.5 text-base font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60 sm:w-auto"
        >
          {enCours ? t("declarationEnCours") : t("declarer")}
        </button>

        {erreur ? (
          <p role="alert" className="mt-2 text-sm text-danger">
            {erreur}
          </p>
        ) : null}
      </div>
    </form>
  );
}
