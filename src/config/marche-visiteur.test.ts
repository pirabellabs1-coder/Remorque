import { describe, expect, it } from "vitest";

import { deciderMarche, estRobot } from "./marche-visiteur";
import { DEFAULT_MARKET, MARKETS, marchePourPays } from "./markets";

/**
 * Ce que ces tests protègent : deux promesses opposées, tenues ensemble.
 *
 * Côté visiteur, « je suis en Belgique, je vois la Belgique » — sans quoi le
 * cloisonnement du catalogue par pays donne une place de marché vide à qui
 * n'est pas français.
 *
 * Côté moteurs, « toutes les adresses restent explorables ». Rediriger le
 * robot de Google selon son adresse IP — elle est américaine — le ferait ne
 * jamais voir qu'un marché, et sortirait les autres de l'index. C'est le
 * référencement local qui paierait, soit l'essentiel du trafic visé.
 */

const MARCHE_BELGE = marchePourPays("BE")!;

describe("le marché servi au visiteur", () => {
  it("respecte l'adresse quand elle porte déjà un préfixe", () => {
    expect(
      deciderMarche({
        marcheDeLAdresse: MARCHE_BELGE,
        paysDetecte: "FR",
        estRobot: false,
      }),
    ).toEqual({ action: "servir", marche: MARCHE_BELGE });
  });

  it("renvoie un visiteur belge vers le marché belge", () => {
    expect(deciderMarche({ paysDetecte: "BE", estRobot: false })).toEqual({
      action: "rediriger",
      marche: MARCHE_BELGE,
      prefixe: MARKETS[MARCHE_BELGE].pathPrefix,
    });
  });

  it("ne redirige jamais un robot, quel que soit son pays", () => {
    expect(deciderMarche({ paysDetecte: "BE", estRobot: true })).toEqual({
      action: "servir",
      marche: DEFAULT_MARKET,
    });
  });

  it("laisse le choix déjà exprimé l'emporter sur l'adresse IP", () => {
    // Le cas du voyageur, du réseau d'entreprise et du tunnel : l'IP dit
    // « Belgique », la personne a demandé la France.
    expect(
      deciderMarche({
        marcheMemorise: DEFAULT_MARKET,
        paysDetecte: "BE",
        estRobot: false,
      }),
    ).toEqual({ action: "servir", marche: DEFAULT_MARKET });
  });

  it("ignore un marché mémorisé qui n'existe plus", () => {
    expect(
      deciderMarche({
        marcheMemorise: "fr-XX",
        paysDetecte: "BE",
        estRobot: false,
      }),
    ).toEqual({
      action: "rediriger",
      marche: MARCHE_BELGE,
      prefixe: MARKETS[MARCHE_BELGE].pathPrefix,
    });
  });

  it("sert le marché de référence pour un pays sans marché ouvert", () => {
    expect(deciderMarche({ paysDetecte: "JP", estRobot: false })).toEqual({
      action: "servir",
      marche: DEFAULT_MARKET,
    });
  });

  it("ne redirige pas un visiteur déjà sur son propre marché", () => {
    expect(
      deciderMarche({
        paysDetecte: MARKETS[DEFAULT_MARKET].country,
        estRobot: false,
      }),
    ).toEqual({ action: "servir", marche: DEFAULT_MARKET });
  });

  it("se contente du marché de référence sans géolocalisation", () => {
    expect(deciderMarche({ estRobot: false })).toEqual({
      action: "servir",
      marche: DEFAULT_MARKET,
    });
  });
});

describe("reconnaissance des robots", () => {
  it("reconnaît les explorateurs des moteurs", () => {
    for (const agent of [
      "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      "Mozilla/5.0 (compatible; bingbot/2.0)",
      "facebookexternalhit/1.1",
      "Mozilla/5.0 (compatible; YandexBot/3.0)",
    ]) {
      expect(estRobot(agent)).toBe(true);
    }
  });

  it("laisse passer un navigateur ordinaire", () => {
    expect(
      estRobot(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
      ),
    ).toBe(false);
  });

  it("traite une signature absente comme un robot", () => {
    // Le coût d'une erreur est asymétrique : un humain pris pour un robot voit
    // le marché de référence et en change d'un clic ; un robot pris pour un
    // humain sort de l'index.
    expect(estRobot(null)).toBe(true);
  });
});
