import { describe, expect, it } from "vitest";

import { remboursementAnnulation } from "./annulation";

/**
 * Ce que ces tests protègent : la parole donnée dans les conditions générales.
 *
 * Le barème n'est pas un choix d'implémentation, c'est un contrat affiché sur
 * chaque annonce avant réservation. Un remboursement plus faible que promis
 * est une rétention indue ; plus fort, un cadeau que le propriétaire paie
 * sans l'avoir accepté.
 */

const MONTANTS = {
  loyer: 12000,
  remise: 0,
  fraisService: 1440,
  primeAssurance: 900,
  fraisLivraison: 600,
};

describe("barème d'annulation — le locataire se dédit", () => {
  it("souple : intégral jusqu'à 24 h, rien ensuite", () => {
    const avant = remboursementAnnulation({
      politique: "souple",
      annulePar: "locataire",
      heuresAvantDebut: 25,
      ...MONTANTS,
    });
    expect(avant.loyer).toBe(12000);
    expect(avant.fraisService).toBe(0);
    expect(avant.prestations).toBe(1500);
    expect(avant.total).toBe(13500);
    expect(avant.loyerConserve).toBe(0);

    const apres = remboursementAnnulation({
      politique: "souple",
      annulePar: "locataire",
      heuresAvantDebut: 23,
      ...MONTANTS,
    });
    expect(apres.loyer).toBe(0);
    expect(apres.loyerConserve).toBe(12000);
    // Les prestations jamais consommées reviennent même à la dernière heure.
    expect(apres.total).toBe(1500);
  });

  it("modérée : intégral jusqu'à 3 jours, puis de moitié — y compris tard", () => {
    expect(
      remboursementAnnulation({
        politique: "moderee",
        annulePar: "locataire",
        heuresAvantDebut: 72,
        ...MONTANTS,
      }).loyer,
    ).toBe(12000);

    for (const heures of [71, 2, 0, -5]) {
      const tard = remboursementAnnulation({
        politique: "moderee",
        annulePar: "locataire",
        heuresAvantDebut: heures,
        ...MONTANTS,
      });
      expect(tard.loyer).toBe(6000);
      expect(tard.loyerConserve).toBe(6000);
    }
  });

  it("stricte : de moitié jusqu'à 7 jours, rien ensuite", () => {
    expect(
      remboursementAnnulation({
        politique: "stricte",
        annulePar: "locataire",
        heuresAvantDebut: 200,
        ...MONTANTS,
      }).loyer,
    ).toBe(6000);

    expect(
      remboursementAnnulation({
        politique: "stricte",
        annulePar: "locataire",
        heuresAvantDebut: 167,
        ...MONTANTS,
      }).loyer,
    ).toBe(0);
  });

  it("calcule sur le loyer net de remise — on ne rembourse pas un rabais", () => {
    const effets = remboursementAnnulation({
      politique: "souple",
      annulePar: "locataire",
      heuresAvantDebut: 100,
      ...MONTANTS,
      remise: 2000,
    });
    expect(effets.loyer).toBe(10000);
  });
});

describe("barème d'annulation — les autres acteurs", () => {
  it("le propriétaire qui annule rend tout, quel que soit le délai", () => {
    const effets = remboursementAnnulation({
      politique: "stricte",
      annulePar: "proprietaire",
      heuresAvantDebut: 1,
      ...MONTANTS,
    });
    expect(effets.loyer).toBe(12000);
    expect(effets.fraisService).toBe(1440);
    expect(effets.prestations).toBe(1500);
    expect(effets.total).toBe(14940);
    expect(effets.loyerConserve).toBe(0);
  });

  it("la plateforme qui annule rend tout — elle n'annule qu'à bon droit", () => {
    expect(
      remboursementAnnulation({
        politique: "stricte",
        annulePar: "administrateur",
        heuresAvantDebut: 0,
        ...MONTANTS,
      }).total,
    ).toBe(14940);
  });

  it("le système n'annule qu'un paiement jamais abouti : rien à rendre", () => {
    expect(
      remboursementAnnulation({
        politique: "souple",
        annulePar: "systeme",
        heuresAvantDebut: 500,
        ...MONTANTS,
      }).total,
    ).toBe(0);
  });
});

describe("bornes et invariants", () => {
  it("ne rend jamais plus que ce qui a été payé, jamais moins que zéro", () => {
    for (const politique of ["souple", "moderee", "stricte"] as const) {
      for (const annulePar of ["locataire", "proprietaire", "systeme"] as const) {
        for (const heures of [-48, 0, 24, 72, 168, 5000]) {
          const effets = remboursementAnnulation({
            politique,
            annulePar,
            heuresAvantDebut: heures,
            ...MONTANTS,
          });

          const paye =
            MONTANTS.loyer + MONTANTS.fraisService + MONTANTS.primeAssurance + MONTANTS.fraisLivraison;
          expect(effets.total).toBeGreaterThanOrEqual(0);
          expect(effets.total).toBeLessThanOrEqual(paye);
          // Le loyer se partage sans perte : rendu plus conservé font le net.
          expect(effets.loyer + effets.loyerConserve).toBe(MONTANTS.loyer);
        }
      }
    }
  });

  it("neutralise les entrées hostiles — négatifs et décimales", () => {
    const effets = remboursementAnnulation({
      politique: "moderee",
      annulePar: "locataire",
      heuresAvantDebut: 100,
      loyer: -500,
      remise: -100,
      fraisService: -50,
      primeAssurance: 90.9,
      fraisLivraison: -1,
    });
    expect(effets.loyer).toBe(0);
    expect(effets.fraisService).toBe(0);
    expect(effets.prestations).toBe(90);
    expect(effets.total).toBe(90);
  });

  it("arrondit la moitié au centime le plus proche, sans en créer", () => {
    const effets = remboursementAnnulation({
      politique: "stricte",
      annulePar: "locataire",
      heuresAvantDebut: 200,
      loyer: 10001,
      remise: 0,
      fraisService: 0,
      primeAssurance: 0,
      fraisLivraison: 0,
    });
    expect(Number.isInteger(effets.loyer)).toBe(true);
    expect(effets.loyer + effets.loyerConserve).toBe(10001);
  });
});
