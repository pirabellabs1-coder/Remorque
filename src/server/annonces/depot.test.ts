import { beforeEach, describe, expect, it } from "vitest";

import {
  annoncesDeLaVille,
  rechercherAnnonces,
  trouverAnnonce,
} from "./catalogue";
import {
  ajouterAnnonce,
  listerAnnonces,
  supprimerAnnonce,
  type BrouillonAnnonce,
} from "./depot";

/**
 * Ce que ces tests protègent : la promesse « ce que je publie est visible ».
 *
 * Une annonce déposée depuis l'espace loueur doit apparaître dans le catalogue
 * public — recherche, page de la ville, fiche — et non seulement dans la liste
 * du propriétaire. C'est précisément le raccord que le passage à PostgreSQL
 * risquerait de casser sans que rien ne le signale, puisque chaque écran
 * fonctionnerait encore isolément.
 */

const BROUILLON: BrouillonAnnonce = {
  titre: "Porte-moto essai automatisé",
  categorie: "porte-moto",
  villeSlug: "bruxelles",
  description:
    "Remorque d'essai créée par la suite de tests, avec une description assez longue.",
  prixJour: 4200,
  caution: 30000,
  ptacKg: 750,
  poidsVideKg: 180,
  longueurUtileMm: 2200,
  largeurUtileMm: 1400,
  freinee: false,
  reservationInstantanee: true,
  equipements: ["Sangles", "Rampe"],
  politiqueAnnulation: "moderee",
};

/** Retire les annonces laissées par un test précédent. */
function nettoyer() {
  for (const annonce of [...listerAnnonces()]) {
    if (annonce.titre.includes("essai automatisé")) supprimerAnnonce(annonce.id);
  }
}

describe("dépôt des annonces", () => {
  beforeEach(nettoyer);

  it("rend l'annonce publiée visible dans le catalogue public", async () => {
    const annonce = ajouterAnnonce(BROUILLON);

    const fiche = await trouverAnnonce("bruxelles", annonce.slug);
    expect(fiche?.titre).toBe(BROUILLON.titre);

    const deLaVille = await annoncesDeLaVille("bruxelles");
    expect(deLaVille.map((entree) => entree.id)).toContain(annonce.id);

    const resultats = await rechercherAnnonces({ ville: "bruxelles" });
    expect(resultats.annonces.map((entree) => entree.id)).toContain(annonce.id);
    expect(resultats.total).toBe(resultats.annonces.length);
  });

  it("calcule la charge utile et n'invente ni note ni avis", () => {
    const annonce = ajouterAnnonce(BROUILLON);

    expect(annonce.chargeUtileKg).toBe(
      BROUILLON.ptacKg - BROUILLON.poidsVideKg,
    );
    // Zéro serait faux : une annonce neuve n'est pas notée zéro, elle n'est
    // pas encore notée. L'interface doit pouvoir distinguer les deux.
    expect(annonce.note).toBeNull();
    expect(annonce.nombreAvis).toBe(0);
  });

  it("conserve les montants en centiemes entiers", () => {
    const annonce = ajouterAnnonce(BROUILLON);

    expect(Number.isInteger(annonce.prixJour)).toBe(true);
    expect(Number.isInteger(annonce.caution)).toBe(true);
    expect(annonce.prixJour).toBe(4200);
    expect(annonce.devise).toBe("EUR");
  });

  it("distingue deux annonces de même titre dans la même ville", () => {
    const premiere = ajouterAnnonce(BROUILLON);
    const seconde = ajouterAnnonce(BROUILLON);

    expect(seconde.slug).not.toBe(premiere.slug);
    expect(seconde.slug.startsWith(premiere.slug)).toBe(true);
  });

  it("refuse une ville ou une catégorie inconnue", () => {
    expect(() =>
      ajouterAnnonce({ ...BROUILLON, villeSlug: "atlantide" }),
    ).toThrow();
    expect(() =>
      ajouterAnnonce({ ...BROUILLON, categorie: "soucoupe" as never }),
    ).toThrow();
  });

  it("retire l'annonce du catalogue public à la suppression", async () => {
    const annonce = ajouterAnnonce(BROUILLON);
    expect(supprimerAnnonce(annonce.id)).toBe(true);

    expect(await trouverAnnonce("bruxelles", annonce.slug)).toBeNull();
    expect(supprimerAnnonce(annonce.id)).toBe(false);
  });
});
