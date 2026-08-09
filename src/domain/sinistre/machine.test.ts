import { describe, expect, it } from "vitest";

import {
  evaluerSinistre,
  gelActifSinistre,
  STATUTS_SINISTRE,
  type StatutSinistre,
} from "./machine";

/**
 * Ce que ces tests protègent : la frontière entre déclarer et décider.
 *
 * Les parties déclarent, la plateforme transmet, l'assureur conclut. Une
 * machine qui laisserait une partie transmettre son propre dossier, ou clore
 * un sinistre sans montant ni motif, ferait de l'assurance un guichet
 * d'auto-service — et du gel des fonds une passoire.
 */

describe("machine du sinistre", () => {
  it("suit le chemin nominal : déclaré → transmis → en cours → indemnisé", () => {
    const transmission = evaluerSinistre("transmettre", {
      statut: "declare",
      acteur: "administrateur",
      referenceAssureur: "AXA-2026-88412",
    });
    expect(transmission).toEqual({ autorise: true, statutSuivant: "transmis" });

    const instruction = evaluerSinistre("instruire", {
      statut: "transmis",
      acteur: "administrateur",
    });
    expect(instruction).toEqual({ autorise: true, statutSuivant: "en_cours" });

    const indemnisation = evaluerSinistre("indemniser", {
      statut: "en_cours",
      acteur: "administrateur",
      montantIndemnise: 68000,
    });
    expect(indemnisation).toEqual({ autorise: true, statutSuivant: "indemnise" });
  });

  it("refuse chaque action aux parties — elles déclarent, elles n'instruisent pas", () => {
    for (const acteur of ["locataire", "proprietaire"] as const) {
      for (const [evenement, statut] of [
        ["transmettre", "declare"],
        ["instruire", "transmis"],
        ["indemniser", "en_cours"],
        ["refuser", "declare"],
      ] as const) {
        const verdict = evaluerSinistre(evenement, {
          statut,
          acteur,
          referenceAssureur: "X",
          montantIndemnise: 100,
          motifRefus: "motif",
        });
        expect(verdict.autorise).toBe(false);
      }
    }
  });

  it("exige la référence de l'assureur pour transmettre", () => {
    for (const referenceAssureur of [undefined, "", "   "]) {
      const verdict = evaluerSinistre("transmettre", {
        statut: "declare",
        acteur: "administrateur",
        referenceAssureur,
      });
      expect(verdict.autorise).toBe(false);
    }
  });

  it("exige un montant entier positif pour indemniser", () => {
    for (const montantIndemnise of [undefined, 0, -500, 90.5]) {
      const verdict = evaluerSinistre("indemniser", {
        statut: "transmis",
        acteur: "administrateur",
        montantIndemnise,
      });
      expect(verdict.autorise).toBe(false);
    }
  });

  it("exige un motif pour refuser — le refus sera opposé au déclarant", () => {
    const verdict = evaluerSinistre("refuser", {
      statut: "transmis",
      acteur: "administrateur",
    });
    expect(verdict.autorise).toBe(false);
  });

  it("interdit de rouvrir un dossier clos", () => {
    for (const statut of ["indemnise", "refuse"] as const) {
      for (const evenement of [
        "transmettre",
        "instruire",
        "indemniser",
        "refuser",
      ] as const) {
        const verdict = evaluerSinistre(evenement, {
          statut,
          acteur: "administrateur",
          referenceAssureur: "X",
          montantIndemnise: 100,
          motifRefus: "motif",
        });
        expect(verdict.autorise).toBe(false);
      }
    }
  });

  it("gèle tant que le dossier vit, libère quand il est clos", () => {
    const attendu: Record<StatutSinistre, boolean> = {
      declare: true,
      transmis: true,
      en_cours: true,
      indemnise: false,
      refuse: false,
    };

    for (const statut of STATUTS_SINISTRE) {
      expect(gelActifSinistre(statut)).toBe(attendu[statut]);
    }
  });
});
