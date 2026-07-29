import { describe, expect, it } from "vitest";

import { appliquerBp, calculerDevis } from "./devis";

const BAREME_FR = {
  commissionLocataireBp: 1200, // 12 %
  commissionProprietaireBp: 800, // 8 %
};

describe("décomposition d'une réservation", () => {
  it("reproduit l'exemple du cadrage : benne, 4 jours à 35 €", () => {
    const devis = calculerDevis({
      prixJour: 3500,
      nombreJours: 4,
      primeAssurance: 1800,
      bareme: BAREME_FR,
    });

    expect(devis.loyer).toBe(14_000);
    expect(devis.fraisService).toBe(1_680);
    expect(devis.primeAssurance).toBe(1_800);
    expect(devis.totalLocataire).toBe(17_480);
    expect(devis.commissionProprietaire).toBe(1_120);
    expect(devis.montantReverse).toBe(12_880);
    expect(devis.revenuPlateforme).toBe(2_800);
  });

  it("applique la dégressivité avant les commissions", () => {
    const devis = calculerDevis({
      prixJour: 3500,
      nombreJours: 7,
      remiseBp: 1000, // 10 % à la semaine
      bareme: BAREME_FR,
    });

    expect(devis.remiseDegressivite).toBe(2_450);
    expect(devis.loyer).toBe(22_050);
    expect(devis.fraisService).toBe(appliquerBp(22_050, 1200));
  });

  it("ne facture ni frais de service ni commission sur l'assurance et la livraison", () => {
    const sansOptions = calculerDevis({
      prixJour: 3000,
      nombreJours: 2,
      bareme: BAREME_FR,
    });
    const avecOptions = calculerDevis({
      prixJour: 3000,
      nombreJours: 2,
      primeAssurance: 1500,
      fraisLivraison: 2000,
      bareme: BAREME_FR,
    });

    expect(avecOptions.fraisService).toBe(sansOptions.fraisService);
    expect(avecOptions.commissionProprietaire).toBe(
      sansOptions.commissionProprietaire,
    );
    // Les frais de livraison reviennent au propriétaire.
    expect(avecOptions.montantReverse).toBe(sansOptions.montantReverse + 2000);
  });

  it("fait supporter le geste commercial à la plateforme, pas au propriétaire", () => {
    const sansCode = calculerDevis({
      prixJour: 3000,
      nombreJours: 3,
      bareme: BAREME_FR,
    });
    const avecCode = calculerDevis({
      prixJour: 3000,
      nombreJours: 3,
      remiseCommerciale: 1000,
      bareme: BAREME_FR,
    });

    expect(avecCode.totalLocataire).toBe(sansCode.totalLocataire - 1000);
    expect(avecCode.montantReverse).toBe(sansCode.montantReverse);
    expect(avecCode.revenuPlateforme).toBe(sansCode.revenuPlateforme - 1000);
  });

  it("n'introduit jamais de fraction de centime", () => {
    for (let jours = 1; jours <= 30; jours += 1) {
      const devis = calculerDevis({
        prixJour: 2333,
        nombreJours: jours,
        remiseBp: 733,
        bareme: BAREME_FR,
      });

      for (const valeur of Object.values(devis)) {
        expect(Number.isInteger(valeur)).toBe(true);
      }
    }
  });

  it("rejette une durée ou un prix incohérents", () => {
    expect(() =>
      calculerDevis({ prixJour: 3000, nombreJours: 0, bareme: BAREME_FR }),
    ).toThrow();
    expect(() =>
      calculerDevis({ prixJour: -1, nombreJours: 2, bareme: BAREME_FR }),
    ).toThrow();
  });
});
