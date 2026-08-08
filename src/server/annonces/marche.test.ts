import { describe, expect, it } from "vitest";

import {
  ALL_MARKETS,
  DEFAULT_MARKET,
  ENABLED_MARKETS,
  getMarket,
  MARKETS,
} from "@/config/markets";
import { PAYS, VILLES } from "@/config/villes";

import { paysDuMarche } from "./marche";

/**
 * Ce que ces tests protègent : la règle 7, « multi-pays dès la première ligne ».
 *
 * Le défaut qu'ils empêchent s'est réellement produit : le marché français
 * servait les remorques de Bruxelles, d'Anvers et de Liège. Chaque entité
 * portait bien son pays — personne ne le lisait. Un visiteur voyait donc des
 * annonces qu'il ne pouvait ni atteindre, ni louer sous le barème affiché.
 */

describe("configuration des marchés", () => {
  it("donne à chaque marché un pays, une langue et une devise", () => {
    for (const marche of ALL_MARKETS) {
      const definition = getMarket(marche);
      expect(definition.country).toMatch(/^[A-Z]{2}$/);
      expect(definition.language).toMatch(/^[a-z]{2}$/);
      // Aucun montant n'existe sans sa devise — règle 1.
      expect(definition.currency).toMatch(/^[A-Z]{3}$/);
    }
  });

  it("ne sert qu'un seul marché à la racine", () => {
    const sansPrefixe = ALL_MARKETS.filter(
      (marche) => MARKETS[marche].pathPrefix === null,
    );

    // Deux marchés à la racine, et le routage devient ambigu : la même adresse
    // désignerait deux catalogues.
    expect(sansPrefixe).toEqual([DEFAULT_MARKET]);
  });

  it("donne un préfixe distinct à chaque marché ouvert", () => {
    const prefixes = ENABLED_MARKETS.map((marche) => MARKETS[marche].pathPrefix);
    expect(new Set(prefixes).size).toBe(prefixes.length);
  });

  it("n'ouvre que des marchés dont le pays est couvert par les villes", () => {
    // Un marché ouvert sans ville n'a aucune page locale — or ce sont elles qui
    // portent 60 à 80 % du trafic attendu.
    for (const marche of ENABLED_MARKETS) {
      const code = paysDuMarche(marche);
      expect(PAYS).toContain(code);
      expect(VILLES.some((ville) => ville.pays === code)).toBe(true);
    }
  });

  it("rattache chaque marché ouvert à un pays distinct", () => {
    // Deux marchés sur le même pays partageraient le même catalogue : la
    // séparation par pays ne séparerait alors plus rien.
    const pays = ENABLED_MARKETS.map(paysDuMarche);
    expect(new Set(pays).size).toBe(pays.length);
  });
});
