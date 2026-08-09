"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { MOTIFS_LITIGE } from "@/domain/litige/machine";
import { useRouter } from "@/i18n/navigation";
import { ouvrirLitige } from "@/server/litiges/actions";

/**
 * Ouverture d'un litige.
 *
 * Le formulaire dit d'emblée ce que l'ouverture déclenche : les fonds sont
 * immobilisés des deux côtés. C'est une information que l'on n'a pas le droit
 * de garder pour la page suivante — celui qui ouvre engage l'argent de
 * quelqu'un d'autre autant que le sien.
 *
 * Le montant est plafonné à la caution : c'est tout ce que la plateforme peut
 * retenir. Le champ le dit plutôt que de laisser l'action refuser après coup.
 */
export function FormulaireLitige({
  reservationId,
  caution,
  cautionAffichee,
  espace,
}: {
  reservationId: string;
  caution: number;
  cautionAffichee: string;
  espace: "compte" | "proprietaire";
}) {
  const t = useTranslations("espaces.litige.formulaire");
  const router = useRouter();
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();

  function soumettre(evenement: React.FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    setErreur(null);

    const formulaire = evenement.currentTarget;
    const donnees = new FormData(formulaire);

    // Le champ est saisi en euros, la base travaille en centimes — règle 1.
    const euros = Number(donnees.get("montantEuros"));
    if (!Number.isFinite(euros) || euros <= 0) {
      setErreur(t("erreurs.invalide"));
      return;
    }
    donnees.set("montantReclame", String(Math.round(euros * 100)));

    demarrer(async () => {
      const resultat = await ouvrirLitige(donnees);

      if (resultat.ok) {
        router.refresh();
        return;
      }

      const connues = [
        "invalide",
        "interdit",
        "dejaOuvert",
        "montantExcessif",
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
      <input type="hidden" name="espace" value={espace} />

      <p className="rounded-carte border border-attention/40 bg-attention/10 p-4 text-[0.9375rem]">
        {t("avertissement")}
      </p>

      <div className="rounded-carte border border-bordure bg-fond-eleve p-5 shadow-(--ombre-carte)">
        <label htmlFor="motif" className="text-[0.9375rem] font-semibold">
          {t("motif")}
        </label>
        <select
          id="motif"
          name="motif"
          required
          defaultValue=""
          className="mt-2 h-12 w-full rounded-champ border border-bordure bg-fond-eleve px-4 text-base focus:border-accent"
        >
          <option value="" disabled>
            {t("choisir")}
          </option>
          {MOTIFS_LITIGE.map((motif) => (
            <option key={motif} value={motif}>
              {t(`motifs.${motif}` as never)}
            </option>
          ))}
        </select>

        <label
          htmlFor="montantEuros"
          className="mt-5 block text-[0.9375rem] font-semibold"
        >
          {t("montant")}
        </label>
        <p className="mt-1 text-sm text-texte-attenue">
          {t("montantAide", { plafond: cautionAffichee })}
        </p>
        <input
          id="montantEuros"
          name="montantEuros"
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0.01"
          max={caution / 100}
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
          {enCours ? t("ouverture") : t("ouvrir")}
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
