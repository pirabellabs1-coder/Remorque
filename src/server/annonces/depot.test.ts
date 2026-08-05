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
 * du propriétaire. C'est exactement le raccord que le passage à PostgreSQL a
 * cassé : le catalogue lisait déjà la base quand le dépôt écrivait encore en
 * mémoire, et chaque écran continuait de fonctionner isolément. Ces deux tests
 * sont les seuls à avoir vu la rupture.
 *
 * Ce sont désormais des tests d'intégration : ils écrivent et lisent une vraie
 * base. Sans `DATABASE_URL`, ils sont **ignorés et signalés comme tels**,
 * jamais silencieusement réputés verts — un test qui ne s'exécute pas ne
 * prouve rien, et doit le dire.
 */

const baseDisponible = Boolean(process.env.DATABASE_URL);

if (!baseDisponible) {
  console.warn(
    "Tests d'integration du depot ignores : DATABASE_URL absente. " +
      "Renseignez « .env.local » puis relancez pour les executer.",
  );
}

const BROUILLON: BrouillonAnnonce = {
  titre: "Porte-moto essai automatise",
  categorie: "porte-moto",
  villeSlug: "bruxelles",
  description:
    "Remorque d'essai creee par la suite de tests, avec une description assez longue.",
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
async function nettoyer() {
  for (const annonce of await listerAnnonces()) {
    if (annonce.titre.includes("essai automatise")) {
      await supprimerAnnonce(annonce.id);
    }
  }
}

describe.skipIf(!baseDisponible)("dépôt des annonces", () => {
  beforeEach(nettoyer);

  it("rend l'annonce publiée visible dans le catalogue public", async () => {
    const annonce = await ajouterAnnonce(BROUILLON);

    const fiche = await trouverAnnonce("bruxelles", annonce.slug);
    expect(fiche?.titre).toBe(BROUILLON.titre);

    const deLaVille = await annoncesDeLaVille("bruxelles");
    expect(deLaVille.map((entree) => entree.id)).toContain(annonce.id);

    const resultats = await rechercherAnnonces({ ville: "bruxelles" });
    expect(resultats.annonces.map((entree) => entree.id)).toContain(annonce.id);
    expect(resultats.total).toBe(resultats.annonces.length);
  });

  it("calcule la charge utile et n'invente ni note ni avis", async () => {
    const annonce = await ajouterAnnonce(BROUILLON);

    expect(annonce.chargeUtileKg).toBe(
      BROUILLON.ptacKg - BROUILLON.poidsVideKg,
    );
    // Zéro serait faux : une annonce neuve n'est pas notée zéro, elle n'est
    // pas encore notée. L'interface doit pouvoir distinguer les deux.
    expect(annonce.note).toBeNull();
    expect(annonce.nombreAvis).toBe(0);
  });

  it("conserve les montants en centiemes entiers", async () => {
    const annonce = await ajouterAnnonce(BROUILLON);

    expect(Number.isInteger(annonce.prixJour)).toBe(true);
    expect(Number.isInteger(annonce.caution)).toBe(true);
    expect(annonce.prixJour).toBe(4200);
    expect(annonce.devise).toBe("EUR");
  });

  it("distingue deux annonces de même titre dans la même ville", async () => {
    const premiere = await ajouterAnnonce(BROUILLON);
    const seconde = await ajouterAnnonce(BROUILLON);

    expect(seconde.slug).not.toBe(premiere.slug);
    expect(seconde.slug.startsWith(premiere.slug)).toBe(true);
  });

  it("refuse une ville ou une catégorie inconnue", async () => {
    await expect(
      ajouterAnnonce({ ...BROUILLON, villeSlug: "atlantide" }),
    ).rejects.toThrow();
    await expect(
      ajouterAnnonce({ ...BROUILLON, categorie: "soucoupe" as never }),
    ).rejects.toThrow();
  });

  it("retire l'annonce du catalogue public à la suppression", async () => {
    const annonce = await ajouterAnnonce(BROUILLON);
    expect(await supprimerAnnonce(annonce.id)).toBe(true);

    expect(await trouverAnnonce("bruxelles", annonce.slug)).toBeNull();
    // Une seconde suppression ne trouve plus rien : elle rend « faux » plutôt
    // que de lever, car supprimer ce qui n'existe plus n'est pas une erreur.
    expect(await supprimerAnnonce(annonce.id)).toBe(false);
  });
});
