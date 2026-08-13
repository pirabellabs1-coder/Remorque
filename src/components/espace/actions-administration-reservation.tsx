"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import type { StatutReservation } from "@/domain/reservation/machine";
import {
  estUneSortie,
  evenementsAdministrateur,
} from "@/domain/reservation/transitions-administrateur";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { forcerTransition } from "@/server/reservations/actions-administration";

/**
 * Commandes d'administration sur une réservation.
 *
 * **Rien n'est proposé tant qu'on n'a pas demandé.** Un seul lien discret
 * ouvre le panneau. Une rangée de boutons « encaisser / confirmer / annuler »
 * sur chaque ligne d'un tableau de cent réservations transforme une table de
 * consultation en champ de mines : on vient y lire, et l'on force une
 * transition d'un clic mal placé.
 *
 * **Le motif se saisit avant, pas après.** Le serveur l'exige, et le demander
 * ici pendant que la raison est en tête évite le « déblocage » écrit
 * machinalement pour satisfaire un message d'erreur. C'est ce texte qui
 * répondra, six mois plus tard, à « pourquoi cette réservation est-elle passée
 * en payée sans paiement ».
 *
 * Les événements viennent du domaine, dérivés de la table des transitions :
 * aucune liste recopiée ici, donc aucune divergence possible avec ce que la
 * machine acceptera réellement.
 */
export function ActionsAdministrationReservation({
  reservationId,
  statut,
}: {
  reservationId: string;
  statut: StatutReservation;
}) {
  const t = useTranslations("espaces.admin.reservations.forcer");
  const routeur = useRouter();

  const [ouvert, setOuvert] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();

  const evenements = evenementsAdministrateur(statut);
  if (evenements.length === 0) return null;

  function envoyer(formulaire: HTMLFormElement, evenement: string) {
    setErreur(null);
    const donnees = new FormData(formulaire);
    donnees.set("reservation", reservationId);
    donnees.set("evenement", evenement);

    demarrer(async () => {
      const resultat = await forcerTransition(donnees);
      if (!resultat.ok) {
        setErreur(resultat.cle);
        return;
      }
      setOuvert(false);
      routeur.refresh();
    });
  }

  if (!ouvert) {
    return (
      <button
        type="button"
        onClick={() => setOuvert(true)}
        className="text-sm font-medium text-accent underline underline-offset-4"
      >
        {t("ouvrir")}
      </button>
    );
  }

  return (
    <form
      onSubmit={(evenement) => evenement.preventDefault()}
      className="mt-2 rounded-carte border border-bordure bg-fond-doux p-3"
    >
      <label className="block">
        <span className="block text-xs font-medium text-texte-attenue">
          {t("motif")}
        </span>
        <textarea
          name="motif"
          rows={2}
          required
          minLength={5}
          placeholder={t("motifExemple")}
          className="mt-1 w-full rounded-champ border border-bordure bg-fond-eleve px-3 py-2 text-sm"
        />
      </label>

      {erreur ? (
        <p className="mt-2 text-sm text-danger" role="alert">
          {t(`erreur.${erreur}`)}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        {evenements.map((evenement) => (
          <button
            key={evenement}
            type="button"
            disabled={enCours}
            onClick={(clic) => {
              const formulaire = clic.currentTarget.form;
              if (formulaire?.reportValidity()) envoyer(formulaire, evenement);
            }}
            className={cn(
              "rounded-champ border px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50",
              estUneSortie(evenement)
                ? "border-danger/40 text-danger hover:bg-danger/5"
                : "border-bordure hover:border-accent hover:text-accent",
            )}
          >
            {t(`evenements.${evenement}`)}
          </button>
        ))}

        <button
          type="button"
          onClick={() => setOuvert(false)}
          className="px-3 py-2 text-sm text-texte-attenue underline underline-offset-4"
        >
          {t("annuler")}
        </button>
      </div>
    </form>
  );
}
