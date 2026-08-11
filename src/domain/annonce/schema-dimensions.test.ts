import { describe, expect, it } from "vitest";

import {
  positionsRoues,
  vueDeCote,
  vueDeDessus,
  type Dimensions,
} from "./schema-dimensions";

/**
 * Ce que ces tests protègent : « le schéma dit la vérité de l'annonce ».
 *
 * Un dessin coté est cru sur parole — bien davantage qu'une liste de chiffres.
 * S'il déforme les proportions, il trompe plus efficacement que ne le ferait
 * une faute de frappe dans les caractéristiques.
 */

const PLATEAU: Dimensions = {
  longueurMm: 3000,
  largeurMm: 1500,
  hauteurMm: null,
  nombreEssieux: 2,
};

describe("vue de dessus", () => {
  it("respecte les proportions réelles", () => {
    const vue = vueDeDessus(PLATEAU);
    // Deux fois plus long que large, sur le dessin comme dans la cour.
    expect(vue.corps.largeur / vue.corps.hauteur).toBeCloseTo(2, 5);
  });

  it("garde la même échelle quel que soit le côté dominant", () => {
    const longue = vueDeDessus({ ...PLATEAU, longueurMm: 6000 });
    const large = vueDeDessus({ ...PLATEAU, longueurMm: 1500, largeurMm: 6000 });

    // Le plus grand côté occupe la même étendue dans les deux cas : c'est ce
    // qui rend deux schémas comparables d'une annonce à l'autre.
    expect(longue.corps.largeur).toBeCloseTo(large.corps.hauteur, 5);
  });

  it("laisse de la marge autour du corps pour les cotes", () => {
    const vue = vueDeDessus(PLATEAU);
    expect(vue.corps.x).toBeGreaterThan(0);
    expect(vue.largeurVue).toBeGreaterThan(vue.corps.x + vue.corps.largeur);
    expect(vue.hauteurVue).toBeGreaterThan(vue.corps.y + vue.corps.hauteur);
  });

  it("porte les deux cotes du plan", () => {
    expect(vueDeDessus(PLATEAU).cotes.map((cote) => cote.valeurMm)).toEqual([
      3000, 1500,
    ]);
  });
});

describe("vue de côté", () => {
  it("n'est pas dessinée sans hauteur connue", () => {
    // Inventer une ridelle pour meubler ferait dire au schéma ce que l'annonce
    // ne dit pas.
    expect(vueDeCote(PLATEAU)).toBeNull();
    expect(vueDeCote({ ...PLATEAU, hauteurMm: 0 })).toBeNull();
  });

  it("respecte les proportions quand la hauteur est connue", () => {
    const vue = vueDeCote({ ...PLATEAU, hauteurMm: 1000 })!;
    expect(vue.corps.largeur / vue.corps.hauteur).toBeCloseTo(3, 5);
  });
});

describe("position des roues", () => {
  it("place un essieu en arrière du centre", () => {
    // En avant du centre, la flèche au timon deviendrait négative : la
    // remorque basculerait vers l'arrière à vide.
    const [seul] = positionsRoues(1);
    expect(seul).toBeGreaterThan(0.5);
  });

  it("répartit deux essieux autour du même point", () => {
    const [avant, arriere] = positionsRoues(2);
    const [seul] = positionsRoues(1);

    expect(avant).toBeLessThan(seul);
    expect(arriere).toBeGreaterThan(seul);
    expect((avant + arriere) / 2).toBeCloseTo(seul, 5);
  });

  it("rend autant de roues que d'essieux, dans l'ordre", () => {
    for (const essieux of [1, 2, 3]) {
      const positions = positionsRoues(essieux);
      expect(positions).toHaveLength(essieux);
      expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    }
  });

  it("reste dans les bornes de la caisse", () => {
    for (const essieux of [1, 2, 3]) {
      for (const position of positionsRoues(essieux)) {
        expect(position).toBeGreaterThan(0);
        expect(position).toBeLessThan(1);
      }
    }
  });
});
