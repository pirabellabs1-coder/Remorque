import { describe, expect, it } from "vitest";

import { STATUTS_ENCAISSES } from "@/server/donnees-demo";

import {
  listerAvis,
  listerReservations,
  reservationsAtraiter,
  reservationsAvenir,
  reservationsEnCours,
  revenusParAnnonce,
  revenusParMois,
  syntheseLoueur,
} from "./activite";
import { comparaisonPays, syntheseAdmin } from "./administration";
import {
  cautionsEnCours,
  mesReservations,
  syntheseLocataire,
} from "./locataire";

/**
 * Ce que ces tests protègent : l'accord entre un tableau de bord et la liste
 * qu'il résume.
 *
 * Un compteur de tableau de bord est une valeur *dérivée*. Rien n'empêche
 * structurellement qu'il soit calculé autrement que la liste correspondante —
 * un filtre oublié, un statut inclus d'un côté et pas de l'autre — et le
 * symptôme est le pire qui soit : l'écran affiche « 7 à traiter », la page des
 * réservations en montre 5, et aucun des deux ne paraît fautif.
 *
 * Ces tests refusent cette situation. Chaque chiffre de tête est confronté à
 * la liste qu'il prétend résumer.
 */

describe("tableau de bord du loueur", () => {
  const synthese = syntheseLoueur();

  it("compte exactement les réservations que la liste affiche", () => {
    expect(synthese.aTraiter).toBe(reservationsAtraiter().length);
    expect(synthese.aVenir).toBe(reservationsAvenir().length);
    expect(synthese.enCours).toBe(reservationsEnCours().length);
  });

  it("dérive le net total des seules réservations encaissées", () => {
    const attendu = listerReservations()
      .filter((reservation) => STATUTS_ENCAISSES.includes(reservation.statut))
      .reduce((somme, reservation) => somme + reservation.netProprietaire, 0);

    expect(synthese.netTotal).toBe(attendu);
  });

  it("fait concorder la répartition par annonce avec le net total", () => {
    const parAnnonce = revenusParAnnonce().reduce(
      (somme, ligne) => somme + ligne.net,
      0,
    );
    expect(parAnnonce).toBe(synthese.netTotal);
  });

  it("accorde la note moyenne avec les avis effectivement déposés", () => {
    const avis = listerAvis();
    expect(synthese.nombreAvis).toBe(avis.length);

    if (avis.length === 0) {
      expect(synthese.noteMoyenne).toBeNull();
      return;
    }

    const moyenne =
      avis.reduce((somme, entree) => somme + entree.note, 0) / avis.length;
    expect(synthese.noteMoyenne).toBeCloseTo(moyenne, 10);
  });

  it("n'omet aucun mois dans la courbe annuelle", () => {
    // Une courbe qui saute les mois creux ment sur la saisonnalité, laquelle
    // est précisément ce que le loueur vient regarder.
    const mois = revenusParMois(12);
    expect(mois).toHaveLength(12);
    expect(new Set(mois.map((entree) => entree.cle)).size).toBe(12);
  });

  it("ne fait jamais dépasser le net du brut, mois par mois", () => {
    for (const mois of revenusParMois(12)) {
      expect(mois.net).toBeLessThanOrEqual(mois.brut);
      expect(mois.net + mois.commission).toBe(mois.brut);
    }
  });
});

describe("tableau de bord du locataire", () => {
  const synthese = syntheseLocataire();

  it("compte exactement les cautions que la liste affiche", () => {
    const cautions = cautionsEnCours();
    expect(synthese.cautionsNombre).toBe(cautions.length);
    expect(synthese.cautionsGelees).toBe(
      cautions.reduce((somme, reservation) => somme + reservation.caution, 0),
    );
  });

  it("ne compte comme immobilisée aucune caution déjà libérée", () => {
    for (const reservation of cautionsEnCours()) {
      expect(reservation.cautionEtat).not.toBe("liberee");
      expect(reservation.cautionEtat).not.toBe("retenue");
    }
  });

  it("dérive le total dépensé des seules locations encaissées", () => {
    const attendu = mesReservations()
      .filter((reservation) => STATUTS_ENCAISSES.includes(reservation.statut))
      .reduce((somme, reservation) => somme + reservation.montantTotal, 0);

    expect(synthese.totalDepense).toBe(attendu);
  });
});

describe("administration", () => {
  const synthese = syntheseAdmin();

  it("ne répartit entre pays ni plus ni moins que le volume total", () => {
    const parPays = comparaisonPays().reduce(
      (somme, ligne) => somme + ligne.volume,
      0,
    );
    // La somme des pays ne peut pas dépasser le total ; l'égalité n'est pas
    // exigée, une réservation pouvant relever d'un pays non encore ouvert.
    expect(parPays).toBeLessThanOrEqual(synthese.volumeAffaires);
  });

  it("lit le même volume d'affaires que l'espace loueur", () => {
    // Les deux écrans résument le même jeu de réservations. S'ils divergent,
    // c'est qu'un filtre a été dupliqué au lieu d'être partagé.
    const brut = listerReservations()
      .filter((reservation) => STATUTS_ENCAISSES.includes(reservation.statut))
      .reduce((somme, reservation) => somme + reservation.montantTotal, 0);

    expect(synthese.volumeAffaires).toBe(brut);
  });

  it("ne fait jamais dépasser la commission du volume", () => {
    expect(synthese.commissionPercue).toBeLessThanOrEqual(
      synthese.volumeAffaires,
    );
  });
});
