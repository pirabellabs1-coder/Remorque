import { describe, expect, it } from "vitest";

import { DEFAULT_MARKET, ENABLED_MARKETS, MARKETS, marchePourPays } from "./markets";

/**
 * Ce que ces tests protègent : « une annonce se consulte sur le marché de son
 * pays ».
 *
 * Le défaut qu'ils verrouillent était silencieux et coûteux. Un loueur
 * publiait depuis le site français une remorque garée à Charleroi ; la
 * redirection le renvoyait vers une adresse française, où le cloisonnement par
 * pays rend l'annonce introuvable. Elle était pourtant bien publiée — mais
 * l'écran disait « page introuvable », et l'on en concluait que la publication
 * ne marchait pas.
 */

describe("le marché qui sert un pays", () => {
  it("rend le marché de référence pour son propre pays", () => {
    expect(marchePourPays(MARKETS[DEFAULT_MARKET].country)).toBe(DEFAULT_MARKET);
  });

  it("distingue la Belgique de la France", () => {
    const belge = marchePourPays("BE");
    expect(belge).toBeDefined();
    expect(belge).not.toBe(marchePourPays("FR"));
    expect(MARKETS[belge!].country).toBe("BE");
  });

  it("ne rend rien pour un pays dont le marché n'est pas ouvert", () => {
    // L'appelant doit décider quoi faire — un repli silencieux sur le marché
    // par défaut ramènerait exactement au 404 que l'on cherche à éviter.
    expect(marchePourPays("JP")).toBeUndefined();
  });

  it("ne rend que des marchés ouverts", () => {
    for (const marche of ENABLED_MARKETS) {
      expect(marchePourPays(MARKETS[marche].country)).toBeDefined();
      expect(ENABLED_MARKETS).toContain(marchePourPays(MARKETS[marche].country));
    }
  });
});
