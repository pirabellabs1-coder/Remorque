/**
 * Machine à états d'une demande d'assistance (M14).
 *
 * Module pur, comme ses aînées — réservation, litige, sinistre : il dit ce qui
 * est permis, sans écrire en base ni envoyer de courriel.
 *
 * Le support diffère des trois autres sur un point : il ne porte pas d'argent.
 * Personne n'y est adversaire, rien n'y est gelé, et la plateforme n'y arbitre
 * pas entre deux parties — elle répond. D'où une machine courte, et une seule
 * exigence qui la traverse : **une demande ne se clôt pas sans réponse**. Un
 * ticket résolu que personne n'a jamais lu est le seul défaut qui compte ici,
 * parce qu'il fait mentir l'indicateur au moment même où il rassure.
 *
 * Le demandeur garde deux droits sur son dossier : relancer tant qu'il est
 * ouvert, et renoncer. Le reste appartient à l'assistance.
 */

export const STATUTS_SUPPORT = ["ouvert", "en_cours", "resolu"] as const;

export type StatutSupport = (typeof STATUTS_SUPPORT)[number];

export type ActeurSupport = "demandeur" | "assistance";

export type EvenementSupport = "prendre" | "repondre" | "resoudre" | "renoncer";

export const PRIORITES_SUPPORT = ["basse", "normale", "haute"] as const;

export type PrioriteSupport = (typeof PRIORITES_SUPPORT)[number];

type Regle = {
  depuis: StatutSupport;
  vers: StatutSupport;
  acteurs: readonly ActeurSupport[];
  description: string;
};

export const TRANSITIONS_SUPPORT: Record<EvenementSupport, readonly Regle[]> = {
  prendre: [
    {
      depuis: "ouvert",
      vers: "en_cours",
      // Prendre en charge, c'est s'engager nommément : le ticket cesse d'être
      // dans la file commune et porte le nom de quelqu'un.
      acteurs: ["assistance"],
      description: "L'assistance prend la demande en charge.",
    },
  ],
  repondre: [
    {
      depuis: "ouvert",
      vers: "en_cours",
      // Répondre vaut prise en charge : exiger les deux gestes ferait
      // diverger l'indicateur de la réalité, puisque la première réponse
      // serait datée d'un ticket resté « ouvert ».
      acteurs: ["assistance"],
      description: "Une réponse vaut prise en charge.",
    },
    {
      depuis: "en_cours",
      vers: "en_cours",
      // Le demandeur relance, l'assistance complète : l'échange se poursuit
      // sans changer d'état.
      acteurs: ["assistance", "demandeur"],
      description: "L'échange se poursuit.",
    },
  ],
  resoudre: [
    {
      depuis: "en_cours",
      vers: "resolu",
      acteurs: ["assistance"],
      description: "La demande est traitée et close.",
    },
  ],
  renoncer: [
    {
      depuis: "ouvert",
      vers: "resolu",
      // Celui qui a écrit peut retirer sa demande tant que personne ne s'en
      // est saisi — la sortie honorable quand le problème se résout seul.
      acteurs: ["demandeur"],
      description: "Le demandeur retire sa demande.",
    },
  ],
};

export type VerdictSupport =
  | { autorise: true; statutSuivant: StatutSupport }
  | { autorise: false; motif: string };

export function evaluerSupport(
  evenement: EvenementSupport,
  contexte: {
    statut: StatutSupport;
    acteur: ActeurSupport;
    /** Corps du message, exigé pour « répondre ». */
    message?: string;
    /** Le dossier porte-t-il déjà une réponse de l'assistance ? */
    dejaRepondu?: boolean;
  },
): VerdictSupport {
  const regles = TRANSITIONS_SUPPORT[evenement];
  const applicable = regles.find((regle) => regle.depuis === contexte.statut);

  if (!applicable) {
    return {
      autorise: false,
      motif: `Une demande « ${contexte.statut} » ne peut pas recevoir « ${evenement} ».`,
    };
  }

  if (!applicable.acteurs.includes(contexte.acteur)) {
    return {
      autorise: false,
      motif: "Vous n'avez pas qualité pour cette action sur la demande.",
    };
  }

  if (evenement === "repondre" && !contexte.message?.trim()) {
    return { autorise: false, motif: "Une réponse vide n'en est pas une." };
  }

  // La règle qui justifie ce module : on ne clôt pas ce qu'on n'a pas lu. Un
  // ticket passé de « en cours » à « résolu » sans qu'une seule réponse soit
  // partie laisserait le demandeur devant un dossier clos et un silence.
  if (evenement === "resoudre" && !contexte.dejaRepondu) {
    return {
      autorise: false,
      motif: "Une demande ne se clôt pas sans qu'une réponse ait été faite.",
    };
  }

  return { autorise: true, statutSuivant: applicable.vers };
}

/**
 * Le délai de première réponse est-il tenu ?
 *
 * L'engagement est exprimé en heures et dépend de la priorité : une demande
 * haute ne peut pas attendre autant qu'une question de curiosité. La fonction
 * répond sur une demande **encore sans réponse** — une fois répondu, le délai
 * se mesure sur le fait, plus sur l'attente.
 */
export const DELAI_PREMIERE_REPONSE_HEURES: Record<PrioriteSupport, number> = {
  haute: 4,
  normale: 24,
  basse: 72,
};

export function delaiDepasse(entree: {
  priorite: PrioriteSupport;
  /** Heures écoulées depuis l'ouverture. */
  heuresEcoulees: number;
  premiereReponseFaite: boolean;
}): boolean {
  if (entree.premiereReponseFaite) return false;
  return entree.heuresEcoulees > DELAI_PREMIERE_REPONSE_HEURES[entree.priorite];
}
