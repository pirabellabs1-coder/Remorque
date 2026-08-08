"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import type { EvenementLitige, StatutLitige } from "@/domain/litige/machine";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { franchirLitige } from "@/server/litiges/actions";

/**
 * Actions possibles sur un litige, selon l'état et le rôle.
 *
 * Comme pour les réservations, les actions sont **dérivées** plutôt
 * qu'affichées puis grisées : un bouton absent ne pose pas la question de
 * savoir pourquoi il ne marche pas.
 *
 * Deux d'entre elles demandent une saisie — proposer un montant, trancher —
 * et se déplient donc en formulaire. Trancher exige un motif : c'est le
 * domaine qui l'impose, l'écran ne fait que le rendre visible.
 */

type Action = {
  evenement: EvenementLitige;
  ton: "principal" | "secondaire" | "danger";
  /** L'action demande-t-elle un montant, un motif ? */
  saisie: "aucune" | "montant" | "decision";
};

function actionsPossibles(
  statut: StatutLitige,
  role: "locataire" | "proprietaire" | "administrateur",
  ouvertParMoi: boolean,
): Action[] {
  if (statut === "resolu" || statut === "clos_sans_suite") return [];

  if (role === "administrateur") {
    return [
      ...(statut === "en_arbitrage" || statut === "en_resolution_amiable"
        ? [{ evenement: "trancher" as const, ton: "principal" as const, saisie: "decision" as const }]
        : []),
      ...(statut !== "en_arbitrage"
        ? [{ evenement: "escalader" as const, ton: "secondaire" as const, saisie: "aucune" as const }]
        : []),
      { evenement: "classer", ton: "danger", saisie: "aucune" },
    ];
  }

  return [
    // Seule la partie visée propose un règlement : celui qui réclame a déjà
    // dit son chiffre en ouvrant.
    ...(statut === "ouvert" && !ouvertParMoi
      ? [{ evenement: "proposer" as const, ton: "principal" as const, saisie: "montant" as const }]
      : []),
    { evenement: "escalader", ton: "secondaire", saisie: "aucune" },
    ...(statut === "ouvert" && ouvertParMoi
      ? [{ evenement: "retirer" as const, ton: "danger" as const, saisie: "aucune" as const }]
      : []),
  ];
}

const STYLES = {
  principal: "bg-accent text-accent-contraste hover:opacity-90",
  secondaire: "border border-bordure hover:border-accent hover:text-accent",
  danger: "border border-danger text-danger hover:bg-danger hover:text-white",
} as const;

export function ActionsLitige({
  litigeId,
  statut,
  role,
  ouvertParMoi,
  plafondEuros,
}: {
  litigeId: string;
  statut: StatutLitige;
  role: "locataire" | "proprietaire" | "administrateur";
  ouvertParMoi: boolean;
  /** Montant réclamé, en euros : on n'accorde jamais au-delà. */
  plafondEuros: number;
}) {
  const t = useTranslations("espaces.litige");
  const router = useRouter();
  const [depliee, setDepliee] = useState<EvenementLitige | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();

  const actions = actionsPossibles(statut, role, ouvertParMoi);
  if (actions.length === 0) return null;

  function envoyer(evenement: EvenementLitige, donnees: FormData) {
    setErreur(null);
    donnees.set("litigeId", litigeId);
    donnees.set("evenement", evenement);

    // La saisie est en euros, la base en centimes — règle 1. La conversion se
    // fait ici, au moment de partir : un champ caché tenu à jour en parallèle
    // finit toujours par se désynchroniser de celui qu'on remplit.
    const euros = donnees.get("montantEuros");
    if (euros !== null) {
      donnees.delete("montantEuros");
      donnees.set("montant", String(Math.round(Number(euros) * 100)));
    }

    demarrer(async () => {
      const resultat = await franchirLitige(donnees);

      if (resultat.ok) {
        setDepliee(null);
        router.refresh();
        return;
      }

      // Les refus du domaine sont déjà rédigés en français et disent
      // précisément ce qui manque : les afficher tels quels vaut mieux qu'un
      // message générique.
      setErreur(resultat.cle);
    });
  }

  const action = actions.find((entree) => entree.evenement === depliee);

  return (
    <div className="mt-6">
      {action && action.saisie !== "aucune" ? (
        <form
          onSubmit={(evenement) => {
            evenement.preventDefault();
            envoyer(action.evenement, new FormData(evenement.currentTarget));
          }}
          className="rounded-carte border border-bordure bg-fond-eleve p-5"
        >
          <p className="text-[0.9375rem] font-semibold">
            {t(`actions.${action.evenement}` as never)}
          </p>

          <label htmlFor="montantEuros" className="mt-3 block text-sm font-medium">
            {t("champMontant")}
          </label>
          <input
            id="montantEuros"
            name="montantEuros"
            type="number"
            step="0.01"
            min="0"
            max={plafondEuros}
            required
            className="mt-2 h-12 w-full rounded-champ border border-bordure bg-fond-eleve px-4 text-base focus:border-accent"
          />

          {action.saisie === "decision" ? (
            <>
              <label
                htmlFor="decisionMotif"
                className="mt-4 block text-sm font-medium"
              >
                {t("champMotif")}
              </label>
              <p className="mt-1 text-sm text-texte-attenue">{t("motifAide")}</p>
              <textarea
                id="decisionMotif"
                name="decisionMotif"
                required
                minLength={10}
                rows={4}
                className="mt-2 w-full resize-y rounded-champ border border-bordure bg-fond-eleve px-4 py-3 text-base focus:border-accent"
              />
            </>
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
