"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { POINTS_CONTROLE } from "@/domain/location/constat";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { enregistrerConstat } from "@/server/locations/actions";

/**
 * Saisie d'un état des lieux, sur le terrain.
 *
 * L'écran est fait pour un téléphone tenu d'une main à côté du matériel :
 * chaque point de contrôle est une paire de boutons larges, pas une liste de
 * cases à cocher. Aucun point n'a de valeur par défaut — un « conforme »
 * prérempli serait un point qu'on n'a pas regardé, et le formulaire refuse
 * d'être soumis tant que tout n'a pas été examiné.
 *
 * Les deux signatures se font sur le même appareil, comme sur le terrain :
 * le constat est contradictoire ou n'est pas.
 */
export function FormulaireConstat({
  reservationId,
  type,
}: {
  reservationId: string;
  type: "depart" | "retour";
}) {
  const t = useTranslations("espaces.loueur.etatsDesLieux.formulaire");
  const router = useRouter();
  const [reponses, setReponses] = useState<Record<string, "conforme" | "defaut">>({});
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();

  const complet = POINTS_CONTROLE.every((point) => reponses[point]);

  function soumettre(evenement: React.FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    setErreur(null);

    const donnees = new FormData(evenement.currentTarget);

    demarrer(async () => {
      const resultat = await enregistrerConstat(donnees);

      if (resultat.ok) {
        router.push("/proprietaire/etats-des-lieux");
        router.refresh();
        return;
      }

      const connues = [
        "invalide",
        "interdit",
        "statutIncompatible",
        "dejaRealise",
        "departManquant",
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
    <form onSubmit={soumettre} className="mt-8 space-y-8">
      <input type="hidden" name="reservationId" value={reservationId} />
      <input type="hidden" name="type" value={type} />

      <fieldset className="rounded-carte border border-bordure bg-fond-eleve p-5 shadow-(--ombre-carte)">
        <legend className="px-2 text-[0.9375rem] font-semibold">
          {t("controles")}
        </legend>

        <ul className="mt-2 divide-y divide-bordure">
          {POINTS_CONTROLE.map((point) => (
            <li
              key={point}
              className="flex flex-wrap items-center justify-between gap-3 py-3.5"
            >
              <span className="text-[0.9375rem] font-medium">
                {t(`points.${point}` as never)}
              </span>

              <div
                role="radiogroup"
                aria-label={t(`points.${point}` as never)}
                className="flex gap-2"
              >
                {(["conforme", "defaut"] as const).map((valeur) => (
                  <label
                    key={valeur}
                    className={cn(
                      "cursor-pointer rounded-champ border px-4 py-2.5 text-sm font-medium transition-colors",
                      reponses[point] === valeur
                        ? valeur === "conforme"
                          ? "border-succes bg-succes text-white"
                          : "border-danger bg-danger text-white"
                        : "border-bordure hover:border-accent",
                    )}
                  >
                    <input
                      type="radio"
                      name={`controle_${point}`}
                      value={valeur}
                      checked={reponses[point] === valeur}
                      onChange={() =>
                        setReponses((etat) => ({ ...etat, [point]: valeur }))
                      }
                      className="sr-only"
                    />
                    {t(valeur)}
                  </label>
                ))}
              </div>
            </li>
          ))}
        </ul>
      </fieldset>

      <fieldset className="rounded-carte border border-bordure bg-fond-eleve p-5 shadow-(--ombre-carte)">
        <legend className="px-2 text-[0.9375rem] font-semibold">
          {t("observations")}
        </legend>

        <div className="mt-2 grid gap-5">
          <div>
            <label htmlFor="kilometrage" className="text-sm font-medium">
              {t("kilometrage")}
            </label>
            <input
              id="kilometrage"
              name="kilometrage"
              type="number"
              inputMode="numeric"
              min={0}
              className="mt-2 h-12 w-full rounded-champ border border-bordure bg-fond-eleve px-4 text-base focus:border-accent"
            />
          </div>

          <div>
            <label htmlFor="commentaire" className="text-sm font-medium">
              {t("commentaire")}
            </label>
            <textarea
              id="commentaire"
              name="commentaire"
              rows={3}
              maxLength={2000}
              placeholder={t("commentaireAide")}
              className="mt-2 w-full resize-y rounded-champ border border-bordure bg-fond-eleve px-4 py-3 text-base placeholder:text-texte-attenue/70 focus:border-accent"
            />
          </div>
        </div>
      </fieldset>

      <fieldset className="rounded-carte border border-bordure bg-fond-eleve p-5 shadow-(--ombre-carte)">
        <legend className="px-2 text-[0.9375rem] font-semibold">
          {t("signatures")}
        </legend>

        <p className="mt-2 text-sm text-texte-attenue">{t("signaturesAide")}</p>

        <label className="mt-4 flex items-start gap-3 text-[0.9375rem]">
          <input
            type="checkbox"
            name="signatureLocataire"
            required
            className="mt-1 size-5 accent-[var(--accent)]"
          />
          <span>{t("signatureLocataire")}</span>
        </label>

        <label className="mt-4 flex items-start gap-3 text-[0.9375rem]">
          <input
            type="checkbox"
            name="signatureProprietaire"
            required
            className="mt-1 size-5 accent-[var(--accent)]"
          />
          <span>{t("signatureProprietaire")}</span>
        </label>
      </fieldset>

      <div>
        <button
          type="submit"
          disabled={!complet || enCours}
          className="w-full rounded-champ bg-accent px-6 py-3.5 text-base font-medium text-accent-contraste transition-opacity hover:opacity-90 disabled:opacity-50 sm:w-auto"
        >
          {enCours ? t("enregistrement") : t("enregistrer")}
        </button>

        {!complet ? (
          <p className="mt-2 text-sm text-texte-attenue">{t("incomplet")}</p>
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
