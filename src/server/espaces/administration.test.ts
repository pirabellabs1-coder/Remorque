import { describe, expect, it } from "vitest";

import { listerReservations } from "./activite";
import {
  comparaisonPays,
  fondsGeles,
  listerLitiges,
  listerPays,
  listerSinistres,
  listerUtilisateurs,
  syntheseAdmin,
} from "./administration";

/**
 * Ce que ces tests protègent : les règles non négociables du cadrage que rien
 * d'autre ne rattraperait.
 *
 * Le gel des fonds (règle 6) et l'absence de taux codé en dur (règle 2) sont
 * de ceux qui ne se voient pas quand on les casse : l'écran continue
 * d'afficher un chiffre, simplement il est faux. Une erreur de gel signifie
 * qu'un versement part alors qu'un litige est ouvert — de l'argent perdu, pas
 * un défaut d'affichage.
 */

describe("règle 6 — gel des fonds", () => {
  it("ne gèle rien pour un litige résolu", async () => {
    for (const litige of (await listerLitiges())) {
      if (litige.statut === "resolu") {
        expect(litige.fondsGeles).toBe(0);
      }
    }
  });

  it("gèle un montant pour tout litige non résolu", async () => {
    const enCours = (await listerLitiges()).filter(
      (litige) => litige.statut !== "resolu",
    );

    // Le jeu d'essai doit contenir des litiges ouverts, sans quoi le test
    // passerait à vide et ne prouverait rien.
    expect(enCours.length).toBeGreaterThan(0);
    for (const litige of enCours) {
      expect(litige.fondsGeles).toBeGreaterThan(0);
    }
  });

  it("additionne litiges et sinistres en cours, et eux seuls", async () => {
    const parLitiges = (await listerLitiges())
      .filter((litige) => litige.statut !== "resolu")
      .reduce((somme, litige) => somme + litige.fondsGeles, 0);

    const parSinistres = (await listerSinistres())
      .filter((sinistre) => ["declare", "transmis"].includes(sinistre.statut))
      .reduce((somme, sinistre) => somme + sinistre.montantEstime, 0);

    expect((await fondsGeles())).toBe(parLitiges + parSinistres);

    // Un sinistre indemnisé ou refusé est clos : il ne doit plus rien geler.
    const clos = (await listerSinistres()).filter((sinistre) =>
      ["indemnise", "refuse"].includes(sinistre.statut),
    );
    const avecLesClos =
      parLitiges +
      parSinistres +
      clos.reduce((somme, sinistre) => somme + sinistre.montantEstime, 0);

    if (clos.length > 0) expect((await fondsGeles())).toBeLessThan(avecLesClos);
  });
});

describe("règle 2 — aucun taux codé en dur", () => {
  it("exprime tous les taux en points de base entiers", async () => {
    for (const pays of listerPays()) {
      expect(Number.isInteger(pays.commissionPdb)).toBe(true);
      expect(Number.isInteger(pays.tvaPdb)).toBe(true);
      // Une commission au-delà de 50 % ou nulle trahirait une confusion entre
      // points de base et pourcentage.
      expect(pays.commissionPdb).toBeGreaterThan(0);
      expect(pays.commissionPdb).toBeLessThan(5000);
    }
  });

  it("exprime tous les montants en centiemes entiers, avec leur devise", async () => {
    for (const pays of listerPays()) {
      expect(Number.isInteger(pays.plafondCaution)).toBe(true);
      expect(pays.devise).toMatch(/^[A-Z]{3}$/);
    }
  });
});

describe("synthèse de l'administration", () => {
  it("ne compte jamais la commission au-delà du volume", async () => {
    const synthese = (await syntheseAdmin());
    expect(synthese.commissionPercue).toBeLessThanOrEqual(
      synthese.volumeAffaires,
    );
    expect(synthese.tauxCommissionReel).not.toBeNull();
    expect(synthese.tauxCommissionReel!).toBeGreaterThan(0);
    expect(synthese.tauxCommissionReel!).toBeLessThan(100);
  });

  it("compte autant d'utilisateurs que la liste en contient", async () => {
    expect((await syntheseAdmin()).utilisateurs).toBe((await listerUtilisateurs()).length);
  });

  it("ne répartit pas plus de réservations entre pays qu'il n'en existe", async () => {
    const total = (await comparaisonPays()).reduce(
      (somme, ligne) => somme + ligne.reservations,
      0,
    );
    expect(total).toBeLessThanOrEqual((await listerReservations()).length);
  });
});

describe("cohérence du jeu d'essai", () => {
  it("n'attribue jamais un statut incompatible avec les dates", async () => {
    const maintenant = new Date();

    for (const reservation of (await listerReservations())) {
      if (reservation.fin < maintenant) {
        // Une location terminée ne peut pas être encore « confirmée » ou
        // « en cours » : l'écran afficherait une absurdité que l'on prendrait
        // pour un bogue de la machine à états.
        expect(reservation.statut).not.toBe("confirmee");
        expect(reservation.statut).not.toBe("en_cours");
      }
      if (reservation.debut > maintenant) {
        expect(reservation.statut).not.toBe("cloturee");
      }
      expect(reservation.fin >= reservation.debut).toBe(true);
    }
  });

  it("dérive le net du brut moins la commission, au centime près", async () => {
    for (const reservation of (await listerReservations())) {
      expect(reservation.netProprietaire).toBe(
        reservation.montantTotal - reservation.commission,
      );
      expect(Number.isInteger(reservation.montantTotal)).toBe(true);
      expect(Number.isInteger(reservation.commission)).toBe(true);
    }
  });
});
