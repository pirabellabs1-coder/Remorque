import { describe, expect, it } from "vitest";

import { composerReglement, montantAprelever } from "./montants";

/**
 * Ce que ces tests protègent : le montant prélevé.
 *
 * C'est le seul endroit du projet où une erreur se traduit directement en
 * argent débité à tort. Le total a été figé à la réservation ; si les lignes
 * affichées ne s'y additionnent pas, quelque chose a divergé — et le seul
 * geste sûr est de ne rien encaisser.
 */

const BASE = {
  loyer: 7000,
  fraisService: 840,
  primeAssurance: 0,
  fraisLivraison: 0,
  remise: 0,
  totalLocataire: 7840,
  devise: "EUR",
};

describe("composition d'un règlement", () => {
  it("compose les lignes et retrouve exactement le total figé", () => {
    const reglement = composerReglement(BASE);

    expect(reglement.ok).toBe(true);
    if (!reglement.ok) return;

    expect(reglement.total).toBe(7840);
    expect(reglement.devise).toBe("EUR");
    expect(reglement.lignes.map((ligne) => ligne.cle)).toEqual([
      "loyer",
      "fraisService",
    ]);
  });

  it("n'affiche pas les lignes nulles", () => {
    const reglement = composerReglement(BASE);
    if (!reglement.ok) return;

    // Une ligne « assurance : 0,00 € » fait chercher ce qu'on a payé pour rien.
    expect(reglement.lignes.every((ligne) => ligne.montant !== 0)).toBe(true);
  });

  it("porte la remise en négatif, pour que la somme se lise", () => {
    const reglement = composerReglement({
      ...BASE,
      remise: 1000,
      totalLocataire: 6840,
    });

    expect(reglement.ok).toBe(true);
    if (!reglement.ok) return;

    const remise = reglement.lignes.find((ligne) => ligne.cle === "remise");
    expect(remise?.montant).toBe(-1000);
    expect(reglement.total).toBe(6840);
  });

  it("refuse d'encaisser quand les lignes ne font pas le total", () => {
    // Un frais ajouté sans mise à jour du total : le cas exact qui ferait
    // débiter le locataire d'un montant qu'il n'a pas accepté.
    const reglement = composerReglement({ ...BASE, fraisLivraison: 500 });

    expect(reglement.ok).toBe(false);
    if (reglement.ok) return;
    expect(reglement.motif).toBe("totalIncoherent");
  });

  it("refuse un total nul ou négatif", () => {
    const reglement = composerReglement({
      ...BASE,
      loyer: 0,
      fraisService: 0,
      totalLocataire: 0,
    });

    expect(reglement.ok).toBe(false);
    if (reglement.ok) return;
    expect(reglement.motif).toBe("totalNul");
  });

  it("ne rend aucun montant à prélever quand le règlement est refusé", () => {
    // `montantAprelever` est le raccourci de l'appelant pressé : il doit
    // hériter du refus, sinon la vérification ne servirait à rien.
    expect(montantAprelever({ ...BASE, fraisLivraison: 500 })).toBeNull();
    expect(montantAprelever(BASE)).toBe(7840);
  });

  it("n'emploie que des entiers de centimes", () => {
    const reglement = composerReglement({
      ...BASE,
      loyer: 3333,
      fraisService: 401,
      totalLocataire: 3734,
    });

    expect(reglement.ok).toBe(true);
    if (!reglement.ok) return;

    // Aucune division nulle part : un centime perdu en arrondi se retrouve
    // au rapprochement bancaire, jamais avant.
    for (const ligne of reglement.lignes) {
      expect(Number.isInteger(ligne.montant)).toBe(true);
    }
    expect(Number.isInteger(reglement.total)).toBe(true);
  });
});
