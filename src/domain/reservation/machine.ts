/**
 * Machine à états d'une réservation — figure 4 du cadrage.
 *
 * « C'est la partie la plus délicate du développement et celle qui génère le
 * plus de tickets de support si elle est bâclée. »
 *
 * Ce module est volontairement pur : aucune dépendance à la base, au réseau
 * ni à l'horloge système. Il décrit ce qui est permis ; l'application des
 * effets (écriture, notifications, mouvements d'argent) est faite par le
 * service `appliquerTransition`, qui s'appuie sur ce module.
 */

export const STATUTS = [
  "demandee",
  "acceptee",
  "payee",
  "confirmee",
  "en_cours",
  "restituee",
  "cloturee",
  "refusee",
  "expiree",
  "annulee",
] as const;

export type StatutReservation = (typeof STATUTS)[number];

export type Acteur = "locataire" | "proprietaire" | "systeme" | "administrateur";

/** États terminaux : plus aucune transition ordinaire n'est possible. */
export const STATUTS_TERMINAUX = [
  "cloturee",
  "refusee",
  "expiree",
  "annulee",
] as const satisfies readonly StatutReservation[];

export type Evenement =
  | "accepter"
  | "refuser"
  | "expirer"
  | "encaisser"
  | "confirmer"
  | "demarrer"
  | "restituer"
  | "cloturer"
  | "annuler";

type Regle = {
  depuis: StatutReservation;
  vers: StatutReservation;
  /** Qui a le droit de déclencher l'événement. */
  acteurs: readonly Acteur[];
  description: string;
};

/**
 * Transitions autorisées. Toute transition absente de cette table est refusée :
 * la liste est exhaustive et sert de spécification au développement comme à la
 * recette.
 */
export const TRANSITIONS: Record<Evenement, readonly Regle[]> = {
  accepter: [
    {
      depuis: "demandee",
      vers: "acceptee",
      acteurs: ["proprietaire", "administrateur"],
      description:
        "Le propriétaire accepte la demande dans le délai de vingt-quatre heures (M05).",
    },
  ],
  refuser: [
    {
      depuis: "demandee",
      vers: "refusee",
      acteurs: ["proprietaire", "administrateur"],
      description:
        "Refus explicite : l'autorisation de paiement est relâchée et la caution annulée.",
    },
  ],
  expirer: [
    {
      depuis: "demandee",
      vers: "expiree",
      acteurs: ["systeme"],
      description:
        "Aucune réponse du propriétaire dans le délai imparti : la demande tombe d'elle-même.",
    },
  ],
  encaisser: [
    {
      depuis: "acceptee",
      vers: "payee",
      // L'administrateur peut relancer une capture bloquée depuis l'espace
      // finance : c'est l'exigence de réversibilité de la section 06.
      acteurs: ["systeme", "administrateur"],
      description:
        "Capture effective du paiement autorisé à la demande (figure 5 — débit effectif).",
    },
  ],
  confirmer: [
    {
      depuis: "payee",
      vers: "confirmee",
      acteurs: ["systeme", "administrateur"],
      description:
        "Contrat généré, attestation d'assurance émise, code de retrait communiqué.",
    },
  ],
  demarrer: [
    {
      depuis: "confirmee",
      vers: "en_cours",
      acteurs: ["proprietaire", "locataire", "administrateur"],
      description:
        "Retrait effectué : code de retrait validé et état des lieux de départ signé.",
    },
  ],
  restituer: [
    {
      depuis: "en_cours",
      vers: "restituee",
      acteurs: ["proprietaire", "locataire", "administrateur"],
      description:
        "Matériel rendu et état des lieux de retour signé par les deux parties.",
    },
  ],
  cloturer: [
    {
      depuis: "restituee",
      vers: "cloturee",
      acteurs: ["systeme", "administrateur"],
      description:
        "Caution libérée et fonds transférés au propriétaire : la location est soldée.",
    },
  ],
  annuler: [
    {
      depuis: "demandee",
      vers: "annulee",
      acteurs: ["locataire", "proprietaire", "administrateur"],
      description: "Annulation avant acceptation, sans frais.",
    },
    {
      depuis: "acceptee",
      vers: "annulee",
      acteurs: ["locataire", "proprietaire", "administrateur", "systeme"],
      description:
        "Annulation après acceptation, ou échec définitif du paiement (M06).",
    },
    {
      depuis: "payee",
      vers: "annulee",
      acteurs: ["locataire", "proprietaire", "administrateur"],
      description:
        "Remboursement calculé selon la politique d'annulation de l'annonce (M05).",
    },
    {
      depuis: "confirmee",
      vers: "annulee",
      acteurs: ["locataire", "proprietaire", "administrateur"],
      description:
        "Annulation avant le retrait, avec remboursement selon la politique choisie.",
    },
  ],
};

export type ContexteTransition = {
  statut: StatutReservation;
  acteur: Acteur;
  /**
   * Un litige ou un sinistre ouvert gèle les fonds : « le passage à Fonds
   * transférés n'a jamais lieu tant qu'un litige ou un sinistre reste ouvert »
   * (figure 4).
   */
  fondsGeles?: boolean;
};

export type ResultatTransition =
  | { autorise: true; statutSuivant: StatutReservation }
  | { autorise: false; motif: string };

export function estTerminal(statut: StatutReservation): boolean {
  return (STATUTS_TERMINAUX as readonly StatutReservation[]).includes(statut);
}

/**
 * Évalue une transition sans l'appliquer.
 *
 * Un administrateur peut forcer une transition déclarée dans la table — c'est
 * l'exigence de réversibilité de la section 06 — mais il ne peut pas inventer
 * une transition qui n'existe pas, et il ne peut pas contourner le gel des
 * fonds : lever un gel est une action distincte, tracée au journal d'audit.
 */
export function evaluerTransition(
  evenement: Evenement,
  contexte: ContexteTransition,
): ResultatTransition {
  const regles = TRANSITIONS[evenement];
  const regle = regles.find((candidate) => candidate.depuis === contexte.statut);

  if (!regle) {
    return {
      autorise: false,
      motif: `Transition « ${evenement} » impossible depuis l'état « ${contexte.statut} ».`,
    };
  }

  if (!regle.acteurs.includes(contexte.acteur)) {
    return {
      autorise: false,
      motif: `L'acteur « ${contexte.acteur} » n'est pas habilité à déclencher « ${evenement} ».`,
    };
  }

  if (evenement === "cloturer" && contexte.fondsGeles) {
    return {
      autorise: false,
      motif:
        "Les fonds sont gelés : un litige ou un sinistre reste ouvert sur cette réservation.",
    };
  }

  return { autorise: true, statutSuivant: regle.vers };
}

/** Événements réellement proposables à un acteur dans l'état courant. */
export function evenementsDisponibles(
  contexte: ContexteTransition,
): Evenement[] {
  return (Object.keys(TRANSITIONS) as Evenement[]).filter(
    (evenement) => evaluerTransition(evenement, contexte).autorise,
  );
}
