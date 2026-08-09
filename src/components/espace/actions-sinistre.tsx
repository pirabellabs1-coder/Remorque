"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import type { EvenementSinistre, StatutSinistre } from "@/domain/sinistre/machine";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { instruireSinistre } from "@/server/sinistres/actions";

/**
 * Actions possibles sur un sinistre, selon l'état et le rôle.
 *
 * Elles n'existent que pour l'administration : les parties déclarent, puis
 * lisent. Les actions sont dérivées plutôt qu'affichées puis grisées — un
 * bouton absent ne pose pas la question de savoir pourquoi il ne marche pas.
 *
 * Trois d'entre elles demandent une saisie — la référence pour transmettre,
 * le montant pour indemniser, le motif pour refuser. C'est le domaine qui
 * l'impose, l'écran ne fait que le rendre visible.
 */

type Action = {
  evenement: EvenementSinistre;
  ton: "principal" | "secondaire" | "danger";
  saisie: "aucune" | "reference" | "montant" | "motif";
};

function actionsPossibles(
  statut: StatutSinistre,
  role: "locataire" | "proprietaire" | "administrateur",
): Action[] {
  if (role !== "administrateur") return [];
  if (statut === "indemnise" || statut === "refuse") return [];

  if (statut === "declare") {
    return [
      { evenement: "transmettre", ton: "principal", saisie: "reference" },
      { evenement: "refuser", ton: "danger", saisie: "motif" },
    ];
  }

  return [
    ...(statut === "transmis"
      ? [{ evenement: "instruire" as const, ton: "secondaire" as const, saisie: "aucune" as const }]
      : []),
    { evenement: "indemniser", ton: "principal", saisie: "montant" },
    { evenement: "refuser", ton: "danger", saisie: "motif" },
  ];
}

const STYLES = {
  principal: "bg-accent text-accent-contraste hover:opacity-90",
  secondaire: "border border-bordure hover:border-accent hover:text-accent",
  danger: "border border-danger text-danger hover:bg-danger hover:text-white",
} as const;

export function ActionsSinistre({
  sinistreId,
  statut,
  role,
}: {
  sinistreId: string;
  statut: StatutSinistre;
  role: "locataire" | "proprietaire" | "administrateur";
}) {
  const t = useTranslations("espaces.sinistre");
  const router = useRouter();
  const [depliee, setDepliee] = useState<EvenementSinistre | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();

  const actions = actionsPossibles(statut, role);
  if (actions.length === 0) return null;

  function envoyer(evenement: EvenementSinistre, donnees: FormData) {
    setErreur(null);
    donnees.set("sinistreId", sinistreId);
    donnees.set("evenement", evenement);

    // La saisie est en euros, la base en centimes — règle 1.
    const euros = donnees.get("montantEuros");
    if (euros !== null) {
      donnees.delete("montantEuros");
      donnees.set("montant", String(Math.round(Number(euros) * 100)));
    }

    demarrer(async () => {
      const resultat = await instruireSinistre(donnees);

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

          {action.saisie === "reference" ? (
            <>
              <label
                htmlFor="referenceAssureur"
                className="mt-3 block text-sm font-medium"
              >
                {t("champReference")}
              </label>
              <p className="mt-1 text-sm text-texte-attenue">
                {t("referenceAide")}
              </p>
              <input
                id="referenceAssureur"
                name="referenceAssureur"
                type="text"
                required
                maxLength={120}
                className="mt-2 h-12 w-full rounded-champ border border-bordure bg-fond-eleve px-4 text-base focus:border-accent"
              />
            </>
          ) : null}

          {action.saisie === "montant" ? (
            <>
              <label
                htmlFor="montantEuros"
                className="mt-3 block text-sm font-medium"
              >
                {t("champMontant")}
              </label>
              <input
                id="montantEuros"
                name="montantEuros"
                type="number"
                step="0.01"
                min="0.01"
                required
                className="mt-2 h-12 w-full rounded-champ border border-bordure bg-fond-eleve px-4 text-base focus:border-accent"
              />
            </>
          ) : null}

          {action.saisie === "motif" ? (
            <>
              <label htmlFor="motif" className="mt-3 block text-sm font-medium">
                {t("champMotif")}
              </label>
              <p className="mt-1 text-sm text-texte-attenue">{t("motifAide")}</p>
              <textarea
                id="motif"
                name="motif"
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
