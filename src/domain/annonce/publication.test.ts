import { describe, expect, it } from "vitest";

import {
  ETAPES,
  NOMBRE_ETAPES,
  PHOTOS_MINIMUM,
  etapeComplete,
  etapeDeRang,
  etapePrecedente,
  etapeSuivante,
  manquesDeLEtape,
  premiereEtapeIncomplete,
  pretePourPublication,
  rangDe,
  type EtatAnnonce,
} from "./publication";

/**
 * Ce que ces tests protègent : la promesse « on ne publie pas une coquille ».
 *
 * L'assistant peut être quitté à n'importe quelle étape et repris plus tard ;
 * rien n'empêche non plus quelqu'un d'appeler directement l'action de la
 * dernière étape. La seule garantie tient donc à ces règles, et non à l'ordre
 * dans lequel les écrans se sont enchaînés.
 */

const COMPLETE: EtatAnnonce = {
  categorieSlug: "benne",
  titre: "Benne basculante 750 kg",
  description:
    "Benne récente, bâche et sangles fournies, prise en main expliquée au départ.",
  villeSlug: "bruxelles",
  ptacKg: 750,
  poidsVideKg: 250,
  longueurUtileMm: 2000,
  largeurUtileMm: 1300,
  nombrePhotos: 4,
  adresseLigne1: "12 rue des Ateliers",
  codePostal: "1000",
  prixJour: 3500,
  caution: 40000,
};

const BORNES = { minimum: 20000, maximum: 150000 };

describe("parcours des étapes", () => {
  it("compte six étapes, du rang 1 au rang 6", () => {
    expect(NOMBRE_ETAPES).toBe(6);
    expect(rangDe(ETAPES[0])).toBe(1);
    expect(rangDe(ETAPES[5])).toBe(6);
    expect(etapeDeRang(3)).toBe(ETAPES[2]);
  });

  it("ramène à la première étape quand le rang est aberrant", () => {
    expect(etapeDeRang(0)).toBe("categorie");
    expect(etapeDeRang(99)).toBe("categorie");
  });

  it("n'a pas d'étape avant la première ni après la dernière", () => {
    expect(etapePrecedente("categorie")).toBeNull();
    expect(etapeSuivante("tarifs")).toBeNull();
    expect(etapeSuivante("categorie")).toBe("materiel");
    expect(etapePrecedente("tarifs")).toBe("retrait");
  });
});

describe("ce qui manque à chaque étape", () => {
  it("accepte un dossier complet de bout en bout", () => {
    for (const etape of ETAPES) {
      expect(manquesDeLEtape(etape, COMPLETE, BORNES)).toEqual([]);
    }
    expect(pretePourPublication(COMPLETE, BORNES)).toBe(true);
    expect(premiereEtapeIncomplete(COMPLETE, BORNES)).toBeNull();
  });

  it("refuse un titre trop court et une description indigente", () => {
    const etat = { ...COMPLETE, titre: "Ben", description: "Trop court." };
    expect(manquesDeLEtape("materiel", etat)).toEqual(["titre", "description"]);
  });

  it("refuse un poids à vide supérieur au poids total autorisé", () => {
    const etat = { ...COMPLETE, ptacKg: 750, poidsVideKg: 800 };
    expect(manquesDeLEtape("caracteristiques", etat)).toContain(
      "poidsVideSuperieur",
    );
  });

  it("exige un minimum de photos", () => {
    const etat = { ...COMPLETE, nombrePhotos: PHOTOS_MINIMUM - 1 };
    expect(manquesDeLEtape("photos", etat)).toEqual(["photos"]);
    expect(etapeComplete("photos", { ...COMPLETE, nombrePhotos: PHOTOS_MINIMUM }))
      .toBe(true);
  });

  it("encadre la caution par les bornes du pays, jamais par une valeur écrite ici", () => {
    const trop = { ...COMPLETE, caution: BORNES.maximum + 1 };
    expect(manquesDeLEtape("tarifs", trop, BORNES)).toEqual(["cautionHorsBornes"]);

    // Les mêmes centimes passent sous un plafond plus généreux : la règle vient
    // bien de la table `pays` et non du code.
    expect(
      manquesDeLEtape("tarifs", trop, { minimum: 0, maximum: 1_000_000 }),
    ).toEqual([]);
  });

  it("distingue une caution nulle d'une caution absente", () => {
    expect(manquesDeLEtape("tarifs", { ...COMPLETE, caution: 0 }, BORNES)).toEqual([
      "cautionHorsBornes",
    ]);
    expect(manquesDeLEtape("tarifs", { ...COMPLETE, caution: null })).toEqual([
      "caution",
    ]);
  });
});

describe("reprise d'un brouillon", () => {
  it("ramène à la première étape incomplète, et non au début", () => {
    const etat = { ...COMPLETE, nombrePhotos: 0 };
    expect(premiereEtapeIncomplete(etat, BORNES)).toBe("photos");
  });

  it("interdit la publication tant qu'une seule étape manque", () => {
    const etat = { ...COMPLETE, adresseLigne1: null };
    expect(pretePourPublication(etat, BORNES)).toBe(false);
  });
});
