/**
 * Effets financiers d'une décision d'arbitrage.
 *
 * Module pur : il calcule qui doit quoi, sans savoir l'écrire. C'est la pièce
 * qui manquait entre « le litige est tranché » et « l'argent suit » — la
 * décision inscrivait un montant accordé, et rien n'en découlait.
 *
 * La direction de l'argent découle de qui a ouvert le dossier :
 *
 *  - **Le propriétaire réclame** (dommage, retard) : le montant accordé se
 *    retient sur la caution du locataire. C'est exactement ce que l'empreinte
 *    existe pour garantir.
 *  - **Le locataire réclame** (non-conformité, annulation, montant) : le
 *    montant accordé se retranche du reversement au propriétaire — la
 *    plateforme encaisse d'abord et reverse ensuite précisément pour garder ce
 *    levier — et **revient au locataire** en remboursement. Si le reversement
 *    est déjà parti ou insuffisant, le reste est un recouvrement, et le dire
 *    est le seul comportement honnête.
 *
 * Tous les montants sont des entiers de centimes (règle 1). Aucun effet ne
 * dépasse jamais ce qui reste disponible : on ne retient pas au-delà d'une
 * caution, on ne réduit pas un reversement sous zéro.
 */

export type EffetsDecision = {
  /** À retenir sur la caution du locataire, en centimes. */
  retenueCaution: number;
  /** À retrancher du reversement au propriétaire, en centimes. */
  reductionReversement: number;
  /**
   * À rembourser au locataire, en centimes. C'est la destination de ce que la
   * réduction retient : l'argent retranché au propriétaire ne reste pas dans
   * les caisses de la plateforme, il retourne à celui qui a eu gain de cause.
   * Sans ce champ, la réduction serait une confiscation.
   */
  remboursementLocataire: number;
  /**
   * Part accordée qu'aucun des deux gisements ne couvre. Elle devra être
   * recouvrée autrement — et surtout ne pas être passée sous silence.
   */
  resteARecouvrer: number;
};

export function effetsDecision(entree: {
  /** Rôle de celui qui a ouvert le litige — c'est lui que la décision sert. */
  ouvertPar: "locataire" | "proprietaire";
  /** Montant accordé par l'arbitre, en centimes. */
  montantAccorde: number;
  /** Ce que la caution peut encore donner : montant moins déjà débité. */
  cautionRestante: number;
  /** Ce que le reversement peut encore rendre : nul s'il est déjà parti. */
  reversementRestant: number;
}): EffetsDecision {
  const accorde = Math.max(0, Math.floor(entree.montantAccorde));

  if (accorde === 0) {
    return {
      retenueCaution: 0,
      reductionReversement: 0,
      remboursementLocataire: 0,
      resteARecouvrer: 0,
    };
  }

  if (entree.ouvertPar === "proprietaire") {
    const retenue = Math.min(accorde, Math.max(0, entree.cautionRestante));
    return {
      retenueCaution: retenue,
      reductionReversement: 0,
      remboursementLocataire: 0,
      resteARecouvrer: accorde - retenue,
    };
  }

  const reduction = Math.min(accorde, Math.max(0, entree.reversementRestant));
  return {
    retenueCaution: 0,
    reductionReversement: reduction,
    remboursementLocataire: reduction,
    resteARecouvrer: accorde - reduction,
  };
}
