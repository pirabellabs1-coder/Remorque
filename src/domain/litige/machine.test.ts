import { describe, expect, it } from "vitest";

import {
  evaluerLitige,
  gelActif,
  STATUTS_LITIGE,
  TRANSITIONS_LITIGE,
  type EvenementLitige,
} from "./machine";

/**
 * Ce que ces tests protègent : qu'un litige ne se règle jamais tout seul, et
 * jamais en faveur de celui qui appuie sur le bouton.
 */

describe("machine du litige", () => {
  it("n'arbitre que par la plateforme", () => {
    // Une partie qui tranche son propre litige n'arbitre pas : elle se sert.
    for (const acteur of ["locataire", "proprietaire"] as const) {
      const verdict = evaluerLitige("trancher", {
        statut: "en_arbitrage",
        acteur,
        decisionMotif: "Dommage constaté",
        montantAccorde: 5000,
        montantReclame: 10000,
      });

      expect(verdict.autorise).toBe(false);
    }

    expect(
      evaluerLitige("trancher", {
        statut: "en_arbitrage",
        acteur: "administrateur",
        decisionMotif: "Dommage constaté au constat de retour",
        montantAccorde: 5000,
        montantReclame: 10000,
      }).autorise,
    ).toBe(true);
  });

  it("refuse une décision sans motif", () => {
    const verdict = evaluerLitige("trancher", {
      statut: "en_arbitrage",
      acteur: "administrateur",
      decisionMotif: "   ",
      montantAccorde: 5000,
      montantReclame: 10000,
    });

    expect(verdict.autorise).toBe(false);
  });

  it("n'accorde jamais plus que ce qui est réclamé", () => {
    const verdict = evaluerLitige("trancher", {
      statut: "en_arbitrage",
      acteur: "administrateur",
      decisionMotif: "Dommage constaté",
      montantAccorde: 15000,
      montantReclame: 10000,
    });

    expect(verdict.autorise).toBe(false);
    if (verdict.autorise) return;
    expect(verdict.motif).toContain("excéder");
  });

  it("accepte un arbitrage à zéro — le demandeur peut être débouté", () => {
    const verdict = evaluerLitige("trancher", {
      statut: "en_arbitrage",
      acteur: "administrateur",
      decisionMotif: "Aucun dommage imputable au locataire",
      montantAccorde: 0,
      montantReclame: 10000,
    });

    expect(verdict.autorise).toBe(true);
  });

  it("ne rouvre jamais un litige résolu", () => {
    const evenements = Object.keys(TRANSITIONS_LITIGE) as EvenementLitige[];

    for (const statut of ["resolu", "clos_sans_suite"] as const) {
      for (const evenement of evenements) {
        expect(
          evaluerLitige(evenement, { statut, acteur: "administrateur" }).autorise,
        ).toBe(false);
      }
    }
  });

  it("gèle les fonds tant que le dossier n'est pas clos", () => {
    // C'est la règle 6, énoncée une fois et lue partout : la caution et le
    // reversement interrogent cette fonction, pas leur propre liste.
    for (const statut of STATUTS_LITIGE) {
      const clos = statut === "resolu" || statut === "clos_sans_suite";
      expect(gelActif(statut)).toBe(!clos);
    }
  });

  it("laisse le demandeur retirer sa réclamation, mais pas la trancher", () => {
    expect(
      evaluerLitige("retirer", { statut: "ouvert", acteur: "locataire" }).autorise,
    ).toBe(true);

    // Retirer après escalade n'est plus possible : l'instruction est engagée.
    expect(
      evaluerLitige("retirer", { statut: "en_arbitrage", acteur: "locataire" })
        .autorise,
    ).toBe(false);
  });
});
