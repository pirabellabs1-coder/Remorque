import { describe, expect, it } from "vitest";

import {
  evaluerProlongation,
  JOURS_MAXIMUM,
  supplementProlongation,
  type Demande,
} from "./prolongation";

/**
 * Ce que ces tests protègent : « prolonger ne crée jamais deux locataires sur
 * le même matériel ».
 *
 * La prolongation répond à un besoin banal — le chantier déborde d'un jour —
 * et touche à ce qu'une place de marché a de plus fragile : le calendrier.
 * Accordée par-dessus une réservation existante, elle met deux personnes
 * devant la même remorque le même matin, et d'une faute pareille on ne se
 * relève pas.
 */

const jour = (numero: number) => new Date(2027, 2, numero);

const base: Demande = {
  statut: "en_cours",
  debut: jour(15),
  finActuelle: jour(18),
  finSouhaitee: jour(20),
  prochaineReservation: null,
  dureeMaximumAnnonce: 30,
};

describe("possibilité de prolonger", () => {
  it("accepte deux jours de plus sur une location en cours", () => {
    expect(evaluerProlongation(base)).toEqual({
      ok: true,
      joursAjoutes: 2,
      dureeTotale: 5,
    });
  });

  it("refuse tant que la location n'a pas démarré", () => {
    // Avant le retrait, il reste temps de modifier la réservation elle-même :
    // prolonger ce qui n'a pas commencé n'a pas de sens.
    for (const statut of ["demandee", "acceptee", "payee", "confirmee"] as const) {
      expect(evaluerProlongation({ ...base, statut }), statut).toEqual({
        ok: false,
        motif: "statutIncompatible",
      });
    }
  });

  it("refuse une fois le matériel restitué", () => {
    expect(evaluerProlongation({ ...base, statut: "restituee" })).toEqual({
      ok: false,
      motif: "statutIncompatible",
    });
  });

  it("refuse une date qui ne prolonge rien", () => {
    expect(
      evaluerProlongation({ ...base, finSouhaitee: base.finActuelle }),
    ).toEqual({ ok: false, motif: "dureeInvalide" });

    // Une date antérieure serait un raccourcissement — autre sujet, autres
    // conséquences sur le remboursement.
    expect(evaluerProlongation({ ...base, finSouhaitee: jour(16) })).toEqual({
      ok: false,
      motif: "dureeInvalide",
    });
  });

  it("refuse au-delà de deux semaines", () => {
    // Ce n'est plus une prolongation mais une seconde location, qui mérite son
    // contrat, son état des lieux et sa caution.
    const trop = { ...base, finSouhaitee: jour(18 + JOURS_MAXIMUM + 1) };
    expect(evaluerProlongation(trop)).toEqual({ ok: false, motif: "tropLongue" });
  });

  it("refuse si quelqu'un a réservé la suite", () => {
    // Le cas qui justifie tout ce module.
    expect(
      evaluerProlongation({ ...base, prochaineReservation: jour(19) }),
    ).toEqual({ ok: false, motif: "chevauchement" });
  });

  it("refuse jusqu'au jour de contact, sans marge", () => {
    // Finir le 20 quand la suivante commence le 20, c'est deux états des lieux
    // le même jour au même endroit par des personnes différentes.
    expect(
      evaluerProlongation({ ...base, prochaineReservation: jour(20) }),
    ).toEqual({ ok: false, motif: "chevauchement" });
  });

  it("accepte jusqu'à la veille de la suivante", () => {
    expect(
      evaluerProlongation({ ...base, prochaineReservation: jour(21) }).ok,
    ).toBe(true);
  });

  it("respecte la durée maximale de l'annonce", () => {
    // Un propriétaire qui ne loue pas plus de quatre jours ne doit pas se
    // retrouver à cinq par le détour d'une prolongation.
    expect(
      evaluerProlongation({ ...base, dureeMaximumAnnonce: 4 }),
    ).toEqual({ ok: false, motif: "depasseDureeMaximum" });
  });

  it("juge la demande avant le calendrier", () => {
    // Dire « quelqu'un a réservé la suite » à qui a saisi une date antérieure
    // serait exact et hors sujet.
    expect(
      evaluerProlongation({
        ...base,
        finSouhaitee: jour(16),
        prochaineReservation: jour(17),
      }),
    ).toEqual({ ok: false, motif: "dureeInvalide" });
  });
});

describe("supplément", () => {
  const bareme = { commissionLocataireBp: 500, commissionProprietaireBp: 1500 };

  it("facture les jours ajoutés au tarif d'origine", () => {
    const devis = supplementProlongation({
      prixJour: 3500,
      joursAjoutes: 2,
      bareme,
    });

    // Deux jours à 35 € : le loyer du supplément, et rien de la période déjà
    // payée.
    expect(devis.loyer).toBe(7000);
    expect(devis.totalLocataire).toBeGreaterThan(7000);
  });

  it("garde des centimes entiers", () => {
    // Règle 1 : aucun montant en flottant, jamais.
    const devis = supplementProlongation({
      prixJour: 3333,
      joursAjoutes: 3,
      bareme,
    });

    for (const montant of [devis.loyer, devis.totalLocataire]) {
      expect(Number.isInteger(montant)).toBe(true);
    }
  });
});
