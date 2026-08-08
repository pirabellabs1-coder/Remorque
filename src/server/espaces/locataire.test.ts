import { describe, expect, it } from "vitest";

import { mesFils } from "@/server/messagerie/depot";

import {
  avisAecrire,
  cautionsEnCours,
  mesAvis,
  mesFavoris,
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
  it("ne retient que les cautions encore immobilisées", async () => {
    for (const reservation of (await cautionsEnCours())) {
      expect(["empreinte", "en_liberation", "gelee"]).toContain(
        reservation.cautionEtat,
      );
    }

    // Et réciproquement : aucune caution libérée ou retenue ne doit s'y
    // trouver, sans quoi le total afficherait de l'argent que le locataire a
    // déjà récupéré.
    const libereesRetenues = (await mesReservations()).filter((reservation) =>
      ["liberee", "retenue"].includes(reservation.cautionEtat),
    );
    const identifiants = new Set((await cautionsEnCours()).map((r) => r.id));
    for (const reservation of libereesRetenues) {
      expect(identifiants.has(reservation.id)).toBe(false);
    }
  });

  it("somme exactement les cautions immobilisées dans la synthèse", async () => {
    const attendu = (await cautionsEnCours()).reduce(
      (somme, reservation) => somme + reservation.caution,
      0,
    );
    const synthese = (await syntheseLocataire());

    expect(synthese.cautionsGelees).toBe(attendu);
    expect(synthese.cautionsNombre).toBe((await cautionsEnCours()).length);
  });

  it("n'immobilise jamais de caution sur une location non engagée", async () => {
    for (const reservation of (await mesReservations())) {
      if (["demandee", "refusee", "annulee", "expiree"].includes(reservation.statut)) {
        expect(reservation.cautionEtat).toBe("liberee");
      }
    }
  });

  it("ne retient un montant que sur une caution effectivement retenue", async () => {
    for (const reservation of (await mesReservations())) {
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
  it("ne propose d'écrire que sur une location terminée", async () => {
    const parIdentifiant = new Map(
      (await mesReservations()).map((reservation) => [reservation.id, reservation]),
    );

    for (const entree of (await avisAecrire())) {
      expect(parIdentifiant.get(entree.reservationId)?.statut).toBe("cloturee");
    }
  });

  it("ne propose jamais un délai expiré ou nul", async () => {
    for (const entree of (await avisAecrire())) {
      expect(entree.joursRestants).toBeGreaterThan(0);
      expect(entree.joursRestants).toBeLessThanOrEqual(14);
    }
  });

  it("ne propose pas d'écrire un avis déjà déposé", async () => {
    const dejaEcrits = new Set((await mesAvis()).map((avis) => avis.reservationId));
    for (const entree of (await avisAecrire())) {
      expect(dejaEcrits.has(entree.reservationId)).toBe(false);
    }
  });

  it("note toujours entre 1 et 5, sans décimale", async () => {
    for (const avis of (await mesAvis())) {
      expect(Number.isInteger(avis.note)).toBe(true);
      expect(avis.note).toBeGreaterThanOrEqual(1);
      expect(avis.note).toBeLessThanOrEqual(5);
    }
  });
});

describe("relevé des paiements", () => {
  it("écrit la caution sur une ligne distincte de la location", async () => {
    const lignes = (await mesPaiements());
    const cautions = lignes.filter((ligne) => ligne.nature === "caution");
    const locations = lignes.filter((ligne) => ligne.nature === "location");

    expect(locations.length).toBeGreaterThan(0);
    // Toute ligne de caution porte son état, toute ligne de location n'en a
    // pas : c'est cette distinction que l'écran existe pour rendre lisible.
    for (const ligne of cautions) expect(ligne.cautionEtat).not.toBeNull();
    for (const ligne of locations) expect(ligne.cautionEtat).toBeNull();
  });

  it("rembourse intégralement une location annulée", async () => {
    const lignes = (await mesPaiements());

    for (const reservation of (await mesReservations())) {
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

  it("n'exprime que des entiers de centimes, avec leur devise", async () => {
    for (const ligne of (await mesPaiements())) {
      expect(Number.isInteger(ligne.montant)).toBe(true);
      expect(ligne.devise).toMatch(/^[A-Z]{3}$/);
    }
  });
});

describe("cohérence générale", () => {
  it("n'attribue jamais un statut incompatible avec les dates", async () => {
    const maintenant = new Date();

    for (const reservation of (await mesReservations())) {
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

  it("sépare strictement les locations à venir et en cours", async () => {
    const aVenir = new Set((await reservationsAvenir()).map((r) => r.id));
    for (const reservation of (await reservationsEnCours())) {
      expect(aVenir.has(reservation.id)).toBe(false);
    }

    const synthese = (await syntheseLocataire());
    expect(synthese.aVenir).toBe((await reservationsAvenir()).length);
    expect(synthese.enCours).toBe((await reservationsEnCours()).length);
  });

  it("ne met jamais en favori une annonce déjà louée", async () => {
    const louees = new Set(
      (await mesReservations()).map((reservation) => reservation.annonceId),
    );
    for (const favori of (await mesFavoris())) {
      expect(louees.has(favori.annonceId)).toBe(false);
    }
  });

  it("ne compte comme non lus que les messages reçus", async () => {
    for (const fil of (await mesFils())) {
      expect(fil.nonLus).toBeGreaterThanOrEqual(0);
    }

    // La pastille de la synthèse et la somme des fils doivent dire le même
    // chiffre : deux compteurs qui divergent se remarquent immédiatement.
    const attendu = (await mesFils()).reduce((somme, fil) => somme + fil.nonLus, 0);
    expect((await syntheseLocataire()).messagesNonLus).toBe(attendu);
  });
});
