import { describe, expect, it } from "vitest";

import {
  avisAecrire,
  cautionsEnCours,
  mesAvis,
  mesFavoris,
  mesFils,
  mesPaiements,
  mesReservations,
  reservationsAvenir,
  reservationsEnCours,
  syntheseLocataire,
} from "./locataire";

/**
 * Ce que ces tests protègent, côté locataire.
 *
 * Deux règles ici ne se rattrapent pas à l'œil : une caution comptée comme
 * immobilisée alors qu'elle est libérée fait croire à un plafond de carte
 * bloqué ; un avis proposé hors délai mène l'usager vers un formulaire qui le
 * refusera. Dans les deux cas l'écran reste plausible, et faux.
 */

describe("cautions — ce qui pèse réellement sur la carte", () => {
  it("ne retient que les cautions encore immobilisées", () => {
    for (const reservation of cautionsEnCours()) {
      expect(["empreinte", "en_liberation", "gelee"]).toContain(
        reservation.cautionEtat,
      );
    }

    // Et réciproquement : aucune caution libérée ou retenue ne doit s'y
    // trouver, sans quoi le total afficherait de l'argent que le locataire a
    // déjà récupéré.
    const libereesRetenues = mesReservations().filter((reservation) =>
      ["liberee", "retenue"].includes(reservation.cautionEtat),
    );
    const identifiants = new Set(cautionsEnCours().map((r) => r.id));
    for (const reservation of libereesRetenues) {
      expect(identifiants.has(reservation.id)).toBe(false);
    }
  });

  it("somme exactement les cautions immobilisées dans la synthèse", () => {
    const attendu = cautionsEnCours().reduce(
      (somme, reservation) => somme + reservation.caution,
      0,
    );
    const synthese = syntheseLocataire();

    expect(synthese.cautionsGelees).toBe(attendu);
    expect(synthese.cautionsNombre).toBe(cautionsEnCours().length);
  });

  it("n'immobilise jamais de caution sur une location non engagée", () => {
    for (const reservation of mesReservations()) {
      if (["demandee", "refusee", "annulee", "expiree"].includes(reservation.statut)) {
        expect(reservation.cautionEtat).toBe("liberee");
      }
    }
  });

  it("ne retient un montant que sur une caution effectivement retenue", () => {
    for (const reservation of mesReservations()) {
      if (reservation.cautionEtat === "retenue") {
        expect(reservation.cautionRetenue).toBeGreaterThan(0);
        // Une retenue supérieure à la caution voudrait dire que la plateforme
        // prélève au-delà de l'empreinte, ce qu'elle ne peut pas faire.
        expect(reservation.cautionRetenue).toBeLessThanOrEqual(reservation.caution);
      } else {
        expect(reservation.cautionRetenue).toBe(0);
      }
    }
  });
});

describe("avis — la fenêtre de dépôt", () => {
  it("ne propose d'écrire que sur une location terminée", () => {
    const parIdentifiant = new Map(
      mesReservations().map((reservation) => [reservation.id, reservation]),
    );

    for (const entree of avisAecrire()) {
      expect(parIdentifiant.get(entree.reservationId)?.statut).toBe("cloturee");
    }
  });

  it("ne propose jamais un délai expiré ou nul", () => {
    for (const entree of avisAecrire()) {
      expect(entree.joursRestants).toBeGreaterThan(0);
      expect(entree.joursRestants).toBeLessThanOrEqual(14);
    }
  });

  it("ne propose pas d'écrire un avis déjà déposé", () => {
    const dejaEcrits = new Set(mesAvis().map((avis) => avis.reservationId));
    for (const entree of avisAecrire()) {
      expect(dejaEcrits.has(entree.reservationId)).toBe(false);
    }
  });

  it("note toujours entre 1 et 5, sans décimale", () => {
    for (const avis of mesAvis()) {
      expect(Number.isInteger(avis.note)).toBe(true);
      expect(avis.note).toBeGreaterThanOrEqual(1);
      expect(avis.note).toBeLessThanOrEqual(5);
    }
  });
});

describe("relevé des paiements", () => {
  it("écrit la caution sur une ligne distincte de la location", () => {
    const lignes = mesPaiements();
    const cautions = lignes.filter((ligne) => ligne.nature === "caution");
    const locations = lignes.filter((ligne) => ligne.nature === "location");

    expect(locations.length).toBeGreaterThan(0);
    // Toute ligne de caution porte son état, toute ligne de location n'en a
    // pas : c'est cette distinction que l'écran existe pour rendre lisible.
    for (const ligne of cautions) expect(ligne.cautionEtat).not.toBeNull();
    for (const ligne of locations) expect(ligne.cautionEtat).toBeNull();
  });

  it("rembourse intégralement une location annulée", () => {
    const lignes = mesPaiements();

    for (const reservation of mesReservations()) {
      if (reservation.statut !== "annulee") continue;

      const remboursement = lignes.find(
        (ligne) =>
          ligne.reference === reservation.reference &&
          ligne.nature === "remboursement",
      );
      expect(remboursement?.montant).toBe(reservation.montantTotal);

      // Une location annulée n'immobilise aucune caution : la ligne ne doit
      // pas exister du tout.
      const caution = lignes.find(
        (ligne) =>
          ligne.reference === reservation.reference && ligne.nature === "caution",
      );
      expect(caution).toBeUndefined();
    }
  });

  it("n'exprime que des entiers de centimes, avec leur devise", () => {
    for (const ligne of mesPaiements()) {
      expect(Number.isInteger(ligne.montant)).toBe(true);
      expect(ligne.devise).toMatch(/^[A-Z]{3}$/);
    }
  });
});

describe("cohérence générale", () => {
  it("n'attribue jamais un statut incompatible avec les dates", () => {
    const maintenant = new Date();

    for (const reservation of mesReservations()) {
      expect(reservation.fin >= reservation.debut).toBe(true);
      if (reservation.fin < maintenant) {
        expect(reservation.statut).not.toBe("confirmee");
        expect(reservation.statut).not.toBe("en_cours");
      }
      if (reservation.debut > maintenant) {
        expect(reservation.statut).not.toBe("cloturee");
      }
    }
  });

  it("sépare strictement les locations à venir et en cours", () => {
    const aVenir = new Set(reservationsAvenir().map((r) => r.id));
    for (const reservation of reservationsEnCours()) {
      expect(aVenir.has(reservation.id)).toBe(false);
    }

    const synthese = syntheseLocataire();
    expect(synthese.aVenir).toBe(reservationsAvenir().length);
    expect(synthese.enCours).toBe(reservationsEnCours().length);
  });

  it("ne met jamais en favori une annonce déjà louée", () => {
    const louees = new Set(
      mesReservations().map((reservation) => reservation.annonceId),
    );
    for (const favori of mesFavoris()) {
      expect(louees.has(favori.annonceId)).toBe(false);
    }
  });

  it("ne compte comme non lus que les messages reçus", () => {
    for (const fil of mesFils()) {
      if (fil.deMoi) expect(fil.nonLus).toBe(0);
      expect(fil.nonLus).toBeGreaterThanOrEqual(0);
    }

    const attendu = mesFils().reduce((somme, fil) => somme + fil.nonLus, 0);
    expect(syntheseLocataire().messagesNonLus).toBe(attendu);
  });
});
