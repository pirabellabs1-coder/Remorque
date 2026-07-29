import { describe, expect, it } from "vitest";

import {
  STATUTS,
  TRANSITIONS,
  estTerminal,
  evaluerTransition,
  evenementsDisponibles,
  type Evenement,
  type StatutReservation,
} from "./machine";

describe("machine à états d'une réservation", () => {
  it("déroule le parcours nominal jusqu'à la clôture", () => {
    const parcours: Array<[Evenement, StatutReservation, StatutReservation]> = [
      ["accepter", "demandee", "acceptee"],
      ["encaisser", "acceptee", "payee"],
      ["confirmer", "payee", "confirmee"],
      ["demarrer", "confirmee", "en_cours"],
      ["restituer", "en_cours", "restituee"],
      ["cloturer", "restituee", "cloturee"],
    ];

    for (const [evenement, depuis, vers] of parcours) {
      const resultat = evaluerTransition(evenement, {
        statut: depuis,
        acteur: "administrateur",
      });
      expect(resultat).toEqual({ autorise: true, statutSuivant: vers });
    }
  });

  it("refuse une transition qui n'existe pas depuis l'état courant", () => {
    const resultat = evaluerTransition("restituer", {
      statut: "demandee",
      acteur: "proprietaire",
    });

    expect(resultat.autorise).toBe(false);
  });

  it("refuse un acteur non habilité", () => {
    const resultat = evaluerTransition("accepter", {
      statut: "demandee",
      acteur: "locataire",
    });

    expect(resultat.autorise).toBe(false);
  });

  it("bloque la clôture tant que les fonds sont gelés", () => {
    const gele = evaluerTransition("cloturer", {
      statut: "restituee",
      acteur: "systeme",
      fondsGeles: true,
    });
    expect(gele.autorise).toBe(false);

    const degele = evaluerTransition("cloturer", {
      statut: "restituee",
      acteur: "systeme",
      fondsGeles: false,
    });
    expect(degele.autorise).toBe(true);
  });

  it("n'autorise plus aucune transition depuis un état terminal", () => {
    const terminaux: StatutReservation[] = [
      "cloturee",
      "refusee",
      "expiree",
      "annulee",
    ];

    for (const statut of terminaux) {
      expect(estTerminal(statut)).toBe(true);
      expect(
        evenementsDisponibles({ statut, acteur: "administrateur" }),
      ).toEqual([]);
    }
  });

  it("permet au locataire d'annuler jusqu'à la confirmation, mais pas après le retrait", () => {
    for (const statut of [
      "demandee",
      "acceptee",
      "payee",
      "confirmee",
    ] as StatutReservation[]) {
      expect(
        evaluerTransition("annuler", { statut, acteur: "locataire" }).autorise,
      ).toBe(true);
    }

    expect(
      evaluerTransition("annuler", {
        statut: "en_cours",
        acteur: "locataire",
      }).autorise,
    ).toBe(false);
  });

  it("ne déclare que des états connus dans la table de transitions", () => {
    const connus = new Set<string>(STATUTS);

    for (const regles of Object.values(TRANSITIONS)) {
      for (const regle of regles) {
        expect(connus.has(regle.depuis)).toBe(true);
        expect(connus.has(regle.vers)).toBe(true);
      }
    }
  });

  it("rend chaque état non terminal atteignable depuis la demande initiale", () => {
    const atteints = new Set<StatutReservation>(["demandee"]);
    let taille = 0;

    while (taille !== atteints.size) {
      taille = atteints.size;
      for (const regles of Object.values(TRANSITIONS)) {
        for (const regle of regles) {
          if (atteints.has(regle.depuis)) {
            atteints.add(regle.vers);
          }
        }
      }
    }

    for (const statut of STATUTS) {
      expect(atteints.has(statut)).toBe(true);
    }
  });
});
