import { describe, expect, it } from "vitest";

import {
  categorieSuffisante,
  conducteurReleve,
  manquesDuConducteur,
  type Conducteur,
} from "./conducteur";

/**
 * Ce que ces tests protègent : « on sait qui est parti avec la remorque ».
 *
 * La question s'est posée simplement : et si le locataire réserve pour
 * quelqu'un d'autre ? Toute la chaîne supposait que celui qui paie est celui
 * qui conduit. Le relevé au constat lève cette confusion — encore faut-il
 * qu'il exige les bonnes choses, et qu'il n'invente pas de refus.
 */

const titulaire: Conducteur = {
  qualite: "locataire",
  nom: "Élodie Vasseur",
  categories: ["BE"],
  permisPhotographie: false,
};

const tiers: Conducteur = {
  qualite: "tiers",
  nom: "Marc Delaunay",
  categories: ["BE"],
  permisPhotographie: true,
};

describe("relevé du conducteur", () => {
  it("accepte le titulaire du compte sans nouvelle photographie", () => {
    // Ses pièces sont déjà au dossier, contrôlées par un opérateur. Les
    // redemander à chaque retrait serait une formalité vide.
    expect(conducteurReleve(titulaire, "B")).toBe(true);
  });

  it("exige la photographie du permis pour un tiers", () => {
    // Sans image, il ne reste qu'un nom écrit à la main sur un parking.
    expect(
      manquesDuConducteur({ ...tiers, permisPhotographie: false }, "B"),
    ).toContain("permisNonPhotographie");
  });

  it("refuse un nom trop court pour désigner quelqu'un", () => {
    expect(manquesDuConducteur({ ...tiers, nom: "M" }, "B")).toContain(
      "nomManquant",
    );
  });

  it("refuse un relevé sans catégorie", () => {
    expect(manquesDuConducteur({ ...tiers, categories: [] }, "B")).toContain(
      "categorieManquante",
    );
  });

  it("ne réclame pas la catégorie deux fois", () => {
    // Une catégorie absente ne doit pas produire aussi « insuffisante » : deux
    // reproches pour un seul manque font chercher deux corrections.
    const manques = manquesDuConducteur({ ...tiers, categories: [] }, "BE");
    expect(manques).toEqual(["categorieManquante"]);
  });
});

describe("suffisance de la catégorie", () => {
  it("accepte une catégorie supérieure à celle qu'exige l'attelage", () => {
    // Le cas qui compte. Comparer les chaînes une à une refuserait un
    // titulaire du BE devant une remorque qui ne demande que le B — et le
    // propriétaire, devant ce refus incompréhensible, passerait outre.
    expect(categorieSuffisante(["BE"], "B")).toBe(true);
    expect(categorieSuffisante(["B96"], "B")).toBe(true);
  });

  it("refuse une catégorie insuffisante", () => {
    expect(categorieSuffisante(["B"], "BE")).toBe(false);
    expect(categorieSuffisante(["B96"], "BE")).toBe(false);
  });

  it("retient la plus haute quand plusieurs sont détenues", () => {
    expect(categorieSuffisante(["B", "BE"], "BE")).toBe(true);
  });

  it("signale l'insuffisance dans le relevé", () => {
    expect(
      manquesDuConducteur({ ...tiers, categories: ["B"] }, "BE"),
    ).toContain("categorieInsuffisante");
  });
});
