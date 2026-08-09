"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import type { EvenementSupport, StatutSupport } from "@/domain/support/machine";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { instruireDemande } from "@/server/support/actions";

/**
 * Ce qu'on peut faire d'une demande d'assistance, selon l'état et la qualité.
 *
 * Le demandeur relance ou renonce ; l'assistance prend, répond, clôt. Les
 * actions sont dérivées plutôt qu'affichées puis grisées — un bouton absent ne
 * pose pas la question de savoir pourquoi il ne marche pas.
 *
 * La case « note interne » n'existe que pour l'assistance, et elle change le
 * sens du geste : une note ne part pas, ne date pas la première réponse, et ne
 * suffit donc pas à autoriser la clôture. L'écran le dit, plutôt que de le
 * laisser découvrir au refus.
 */

type Action = {
  evenement: EvenementSupport;
  ton: "principal" | "secondaire" | "danger";
  saisie: "aucune" | "message";
};

function actionsPossibles(
  statut: StatutSupport,
  role: "demandeur" | "assistance",
): Action[] {
  if (statut === "resolu") return [];

  if (role === "assistance") {
    return [
      { evenement: "repondre", ton: "principal", saisie: "message" },
      ...(statut === "ouvert"
        ? [{ evenement: "prendre" as const, ton: "secondaire" as const, saisie: "aucune" as const }]
        : []),
      ...(statut === "en_cours"
        ? [{ evenement: "resoudre" as const, ton: "secondaire" as const, saisie: "aucune" as const }]
        : []),
    ];
  }

  return [
    ...(statut === "en_cours"
      ? [{ evenement: "repondre" as const, ton: "principal" as const, saisie: "message" as const }]
      : []),
    ...(statut === "ouvert"
      ? [{ evenement: "renoncer" as const, ton: "danger" as const, saisie: "aucune" as const }]
      : []),
  ];
}

const STYLES = {
  principal: "bg-accent text-accent-contraste hover:opacity-90",
  secondaire: "border border-bordure hover:border-accent hover:text-accent",
  danger: "border border-danger text-danger hover:bg-danger hover:text-white",
} as const;

export function ActionsDemande({
  ticketId,
  statut,
  role,
}: {
  ticketId: string;
  statut: StatutSupport;
  role: "demandeur" | "assistance";
}) {
  const t = useTranslations("espaces.support");
  const router = useRouter();
  const [depliee, setDepliee] = useState<EvenementSupport | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();

  const actions = actionsPossibles(statut, role);
  if (actions.length === 0) return null;

  function envoyer(evenement: EvenementSupport, donnees: FormData) {
    setErreur(null);
    donnees.set("ticketId", ticketId);
    donnees.set("evenement", evenement);

    demarrer(async () => {
      let resultat: Awaited<ReturnType<typeof instruireDemande>>;
      try {
        resultat = await instruireDemande(donnees);
      } catch {
        setErreur(t("erreurs.echec"));
        return;
      }

      if (resultat.ok) {
        setDepliee(null);
        router.refresh();
        return;
      }

      // Deux natures de refus arrivent par le même canal. Ceux du domaine sont
      // des phrases françaises qui disent précisément ce qui manque : on les
      // affiche telles quelles. Ceux de l'action sont des clés techniques —
      // « connexionRequise », « interdit » — qu'il faut traduire, sans quoi
      // l'usager lit un identifiant de code.
      const techniques = [
        "invalide",
        "interdit",
        "introuvable",
        "connexionRequise",
      ];
      setErreur(
        techniques.includes(resultat.cle)
          ? t(`erreurs.${resultat.cle}` as never)
          : resultat.cle,
      );
    });
  }

  const action = actions.find((entree) => entree.evenement === depliee);

  return (
    <div className="mt-6">
      {action && action.saisie === "message" ? (
        <form
          onSubmit={(evenement) => {
            evenement.preventDefault();
            envoyer(action.evenement, new FormData(evenement.currentTarget));
          }}
          className="rounded-carte border border-bordure bg-fond-eleve p-5"
        >
          <label htmlFor="message" className="block text-[0.9375rem] font-semibold">
            {t(`actions.${action.evenement}` as never)}
          </label>
          <textarea
            id="message"
            name="message"
            required
            minLength={2}
            maxLength={4000}
            rows={5}
            className="mt-2 w-full resize-y rounded-champ border border-bordure bg-fond-eleve px-4 py-3 text-base focus:border-accent"
          />

          {role === "assistance" ? (
            <label className="mt-3 flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                name="interne"
                value="true"
                className="mt-0.5 size-4 rounded border-bordure"
              />
              <span>
                <span className="font-medium">{t("noteInterne")}</span>
                <span className="mt-0.5 block text-texte-attenue">
                  {t("noteInterneAide")}
                </span>
              </span>
            </label>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={enCours}
              className={cn(
                "rounded-champ px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-60",
                STYLES[action.ton],
              )}
            >
              {t("confirmer")}
            </button>
            <button
              type="button"
              onClick={() => setDepliee(null)}
              className="rounded-champ border border-bordure px-4 py-2.5 text-sm font-medium transition-colors hover:border-accent"
            >
              {t("annuler")}
            </button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap gap-2">
          {actions.map((entree) => (
            <button
              key={entree.evenement}
              type="button"
              disabled={enCours}
              onClick={() =>
                entree.saisie === "aucune"
                  ? envoyer(entree.evenement, new FormData())
                  : setDepliee(entree.evenement)
              }
              className={cn(
                "rounded-champ px-3.5 py-2 text-sm font-medium transition-colors disabled:opacity-60",
                STYLES[entree.ton],
              )}
            >
              {t(`actions.${entree.evenement}` as never)}
            </button>
          ))}
        </div>
      )}

      {erreur ? (
        <p role="alert" className="mt-2 text-sm text-danger">
          {erreur}
        </p>
      ) : null}
    </div>
  );
}
