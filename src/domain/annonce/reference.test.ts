import { describe, expect, it } from "vitest";

import {
  debutIdentifiantDepuisReference,
  referenceAnnonce,
} from "./reference";

/**
 * Ce que ces tests protègent : « la référence ne change jamais, et l'on peut
 * revenir de la référence à l'annonce ».
 *
 * La première promesse est engagée dès qu'une référence est imprimée sur un
 * autocollant, collée sur un timon ou citée dans un constat. La seconde est ce
 * qui rend le choix d'une valeur dérivée tenable : le jour où l'assistance
 * doit retrouver une annonce sur référence, rien de ce qui est déjà affiché
 * n'a besoin de changer.
 */

const IDENTIFIANT = "3f7a91c2-4b8e-4d1a-9f60-2c5b7e0d8a13";

describe("référence publique", () => {
  it("rend une forme courte, lisible et préfixée", () => {
    expect(referenceAnnonce(IDENTIFIANT)).toBe("FT-3F7A-91C2");
  });

  it("ne dépend que de l'identifiant, donc ne bouge jamais", () => {
    expect(referenceAnnonce(IDENTIFIANT)).toBe(referenceAnnonce(IDENTIFIANT));
  });

  it("accepte un identifiant déjà sans tirets", () => {
    expect(referenceAnnonce(IDENTIFIANT.replace(/-/g, ""))).toBe("FT-3F7A-91C2");
  });

  it("refuse un identifiant trop court plutôt que d'inventer une référence", () => {
    expect(() => referenceAnnonce("3f7a")).toThrow();
  });
});

describe("retour de la référence à l'annonce", () => {
  it("retrouve le début de l'identifiant", () => {
    expect(debutIdentifiantDepuisReference("FT-3F7A-91C2")).toBe("3f7a91c2");
  });

  it("pardonne la casse, les espaces et les tirets manquants", () => {
    // Une référence est dictée au téléphone puis recopiée : elle arrive
    // rarement telle qu'elle a été affichée.
    for (const saisie of [
      "ft-3f7a-91c2",
      "FT3F7A91C2",
      "  FT-3F7A-91C2  ",
      "ft 3f7a 91c2",
    ]) {
      expect(debutIdentifiantDepuisReference(saisie)).toBe("3f7a91c2");
    }
  });

  it("rend null pour ce qui n'est pas une référence", () => {
    for (const saisie of ["", "FT-3F7A", "XX-3F7A-91C2", "FT-3F7A-91CZ"]) {
      expect(debutIdentifiantDepuisReference(saisie)).toBeNull();
    }
  });

  it("boucle : référence puis retour donnent le début de l'identifiant", () => {
    const reference = referenceAnnonce(IDENTIFIANT);
    expect(debutIdentifiantDepuisReference(reference)).toBe(
      IDENTIFIANT.replace(/-/g, "").slice(0, 8),
    );
  });
});
