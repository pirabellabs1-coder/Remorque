/**
 * Machine à états d'un sinistre (M09).
 *
 * Module pur, comme ses deux aînées — réservation et litige : il dit ce qui
 * est permis, sans écrire en base ni envoyer de courriel.
 *
 * Le sinistre diffère du litige sur un point qui commande tout le reste : la
 * plateforme n'y décide de rien. Elle transmet au courtier partenaire, suit
 * l'instruction, et enregistre ce que l'assureur a conclu. D'où une machine
 * sans arbitrage : les parties déclarent, l'administration fait avancer le
 * dossier, et la clôture — indemnisation ou refus — vient du dehors.
 *
 * Tant que le dossier vit, les fonds restent immobilisés — règle 6 : un
 * matériel peut-être volé ou détruit n'autorise ni à rendre la caution ni à
 * payer le propriétaire comme si de rien n'était.
 */

export const STATUTS_SINISTRE = [
  "declare",
  "transmis",
  "en_cours",
  "indemnise",
  "refuse",
] as const;

export type StatutSinistre = (typeof STATUTS_SINISTRE)[number];

/** Les états où l'argent reste immobilisé. */
export const STATUTS_GELANTS_SINISTRE = [
  "declare",
  "transmis",
  "en_cours",
] as const satisfies readonly StatutSinistre[];

export type ActeurSinistre = "locataire" | "proprietaire" | "administrateur";

export type EvenementSinistre =
  | "transmettre"
  | "instruire"
  | "indemniser"
  | "refuser";

type Regle = {
  depuis: StatutSinistre;
  vers: StatutSinistre;
  acteurs: readonly ActeurSinistre[];
  description: string;
};

export const TRANSITIONS_SINISTRE: Record<EvenementSinistre, readonly Regle[]> = {
  transmettre: [
    {
      depuis: "declare",
      vers: "transmis",
      // Transmettre engage la plateforme vis-à-vis du courtier : c'est un
      // geste d'administration, pas une formalité que les parties se rendent.
      acteurs: ["administrateur"],
      description: "Le dossier part chez le courtier, référence à l'appui.",
    },
  ],
  instruire: [
    {
      depuis: "transmis",
      vers: "en_cours",
      acteurs: ["administrateur"],
      description: "L'assureur a ouvert l'instruction du dossier.",
    },
  ],
  indemniser: [
    {
      depuis: "transmis",
      vers: "indemnise",
      // L'assureur peut indemniser sans phase d'instruction visible : les
      // petits dossiers se règlent sur pièces.
      acteurs: ["administrateur"],
      description: "L'assureur indemnise sur pièces, sans instruction.",
    },
    {
      depuis: "en_cours",
      vers: "indemnise",
      acteurs: ["administrateur"],
      description: "L'instruction conclut à l'indemnisation.",
    },
  ],
  refuser: [
    {
      depuis: "declare",
      vers: "refuse",
      // Un refus dès la déclaration : dossier hors garantie, ou déclaration
      // manifestement infondée. Motiver est obligatoire — le refus sera opposé
      // au déclarant.
      acteurs: ["administrateur"],
      description: "Déclaration hors garantie, refusée avant transmission.",
    },
    {
      depuis: "transmis",
      vers: "refuse",
      acteurs: ["administrateur"],
      description: "L'assureur refuse la prise en charge.",
    },
    {
      depuis: "en_cours",
      vers: "refuse",
      acteurs: ["administrateur"],
      description: "L'instruction conclut au refus de garantie.",
    },
  ],
};

export type VerdictSinistre =
  | { autorise: true; statutSuivant: StatutSinistre }
  | { autorise: false; motif: string };

export function evaluerSinistre(
  evenement: EvenementSinistre,
  contexte: {
    statut: StatutSinistre;
    acteur: ActeurSinistre;
    /** Exigée pour « transmettre » : sans elle, rien n'est parti nulle part. */
    referenceAssureur?: string;
    /** Exigé pour « indemniser » : une indemnisation sans montant n'existe pas. */
    montantIndemnise?: number;
    /** Exigé pour « refuser » : le refus sera opposé au déclarant. */
    motifRefus?: string;
  },
): VerdictSinistre {
  const regles = TRANSITIONS_SINISTRE[evenement];
  const applicable = regles.find((regle) => regle.depuis === contexte.statut);

  if (!applicable) {
    return {
      autorise: false,
      motif: `Un sinistre « ${contexte.statut} » ne peut pas recevoir « ${evenement} ».`,
    };
  }

  if (!applicable.acteurs.includes(contexte.acteur)) {
    return {
      autorise: false,
      motif: "Vous n'avez pas qualité pour cette action sur le sinistre.",
    };
  }

  if (evenement === "transmettre" && !contexte.referenceAssureur?.trim()) {
    return {
      autorise: false,
      motif: "La transmission exige la référence donnée par l'assureur.",
    };
  }

  if (evenement === "indemniser") {
    const montant = contexte.montantIndemnise ?? 0;
    if (!Number.isInteger(montant) || montant <= 0) {
      return {
        autorise: false,
        motif: "L'indemnisation exige un montant entier de centimes, positif.",
      };
    }
  }

  if (evenement === "refuser" && !contexte.motifRefus?.trim()) {
    return {
      autorise: false,
      motif: "Un refus doit être motivé : il sera opposé au déclarant.",
    };
  }

  return { autorise: true, statutSuivant: applicable.vers };
}

/** Le sinistre immobilise-t-il encore les fonds ? */
export function gelActifSinistre(statut: StatutSinistre): boolean {
  return (STATUTS_GELANTS_SINISTRE as readonly string[]).includes(statut);
}
