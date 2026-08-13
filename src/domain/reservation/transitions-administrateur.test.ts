import { describe, expect, it } from "vitest";

import { STATUTS, STATUTS_TERMINAUX, TRANSITIONS } from "./machine";
import {
  estUneSortie,
  evenementsAdministrateur,
} from "./transitions-administrateur";

/**
 * Ce que ces tests protègent : « l'administration peut débloquer ce que le
 * cours normal n'a pas fait, et rien de plus ».
 *
 * Le besoin est né d'un constat : sans clés Stripe, une réservation acceptée
 * reste acceptée pour toujours. La machine autorisait pourtant l'administrateur
 * à forcer l'encaissement depuis l'origine — la permission existait, le chemin
 * pour l'exercer, non.
 */

describe("événements offerts à l'administrateur", () => {
  it("permet de débloquer une réservation acceptée mais non payée", () => {
    // Le cas qui a motivé tout ceci.
    expect(evenementsAdministrateur("acceptee")).toContain("encaisser");
  });

  it("permet de confirmer une réservation payée", () => {
    expect(evenementsAdministrateur("payee")).toContain("confirmer");
  });

  it("n'offre rien depuis un état terminal", () => {
    // Une réservation clôturée, refusée, expirée ou annulée est finie. Offrir
    // un bouton sur elle serait proposer de défaire ce qui est soldé.
    for (const statut of STATUTS_TERMINAUX) {
      expect(evenementsAdministrateur(statut), statut).toEqual([]);
    }
  });

  it("ne propose que des transitions réellement déclarées", () => {
    // La garantie qui compte : la liste est dérivée, pas recopiée. Aucun
    // événement offert ici ne peut être refusé par la machine ensuite.
    for (const statut of STATUTS) {
      for (const evenement of evenementsAdministrateur(statut)) {
        const legale = TRANSITIONS[evenement].some(
          (regle) =>
            regle.depuis === statut &&
            regle.acteurs.includes("administrateur"),
        );
        expect(legale, `${statut} → ${evenement}`).toBe(true);
      }
    }
  });

  it("couvre toute transition que la machine ouvre à l'administrateur", () => {
    // L'autre sens du même contrat : rien de ce que la machine autorise ne
    // doit rester inaccessible. C'est ce test qui fera apparaître d'elle-même
    // une transition ajoutée demain.
    for (const [evenement, regles] of Object.entries(TRANSITIONS)) {
      for (const regle of regles) {
        if (!regle.acteurs.includes("administrateur")) continue;
        expect(
          evenementsAdministrateur(regle.depuis),
          `${regle.depuis} → ${evenement}`,
        ).toContain(evenement);
      }
    }
  });
});

describe("sorties", () => {
  it("distingue une sortie d'une avancée", () => {
    // Les deux ne doivent pas se ressembler à l'écran : un administrateur
    // fatigué qui clique au mauvais endroit ne défait pas une annulation.
    expect(estUneSortie("annuler")).toBe(true);
    expect(estUneSortie("refuser")).toBe(true);
    expect(estUneSortie("encaisser")).toBe(false);
    expect(estUneSortie("cloturer")).toBe(false);
  });
});
