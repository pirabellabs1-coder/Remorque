import { describe, expect, it } from "vitest";

import { simulerRevenus } from "./simulation";

const BAREME = { commissionProprietaireBp: 800 };

describe("simulateur de revenus propriétaire", () => {
  it("retranche la commission du loyer encaissé", () => {
    const resultat = simulerRevenus({
      prixJour: 3_500,
      joursParMois: 6,
      bareme: BAREME,
    });

    expect(resultat.loyerMensuel).toBe(21_000);
    expect(resultat.commissionMensuelle).toBe(1_680);
    expect(resultat.netMensuel).toBe(19_320);
    expect(resultat.netAnnuel).toBe(231_840);
  });

  it("renvoie zéro sans location", () => {
    const resultat = simulerRevenus({
      prixJour: 3_500,
      joursParMois: 0,
      bareme: BAREME,
    });

    expect(resultat.netMensuel).toBe(0);
    expect(resultat.netAnnuel).toBe(0);
  });

  it("n'introduit jamais de fraction de centime", () => {
    for (let jours = 0; jours <= 31; jours += 1) {
      const resultat = simulerRevenus({
        prixJour: 2_733,
        joursParMois: jours,
        bareme: BAREME,
      });

      for (const valeur of Object.values(resultat)) {
        expect(Number.isInteger(valeur)).toBe(true);
      }
    }
  });

  it("rejette des entrées incohérentes", () => {
    expect(() =>
      simulerRevenus({ prixJour: -1, joursParMois: 5, bareme: BAREME }),
    ).toThrow();
    expect(() =>
      simulerRevenus({ prixJour: 3_000, joursParMois: 32, bareme: BAREME }),
    ).toThrow();
  });
});
