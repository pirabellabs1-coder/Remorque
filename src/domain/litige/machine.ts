/**
 * Machine à états d'un litige (M13).
 *
 * Module pur, comme celui de la réservation : il dit ce qui est permis, sans
 * savoir écrire en base ni envoyer un courriel. C'est ce qui le rend
 * vérifiable en recette, et ce qui permet d'énoncer les règles d'arbitrage
 * ailleurs que dans un écran.
 *
 * Le litige n'est pas un ticket de support : il porte de l'argent. Tant qu'il
 * est ouvert, les fonds sont gelés — règle 6 — et sa résolution décide qui est
 * payé. D'où deux exigences qui traversent tout ce fichier : **on ne clôt
 * jamais un litige sans décision motivée**, et **le montant accordé ne peut
 * excéder ce qui est réclamé**.
 */

export const STATUTS_LITIGE = [
  "ouvert",
  "en_resolution_amiable",
  "en_arbitrage",
  "resolu",
  "clos_sans_suite",
] as const;

export type StatutLitige = (typeof STATUTS_LITIGE)[number];

/** Les états où l'argent reste immobilisé. */
export const STATUTS_GELANTS = [
  "ouvert",
  "en_resolution_amiable",
  "en_arbitrage",
] as const satisfies readonly StatutLitige[];

export type ActeurLitige = "locataire" | "proprietaire" | "administrateur";

export type EvenementLitige =
  | "proposer"
  | "escalader"
  | "trancher"
  | "classer"
  | "retirer";

export const MOTIFS_LITIGE = [
  "dommage",
  "retard",
  "non_conformite",
  "annulation",
  "paiement",
] as const;

export type MotifLitige = (typeof MOTIFS_LITIGE)[number];

type Regle = {
  depuis: StatutLitige;
  vers: StatutLitige;
  acteurs: readonly ActeurLitige[];
  description: string;
};

export const TRANSITIONS_LITIGE: Record<EvenementLitige, readonly Regle[]> = {
  proposer: [
    {
      depuis: "ouvert",
      vers: "en_resolution_amiable",
      // La partie adverse propose un règlement : c'est la voie la moins
      // coûteuse pour tout le monde, et de loin la plus fréquente.
      acteurs: ["locataire", "proprietaire", "administrateur"],
      description: "Un montant est proposé à l'amiable par la partie adverse.",
    },
  ],
  escalader: [
    {
      depuis: "ouvert",
      vers: "en_arbitrage",
      acteurs: ["locataire", "proprietaire", "administrateur"],
      description: "Aucun accord possible : la plateforme est saisie.",
    },
    {
      depuis: "en_resolution_amiable",
      vers: "en_arbitrage",
      acteurs: ["locataire", "proprietaire", "administrateur"],
      description: "La proposition amiable est refusée : la plateforme tranche.",
    },
  ],
  trancher: [
    {
      depuis: "en_arbitrage",
      vers: "resolu",
      // L'arbitrage appartient à la plateforme seule : une partie qui
      // trancherait son propre litige n'arbitre pas, elle se sert.
      acteurs: ["administrateur"],
      description: "Décision motivée de la plateforme, montant accordé fixé.",
    },
    {
      depuis: "en_resolution_amiable",
      vers: "resolu",
      acteurs: ["administrateur"],
      description: "L'accord amiable est entériné par la plateforme.",
    },
  ],
  classer: [
    {
      depuis: "ouvert",
      vers: "clos_sans_suite",
      acteurs: ["administrateur"],
      description: "Litige sans objet ou abandonné : classé sans suite.",
    },
    {
      depuis: "en_resolution_amiable",
      vers: "clos_sans_suite",
      acteurs: ["administrateur"],
      description: "Litige sans objet ou abandonné : classé sans suite.",
    },
    {
      depuis: "en_arbitrage",
      vers: "clos_sans_suite",
      acteurs: ["administrateur"],
      description: "Litige sans objet ou abandonné : classé sans suite.",
    },
  ],
  retirer: [
    {
      depuis: "ouvert",
      vers: "clos_sans_suite",
      // Celui qui a ouvert peut renoncer tant que rien n'est engagé : c'est
      // la sortie honorable quand les parties s'entendent d'elles-mêmes.
      acteurs: ["locataire", "proprietaire"],
      description: "Le demandeur retire sa réclamation.",
    },
  ],
};

export type VerdictLitige =
  | { autorise: true; statutSuivant: StatutLitige }
  | { autorise: false; motif: string };

export function evaluerLitige(
  evenement: EvenementLitige,
  contexte: {
    statut: StatutLitige;
    acteur: ActeurLitige;
    /** Renseigné pour « trancher » : la décision doit être motivée et chiffrée. */
    montantAccorde?: number;
    montantReclame?: number;
    decisionMotif?: string;
  },
): VerdictLitige {
  const regles = TRANSITIONS_LITIGE[evenement];
  const applicable = regles.find((regle) => regle.depuis === contexte.statut);

  if (!applicable) {
    return {
      autorise: false,
      motif: `Un litige « ${contexte.statut} » ne peut pas recevoir « ${evenement} ».`,
    };
  }

  if (!applicable.acteurs.includes(contexte.acteur)) {
    return {
      autorise: false,
      motif: "Vous n'avez pas qualité pour cette action sur le litige.",
    };
  }

  if (evenement === "trancher") {
    // Une décision sans motif est indéfendable : elle sera opposée à la partie
    // perdante, qui a le droit de savoir pourquoi.
    if (!contexte.decisionMotif?.trim()) {
      return { autorise: false, motif: "La décision doit être motivée." };
    }

    const accorde = contexte.montantAccorde ?? 0;
    if (accorde < 0) {
      return { autorise: false, motif: "Le montant accordé ne peut être négatif." };
    }

    // Accorder plus que réclamé, ce n'est plus arbitrer un différend : c'est en
    // créer un autre.
    if (
      contexte.montantReclame !== undefined &&
      accorde > contexte.montantReclame
    ) {
      return {
        autorise: false,
        motif: "Le montant accordé ne peut excéder le montant réclamé.",
      };
    }
  }

  return { autorise: true, statutSuivant: applicable.vers };
}

/** Le litige immobilise-t-il encore les fonds ? */
export function gelActif(statut: StatutLitige): boolean {
  return (STATUTS_GELANTS as readonly string[]).includes(statut);
}
