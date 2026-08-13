import { TRANSITIONS, type Evenement, type StatutReservation } from "./machine";

/**
 * Ce qu'un administrateur peut faire franchir, depuis un état donné.
 *
 * **Dérivé de la table des transitions, jamais recopié.** Les boutons du
 * locataire et du propriétaire vivent dans une liste écrite à la main, plus
 * restrictive que la machine — c'est un choix défendable pour eux : on ne veut
 * pas qu'un propriétaire « encaisse » d'un clic. Pour l'administrateur, le
 * raisonnement s'inverse : il est là précisément pour débloquer ce que le
 * cours normal n'a pas fait, et une liste recopiée finirait par ignorer une
 * transition ajoutée à la machine. Le jour où l'on ajoute un événement, il
 * apparaît ici sans qu'on y pense.
 *
 * **Pourquoi cela existe.** Le paiement est capturé par Stripe, et la
 * confirmation suit la capture. Sans clés — c'est le cas aujourd'hui — une
 * réservation acceptée reste acceptée pour toujours : aucun écran ne pouvait
 * la faire avancer, alors que la machine autorisait l'administrateur à le
 * faire depuis l'origine. La permission existait, le chemin pour l'exercer,
 * non. C'est aussi ce qui permet de rattraper une capture bloquée le jour où
 * Stripe existera — l'exigence de réversibilité de la section 06.
 */
export function evenementsAdministrateur(
  statut: StatutReservation,
): Evenement[] {
  return (Object.keys(TRANSITIONS) as Evenement[]).filter((evenement) =>
    TRANSITIONS[evenement].some(
      (regle) =>
        regle.depuis === statut && regle.acteurs.includes("administrateur"),
    ),
  );
}

/**
 * L'événement mène-t-il vers l'avant du parcours, ou vers une sortie ?
 *
 * Sert à colorer les commandes : forcer un encaissement n'est pas annuler une
 * location, et les deux boutons ne doivent pas se ressembler. Un administrateur
 * fatigué qui clique au mauvais endroit ne défait pas une annulation.
 */
export const EVENEMENTS_DE_SORTIE = [
  "refuser",
  "annuler",
  "expirer",
] as const satisfies readonly Evenement[];

export function estUneSortie(evenement: Evenement): boolean {
  return (EVENEMENTS_DE_SORTIE as readonly string[]).includes(evenement);
}
