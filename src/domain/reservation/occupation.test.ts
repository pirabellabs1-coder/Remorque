import { describe, expect, it } from "vitest";

import { STATUTS } from "./machine";
import {
  STATUTS_LIBERANTS,
  STATUTS_OCCUPANTS,
  occupeLeCalendrier,
  periodesSeChevauchent,
} from "./occupation";

/**
 * Ce que ces tests protègent : « ce que la recherche annonce libre est
 * réservable ».
 *
 * La règle d'occupation sert à deux endroits — le filtre par dates de la
 * recherche, et la validation d'une demande. Si les deux divergent, le
 * symptôme est le pire de tous : une annonce présentée comme disponible, puis
 * refusée au moment de réserver. Le visiteur en conclut que la plateforme
 * ment, et il a raison.
 */

const jour = (numero: number) => new Date(2026, 8, numero);

describe("statuts qui bloquent le calendrier", () => {
  it("bloque dès la demande, avant tout paiement", () => {
    // Sans cela, deux personnes régleraient la même semaine et l'une des deux
    // serait déçue après avoir payé.
    expect(occupeLeCalendrier("demandee")).toBe(true);
  });

  it("libère sur les issues d'exception", () => {
    for (const statut of ["refusee", "expiree", "annulee"]) {
      expect(occupeLeCalendrier(statut), statut).toBe(false);
    }
  });

  it("partage exactement les statuts entre occupants et libérants", () => {
    // Un statut ajouté à la machine sans être classé ici tomberait
    // silencieusement du côté « libère », et la remorque serait louable deux
    // fois. Ce test l'empêche.
    expect([...STATUTS_OCCUPANTS, ...STATUTS_LIBERANTS].sort()).toEqual(
      [...STATUTS].sort(),
    );
  });
});

describe("chevauchement de périodes", () => {
  const existante = { debut: jour(10), fin: jour(14) };

  it("reconnaît un chevauchement partiel, des deux côtés", () => {
    expect(
      periodesSeChevauchent({ debut: jour(8), fin: jour(11) }, existante),
    ).toBe(true);
    expect(
      periodesSeChevauchent({ debut: jour(13), fin: jour(16) }, existante),
    ).toBe(true);
  });

  it("reconnaît une demande qui englobe entièrement l'existante", () => {
    // Le cas qu'on oublie en énumérant les situations une à une.
    expect(
      periodesSeChevauchent({ debut: jour(5), fin: jour(20) }, existante),
    ).toBe(true);
  });

  it("reconnaît une demande entièrement contenue dans l'existante", () => {
    expect(
      periodesSeChevauchent({ debut: jour(11), fin: jour(12) }, existante),
    ).toBe(true);
  });

  it("laisse passer une période qui ne touche pas", () => {
    expect(
      periodesSeChevauchent({ debut: jour(1), fin: jour(9) }, existante),
    ).toBe(false);
    expect(
      periodesSeChevauchent({ debut: jour(15), fin: jour(20) }, existante),
    ).toBe(false);
  });

  it("considère un contact bout à bout comme un chevauchement", () => {
    // Une remorque rendue le 14 et reprise le 14 demande deux états des lieux
    // le même jour, au même endroit, par deux personnes différentes. Le délai
    // de préparation existe précisément pour l'éviter.
    expect(
      periodesSeChevauchent({ debut: jour(14), fin: jour(18) }, existante),
    ).toBe(true);
  });
});
