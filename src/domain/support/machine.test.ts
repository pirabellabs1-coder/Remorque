import { describe, expect, it } from "vitest";

import {
  delaiDepasse,
  evaluerSupport,
  PRIORITES_SUPPORT,
  STATUTS_SUPPORT,
  type StatutSupport,
} from "./machine";

/**
 * Ce que ces tests protègent : la promesse de répondre.
 *
 * Un ticket clos sans réponse est pire qu'un ticket en retard — il sort des
 * indicateurs en annonçant un traitement qui n'a pas eu lieu. Le reste de la
 * machine est court parce que le support n'arbitre rien ; cette règle-là est
 * la seule qui mérite d'être gardée.
 */

describe("machine du support", () => {
  it("suit le chemin nominal : ouvert → en cours → résolu", () => {
    expect(
      evaluerSupport("prendre", { statut: "ouvert", acteur: "assistance" }),
    ).toEqual({ autorise: true, statutSuivant: "en_cours" });

    expect(
      evaluerSupport("repondre", {
        statut: "en_cours",
        acteur: "assistance",
        message: "Voici la marche à suivre.",
      }),
    ).toEqual({ autorise: true, statutSuivant: "en_cours" });

    expect(
      evaluerSupport("resoudre", {
        statut: "en_cours",
        acteur: "assistance",
        dejaRepondu: true,
      }),
    ).toEqual({ autorise: true, statutSuivant: "resolu" });
  });

  it("refuse de clore une demande à laquelle personne n'a répondu", () => {
    const verdict = evaluerSupport("resoudre", {
      statut: "en_cours",
      acteur: "assistance",
      dejaRepondu: false,
    });

    expect(verdict.autorise).toBe(false);
    if (!verdict.autorise) expect(verdict.motif).toMatch(/sans qu'une réponse/);
  });

  it("répondre vaut prise en charge — l'indicateur suit le geste", () => {
    // Sans cette règle, une première réponse pourrait être datée sur un
    // ticket resté « ouvert » : le tableau de bord compterait une demande en
    // attente alors qu'elle a reçu son courriel.
    expect(
      evaluerSupport("repondre", {
        statut: "ouvert",
        acteur: "assistance",
        message: "Bonjour, je regarde cela.",
      }),
    ).toEqual({ autorise: true, statutSuivant: "en_cours" });
  });

  it("refuse une réponse vide", () => {
    for (const message of [undefined, "", "   "]) {
      expect(
        evaluerSupport("repondre", {
          statut: "en_cours",
          acteur: "assistance",
          message,
        }).autorise,
      ).toBe(false);
    }
  });

  it("laisse le demandeur relancer, jamais prendre ni clore", () => {
    expect(
      evaluerSupport("repondre", {
        statut: "en_cours",
        acteur: "demandeur",
        message: "Toujours rien de mon côté.",
      }).autorise,
    ).toBe(true);

    for (const evenement of ["prendre", "resoudre"] as const) {
      expect(
        evaluerSupport(evenement, {
          statut: evenement === "prendre" ? "ouvert" : "en_cours",
          acteur: "demandeur",
          dejaRepondu: true,
        }).autorise,
      ).toBe(false);
    }
  });

  it("laisse le demandeur renoncer tant que personne ne s'en est saisi", () => {
    expect(
      evaluerSupport("renoncer", { statut: "ouvert", acteur: "demandeur" }),
    ).toEqual({ autorise: true, statutSuivant: "resolu" });

    // Une fois la demande prise en charge, y renoncer laisserait l'assistance
    // travailler dans le vide.
    expect(
      evaluerSupport("renoncer", { statut: "en_cours", acteur: "demandeur" })
        .autorise,
    ).toBe(false);

    // Et l'assistance ne renonce pas à la place de qui a écrit.
    expect(
      evaluerSupport("renoncer", { statut: "ouvert", acteur: "assistance" })
        .autorise,
    ).toBe(false);
  });

  it("interdit toute action sur une demande close", () => {
    for (const evenement of ["prendre", "repondre", "resoudre", "renoncer"] as const) {
      for (const acteur of ["demandeur", "assistance"] as const) {
        expect(
          evaluerSupport(evenement, {
            statut: "resolu",
            acteur,
            message: "encore un mot",
            dejaRepondu: true,
          }).autorise,
        ).toBe(false);
      }
    }
  });

  it("n'atteint que des états connus", () => {
    const connus: readonly string[] = STATUTS_SUPPORT;
    for (const evenement of ["prendre", "repondre", "resoudre", "renoncer"] as const) {
      for (const statut of STATUTS_SUPPORT) {
        for (const acteur of ["demandeur", "assistance"] as const) {
          const verdict = evaluerSupport(evenement, {
            statut: statut as StatutSupport,
            acteur,
            message: "texte",
            dejaRepondu: true,
          });
          if (verdict.autorise) expect(connus).toContain(verdict.statutSuivant);
        }
      }
    }
  });
});

describe("délai de première réponse", () => {
  it("suit la priorité — quatre heures pour une urgence, trois jours pour une curiosité", () => {
    expect(
      delaiDepasse({ priorite: "haute", heuresEcoulees: 5, premiereReponseFaite: false }),
    ).toBe(true);
    expect(
      delaiDepasse({ priorite: "normale", heuresEcoulees: 5, premiereReponseFaite: false }),
    ).toBe(false);
    expect(
      delaiDepasse({ priorite: "basse", heuresEcoulees: 71, premiereReponseFaite: false }),
    ).toBe(false);
    expect(
      delaiDepasse({ priorite: "basse", heuresEcoulees: 73, premiereReponseFaite: false }),
    ).toBe(true);
  });

  it("ne compte plus le retard une fois la réponse partie", () => {
    // Le délai mesure l'attente, pas la durée du dossier : une demande
    // répondue en une heure puis instruite trois jours n'est pas en retard.
    for (const priorite of PRIORITES_SUPPORT) {
      expect(
        delaiDepasse({ priorite, heuresEcoulees: 1000, premiereReponseFaite: true }),
      ).toBe(false);
    }
  });
});
