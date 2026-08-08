/**
 * Composition d'un reçu de location.
 *
 * Module pur. Ce qu'il tranche est une question fiscale, non une question de
 * présentation : **sur une place de marché entre particuliers, le loyer et la
 * commission ne suivent pas le même régime.** Le loyer est perçu par un
 * particulier qui ne facture pas de TVA ; les frais de service sont la
 * rémunération de la plateforme, et celle-ci en collecte.
 *
 * Confondre les deux — appliquer le taux au total — ferait déclarer une taxe
 * sur des sommes qui n'en portent pas. C'est le genre d'erreur qui ne se voit
 * pas à l'écran et se découvre au contrôle.
 *
 * Le taux vient de la table `pays` (règle 2), en points de base : 2000 = 20 %.
 */

export type MontantsFacture = {
  /** Perçu par le propriétaire, hors champ de la TVA de la plateforme. */
  loyer: number;
  /** Rémunération de la plateforme, toutes taxes comprises. */
  fraisService: number;
  /** Total effectivement réglé, en centimes. */
  totalLocataire: number;
  /** Taux applicable aux frais de service, en points de base. */
  tvaCommissionBp: number;
  devise: string;
};

export type Facture = {
  /** Base hors taxe : le loyer, plus les frais de service hors taxe. */
  montantHt: number;
  montantTva: number;
  montantTtc: number;
  tauxTvaBp: number;
  devise: string;
  lignes: readonly {
    cle: "loyer" | "fraisService";
    montantTtc: number;
    /** Nul sur le loyer : un particulier ne facture pas de TVA. */
    montantTva: number;
  }[];
};

/**
 * Part de taxe contenue dans un montant toutes taxes comprises.
 *
 * L'arrondi est au centime le plus proche et se fait **une seule fois**,
 * sur le montant taxable. Extraire ligne à ligne puis sommer ferait dériver
 * le total d'un centime dès qu'il y a plusieurs lignes taxables — un écart
 * minuscule qui suffit à faire échouer un rapprochement comptable.
 */
export function tvaIncluse(montantTtc: number, tauxBp: number): number {
  if (tauxBp <= 0 || montantTtc <= 0) return 0;
  return Math.round((montantTtc * tauxBp) / (10_000 + tauxBp));
}

export function composerFacture(montants: MontantsFacture): Facture | null {
  // Le total figé fait foi : s'il ne correspond pas à ses composantes, la
  // facture décrirait autre chose que ce qui a été débité.
  if (montants.loyer + montants.fraisService !== montants.totalLocataire) {
    return null;
  }

  const tva = tvaIncluse(montants.fraisService, montants.tvaCommissionBp);

  const lignes = [
    { cle: "loyer" as const, montantTtc: montants.loyer, montantTva: 0 },
    {
      cle: "fraisService" as const,
      montantTtc: montants.fraisService,
      montantTva: tva,
    },
  ].filter((ligne) => ligne.montantTtc !== 0);

  return {
    montantHt: montants.totalLocataire - tva,
    montantTva: tva,
    montantTtc: montants.totalLocataire,
    tauxTvaBp: montants.tvaCommissionBp,
    devise: montants.devise,
    lignes,
  };
}
