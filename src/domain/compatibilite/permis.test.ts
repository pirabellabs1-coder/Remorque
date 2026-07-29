import { describe, expect, it } from "vitest";

import {
  evaluerCompatibilite,
  permisRequis,
  type Materiel,
  type Vehicule,
} from "./permis";

/** Berline familiale courante. */
const BERLINE: Vehicule = {
  ptacKg: 2_000,
  tractableFreineKg: 1_500,
  tractableNonFreineKg: 750,
  typeAttelage: "boule",
  faisceauBroches: 13,
};

/** Gros SUV, proche du plafond du permis B une fois attelé. */
const SUV: Vehicule = {
  ptacKg: 2_800,
  tractableFreineKg: 3_000,
  tractableNonFreineKg: 750,
  typeAttelage: "boule",
  faisceauBroches: 13,
};

const BAGAGERE: Materiel = { ptacKg: 500, freinee: false, typeAttelage: "boule" };
const BENNE: Materiel = { ptacKg: 1_300, freinee: true, typeAttelage: "boule" };
const PORTE_VOITURE: Materiel = {
  ptacKg: 2_700,
  freinee: true,
  typeAttelage: "boule",
};

describe("permis requis", () => {
  it("laisse une remorque légère au permis B", () => {
    expect(permisRequis(BERLINE, BAGAGERE)).toBe("B");
    // Même avec un véhicule lourd, une remorque de moins de 750 kg reste en B.
    expect(permisRequis(SUV, BAGAGERE)).toBe("B");
  });

  it("reste en B tant que la somme des PTAC ne dépasse pas 3 500 kg", () => {
    expect(permisRequis(BERLINE, BENNE)).toBe("B");
  });

  it("bascule en B96 entre 3 500 et 4 250 kg", () => {
    expect(permisRequis(SUV, BENNE)).toBe("B96");
  });

  it("bascule en BE au-delà de 4 250 kg", () => {
    expect(permisRequis(SUV, PORTE_VOITURE)).toBe("BE");
  });

  it("sort du périmètre au-delà des masses d'un permis de tourisme", () => {
    const poidsLourd: Vehicule = {
      ptacKg: 3_500,
      tractableFreineKg: 3_500,
      tractableNonFreineKg: 750,
    };
    const remorqueLourde: Materiel = { ptacKg: 3_600, freinee: true };

    expect(permisRequis(poidsLourd, remorqueLourde)).toBeNull();
  });
});

describe("compatibilité complète", () => {
  it("valide le cas nominal", () => {
    const verdict = evaluerCompatibilite(BERLINE, BENNE, ["B"]);

    expect(verdict.compatible).toBe(true);
    expect(verdict.motifs).toEqual([]);
  });

  it("refuse quand le permis détenu est insuffisant", () => {
    const verdict = evaluerCompatibilite(SUV, PORTE_VOITURE, ["B"]);

    expect(verdict.legale).toBe(false);
    expect(verdict.compatible).toBe(false);
    expect(verdict.motifs[0]).toContain("BE");
  });

  it("accepte un permis supérieur à celui requis", () => {
    const verdict = evaluerCompatibilite(SUV, BENNE, ["BE"]);

    expect(verdict.legale).toBe(true);
  });

  it("refuse quand la capacité de traction est dépassée, permis valable ou non", () => {
    const verdict = evaluerCompatibilite(BERLINE, PORTE_VOITURE, ["BE"]);

    expect(verdict.legale).toBe(true);
    expect(verdict.physique).toBe(false);
    expect(verdict.compatible).toBe(false);
    expect(verdict.motifs.join(" ")).toContain("1500 kg");
  });

  it("exige le freinage au-delà de 750 kg", () => {
    const nonFreinee: Materiel = { ptacKg: 900, freinee: false };
    const verdict = evaluerCompatibilite(BERLINE, nonFreinee, ["B"]);

    expect(verdict.physique).toBe(false);
    expect(verdict.motifs.join(" ")).toContain("freinée");
  });

  it("bloque un attelage incompatible sans adaptateur, l'accepte avec", () => {
    const colDeCygne: Materiel = {
      ptacKg: 1_000,
      freinee: true,
      typeAttelage: "col-de-cygne",
    };

    expect(evaluerCompatibilite(BERLINE, colDeCygne, ["B"]).physique).toBe(
      false,
    );
    expect(
      evaluerCompatibilite(
        BERLINE,
        { ...colDeCygne, adaptateurFourni: true },
        ["B"],
      ).physique,
    ).toBe(true);
  });

  it("signale un faisceau différent sans bloquer la location", () => {
    const sept: Materiel = {
      ptacKg: 600,
      freinee: false,
      typeAttelage: "boule",
      faisceauBroches: 7,
    };
    const verdict = evaluerCompatibilite(BERLINE, sept, ["B"]);

    expect(verdict.compatible).toBe(true);
    expect(verdict.avertissements).toHaveLength(1);
  });
});
