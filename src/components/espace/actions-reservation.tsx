"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import type { Evenement, StatutReservation } from "@/domain/reservation/machine";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { franchir } from "@/server/reservations/actions";

/**
 * Boutons d'action sur une réservation.
 *
 * Les actions proposées dépendent de l'état **et** du rôle : un propriétaire
 * accepte ou refuse une demande, un locataire annule la sienne. La liste est
 * dérivée du statut plutôt qu'affichée en permanence et grisée — un bouton
 * désactivé laisse chercher pourquoi, un bouton absent ne pose pas la question.
 *
 * La machine à états reste seule juge : ces libellés ne font que proposer, et
 * une transition refusée par le domaine remonte son motif tel quel. Deux
 * vérités valent mieux qu'une interface qui devine.
 */

type Action = { evenement: Evenement; ton: "principal" | "secondaire" | "danger" };

/**
 * Ce que chaque rôle peut déclencher, selon l'état courant.
 *
 * Volontairement plus restrictif que la machine : celle-ci autorise le système
 * à encaisser ou à démarrer une location, ce qui relèvera du paiement et de
 * l'horloge, non d'un bouton.
 */
const ACTIONS: Record<string, Partial<Record<StatutReservation, Action[]>>> = {
  proprietaire: {
    demandee: [
      { evenement: "accepter", ton: "principal" },
      { evenement: "refuser", ton: "danger" },
    ],
    restituee: [{ evenement: "cloturer", ton: "principal" }],
    en_cours: [{ evenement: "restituer", ton: "principal" }],
    confirmee: [{ evenement: "demarrer", ton: "principal" }],
  },
  locataire: {
    demandee: [{ evenement: "annuler", ton: "secondaire" }],
    acceptee: [{ evenement: "annuler", ton: "secondaire" }],
    payee: [{ evenement: "annuler", ton: "secondaire" }],
    confirmee: [{ evenement: "annuler", ton: "secondaire" }],
  },
};

const STYLES = {
  principal: "bg-accent text-accent-contraste hover:opacity-90",
  secondaire: "border border-bordure hover:border-accent hover:text-accent",
  danger: "border border-danger text-danger hover:bg-danger hover:text-white",
} as const;

export function ActionsReservation({
  reservationId,
  statut,
  role,
}: {
  reservationId: string;
  statut: StatutReservation;
  role: "proprietaire" | "locataire";
}) {
  const t = useTranslations("espaces.actions");
  const router = useRouter();
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();

  const actions = ACTIONS[role]?.[statut] ?? [];
  if (actions.length === 0) return null;

  function declencher(evenement: Evenement) {
    setErreur(null);

    demarrer(async () => {
      const donnees = new FormData();
      donnees.set("reservationId", reservationId);
      donnees.set("evenement", evenement);
      donnees.set("role", role);

      const resultat = await franchir(donnees);

      if (resultat.ok) {
        router.refresh();
        return;
      }

      // Le motif vient du domaine et est déjà rédigé en français : l'afficher
      // tel quel vaut mieux qu'un message générique qui masquerait « les fonds
      // sont gelés, un litige reste ouvert ».
      setErreur(resultat.cle);
    });
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {actions.map((action) => (
          <button
            key={action.evenement}
            type="button"
            onClick={() => declencher(action.evenement)}
            disabled={enCours}
            className={cn(
              "rounded-champ px-3.5 py-2 text-sm font-medium transition-colors disabled:opacity-60",
              STYLES[action.ton],
            )}
          >
            {t(action.evenement as never)}
          </button>
        ))}
      </div>

      {erreur ? (
        <p role="alert" className="mt-2 text-sm text-danger">
          {erreur}
        </p>
      ) : null}
    </div>
  );
}
