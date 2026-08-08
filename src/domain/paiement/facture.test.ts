import { describe, expect, it } from "vitest";

import { composerFacture, tvaIncluse } from "./facture";

/**
 * Ce que ces tests protègent : le montant de taxe déclaré.
 *
 * Une erreur ici ne se voit pas à l'écran — le total réglé reste juste — et se
 * découvre au contrôle fiscal ou au rapprochement comptable.
 */

const BASE = {
  loyer: 7000,
  fraisService: 840,
  totalLocataire: 7840,
  tvaCommissionBp: 2000,
  devise: "EUR",
};

describe("extraction de la taxe", () => {
  it("retrouve la taxe contenue dans un montant toutes taxes comprises", () => {
    // 840 centimes à 20 % : 700 hors taxe, 140 de taxe.
    expect(tvaIncluse(840, 2000)).toBe(140);
  });

  it("rend zéro quand le taux ou le montant est nul", () => {
    expect(tvaIncluse(840, 0)).toBe(0);
    expect(tvaIncluse(0, 2000)).toBe(0);
  });

  it("arrondit au centime le plus proche", () => {
    // 999 × 2000 / 12000 = 166,5 → 167 (arrondi au plus proche, pas tronqué).
    expect(tvaIncluse(999, 2000)).toBe(167);
  });
});

describe("composition d'une facture", () => {
  it("ne taxe que les frais de service, jamais le loyer", () => {
    const facture = composerFacture(BASE);
    expect(facture).not.toBeNull();
    if (!facture) return;

    // Le point central : le loyer est perçu par un particulier, il ne porte
    // aucune taxe de la plateforme.
    const loyer = facture.lignes.find((ligne) => ligne.cle === "loyer");
    expect(loyer?.montantTva).toBe(0);

    expect(facture.montantTva).toBe(140);
    expect(facture.montantHt).toBe(7700);
    expect(facture.montantTtc).toBe(7840);
  });

  it("fait toujours somme : hors taxe plus taxe égale toutes taxes comprises", () => {
    for (const frais of [0, 1, 840, 999, 12_345]) {
      const facture = composerFacture({
        ...BASE,
        fraisService: frais,
        totalLocataire: BASE.loyer + frais,
      });
      if (!facture) continue;

      expect(facture.montantHt + facture.montantTva).toBe(facture.montantTtc);
    }
  });

  it("n'appliquerait pas le taux au total — l'erreur qui coûte cher", () => {
    const facture = composerFacture(BASE);
    if (!facture) return;

    // Le taux appliqué au total donnerait 1 307 centimes de taxe au lieu de
    // 140 : presque dix fois trop, déclarés sur des sommes qui n'en portent pas.
    expect(facture.montantTva).not.toBe(tvaIncluse(BASE.totalLocataire, 2000));
    expect(facture.montantTva).toBeLessThan(BASE.fraisService);
  });

  it("refuse une facture dont les composantes ne font pas le total", () => {
    expect(
      composerFacture({ ...BASE, totalLocataire: 9999 }),
    ).toBeNull();
  });

  it("n'emploie que des entiers de centimes", () => {
    const facture = composerFacture({
      ...BASE,
      fraisService: 833,
      totalLocataire: 7833,
    });
    if (!facture) return;

    expect(Number.isInteger(facture.montantHt)).toBe(true);
    expect(Number.isInteger(facture.montantTva)).toBe(true);
    expect(Number.isInteger(facture.montantTtc)).toBe(true);
  });
});
