import { describe, expect, it } from "vitest";

import { effetsDecision } from "./decision";

/**
 * Ce que ces tests protègent : la direction et les bornes de l'argent.
 *
 * Une décision qui retiendrait sur la caution du locataire un litige qu'il a
 * lui-même ouvert, ou qui réduirait un reversement au-delà de ce qu'il
 * contient, ne serait pas un bogue d'affichage : ce serait de l'argent pris au
 * mauvais endroit.
 */

describe("effets d'une décision", () => {
  it("retient sur la caution quand le propriétaire a ouvert", () => {
    const effets = effetsDecision({
      ouvertPar: "proprietaire",
      montantAccorde: 9000,
      cautionRestante: 40000,
      reversementRestant: 12000,
    });

    expect(effets).toEqual({
      retenueCaution: 9000,
      reductionReversement: 0,
      remboursementLocataire: 0,
      resteARecouvrer: 0,
    });
  });

  it("réduit le reversement quand le locataire a ouvert", () => {
    const effets = effetsDecision({
      ouvertPar: "locataire",
      montantAccorde: 5000,
      cautionRestante: 40000,
      reversementRestant: 12000,
    });

    expect(effets).toEqual({
      retenueCaution: 0,
      reductionReversement: 5000,
      remboursementLocataire: 5000,
      resteARecouvrer: 0,
    });
  });

  it("rend au locataire exactement ce que la réduction retient", () => {
    // La réduction sans remboursement serait une confiscation : l'argent
    // retranché au propriétaire n'appartient pas à la plateforme.
    for (const accorde of [1, 4999, 12000, 40000]) {
      const effets = effetsDecision({
        ouvertPar: "locataire",
        montantAccorde: accorde,
        cautionRestante: 40000,
        reversementRestant: 12000,
      });

      expect(effets.remboursementLocataire).toBe(effets.reductionReversement);
    }

    // Et jamais l'inverse : le propriétaire gagnant n'ouvre aucun remboursement.
    expect(
      effetsDecision({
        ouvertPar: "proprietaire",
        montantAccorde: 9000,
        cautionRestante: 40000,
        reversementRestant: 12000,
      }).remboursementLocataire,
    ).toBe(0);
  });

  it("ne touche jamais la caution pour servir le locataire", () => {
    // La caution appartient au locataire : elle ne peut pas financer sa propre
    // indemnisation, même quand le reversement ne suffit pas.
    const effets = effetsDecision({
      ouvertPar: "locataire",
      montantAccorde: 20000,
      cautionRestante: 40000,
      reversementRestant: 12000,
    });

    expect(effets.retenueCaution).toBe(0);
    expect(effets.reductionReversement).toBe(12000);
    expect(effets.resteARecouvrer).toBe(8000);
  });

  it("plafonne la retenue à ce que la caution peut encore donner", () => {
    const effets = effetsDecision({
      ouvertPar: "proprietaire",
      montantAccorde: 50000,
      cautionRestante: 30000,
      reversementRestant: 0,
    });

    expect(effets.retenueCaution).toBe(30000);
    expect(effets.resteARecouvrer).toBe(20000);
  });

  it("ne produit aucun effet pour une décision à zéro — le débouté", () => {
    for (const ouvertPar of ["locataire", "proprietaire"] as const) {
      expect(
        effetsDecision({
          ouvertPar,
          montantAccorde: 0,
          cautionRestante: 40000,
          reversementRestant: 12000,
        }),
      ).toEqual({
        retenueCaution: 0,
        reductionReversement: 0,
        remboursementLocataire: 0,
        resteARecouvrer: 0,
      });
    }
  });

  it("tient un reversement déjà parti pour un gisement vide", () => {
    const effets = effetsDecision({
      ouvertPar: "locataire",
      montantAccorde: 5000,
      cautionRestante: 40000,
      reversementRestant: 0,
    });

    expect(effets.reductionReversement).toBe(0);
    expect(effets.resteARecouvrer).toBe(5000);
  });

  it("neutralise les entrées hostiles — négatifs et décimales", () => {
    const effets = effetsDecision({
      ouvertPar: "proprietaire",
      montantAccorde: -500,
      cautionRestante: -100,
      reversementRestant: -100,
    });

    expect(effets).toEqual({
      retenueCaution: 0,
      reductionReversement: 0,
      remboursementLocataire: 0,
      resteARecouvrer: 0,
    });

    // 90,5 centimes n'existent pas : la fraction est tronquée, jamais arrondie
    // vers le haut — on ne retient pas un centime de plus que décidé.
    expect(
      effetsDecision({
        ouvertPar: "proprietaire",
        montantAccorde: 9000.9,
        cautionRestante: 40000,
        reversementRestant: 0,
      }).retenueCaution,
    ).toBe(9000);
  });

  it("garantit l'invariant : effets plus reste égalent toujours l'accordé", () => {
    for (const ouvertPar of ["locataire", "proprietaire"] as const) {
      for (const accorde of [0, 1, 4999, 12000, 40000, 100000]) {
        const effets = effetsDecision({
          ouvertPar,
          montantAccorde: accorde,
          cautionRestante: 30000,
          reversementRestant: 12000,
        });

        expect(
          effets.retenueCaution + effets.reductionReversement + effets.resteARecouvrer,
        ).toBe(accorde);
      }
    }
  });
});
