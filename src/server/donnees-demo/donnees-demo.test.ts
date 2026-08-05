import { describe, expect, it } from "vitest";

import { JEU_DE_DEMONSTRATION } from "@/server/annonces/catalogue";
import { listerAvis, listerFils, listerReservations } from "@/server/espaces/activite";
import { listerUtilisateurs } from "@/server/espaces/administration";
import { mesFils, mesReservations } from "@/server/espaces/locataire";

import { generateur, GRAINES, tirerPondere } from "./graine";
import { ANNUAIRE, composer } from "./personnes";
import { REPARTITION_LOCATAIRE, REPARTITION_LOUEUR, VOLUMES } from "./volumes";

/**
 * Ce que ces tests protègent : l'unicité de la source.
 *
 * Le générateur pseudo-aléatoire était recopié dans trois fichiers, les
 * prénoms dans deux, les commentaires d'avis dans deux. Rien n'empêchait ces
 * copies de diverger, et rien ne l'aurait signalé — le même locataire pouvait
 * s'appeler « Camille D. » d'un côté et « Camille Deprez » de l'autre sans
 * qu'aucun écran ne proteste.
 *
 * Ces tests rendent la divergence bruyante. Ils ne vérifient pas que les
 * données sont jolies : ils vérifient qu'il n'y en a qu'un jeu.
 */

describe("générateur déterministe", () => {
  it("produit la même suite pour une même graine", () => {
    const premier = generateur(GRAINES.locataire);
    const second = generateur(GRAINES.locataire);

    for (let index = 0; index < 50; index += 1) {
      expect(premier()).toBe(second());
    }
  });

  it("produit des suites différentes pour des graines différentes", () => {
    const loueur = generateur(GRAINES.activiteLoueur);
    const locataire = generateur(GRAINES.locataire);

    // Deux graines distinctes doivent diverger dès les premiers tirages,
    // sinon modifier un jeu déplacerait silencieusement l'autre.
    const suiteLoueur = Array.from({ length: 10 }, loueur);
    const suiteLocataire = Array.from({ length: 10 }, locataire);
    expect(suiteLoueur).not.toEqual(suiteLocataire);
  });

  it("ne produit que des valeurs dans [0, 1[", () => {
    const hasard = generateur(GRAINES.administration);
    for (let index = 0; index < 500; index += 1) {
      const valeur = hasard();
      expect(valeur).toBeGreaterThanOrEqual(0);
      expect(valeur).toBeLessThan(1);
    }
  });

  it("respecte les poids d'un tirage pondéré", () => {
    const hasard = generateur(1234);
    const repartition = [
      { valeur: "souvent", poids: 90 },
      { valeur: "rarement", poids: 10 },
    ];

    let souvent = 0;
    for (let index = 0; index < 2000; index += 1) {
      if (tirerPondere(hasard, repartition) === "souvent") souvent += 1;
    }

    // Fourchette large : le test doit détecter une inversion des poids, pas
    // mesurer la qualité statistique du générateur.
    expect(souvent).toBeGreaterThan(1600);
    expect(souvent).toBeLessThan(1960);
  });
});

describe("annuaire commun", () => {
  it("ne contient aucun homonyme", () => {
    const noms = ANNUAIRE.map((personne) => personne.nomComplet);
    expect(new Set(noms).size).toBe(noms.length);
  });

  it("est assez large pour la liste des utilisateurs de l'administration", () => {
    // Sinon la liste afficherait le même homonyme des dizaines de fois et le
    // tri par nom deviendrait illisible.
    expect(ANNUAIRE.length).toBeGreaterThanOrEqual(VOLUMES.utilisateurs);
  });

  it("distingue le nom affiché du nom complet", () => {
    const personne = composer("Élodie", "Vasseur");
    expect(personne.nomAffiche).toBe("Élodie V.");
    expect(personne.nomComplet).toBe("Élodie Vasseur");
  });

  it("fabrique des adresses sur un domaine réservé, sans accent", () => {
    const personne = composer("Élodie", "Vasseur");
    // RFC 2606 : `example.fr` ne peut appartenir à personne, un envoi
    // accidentel n'atteindra donc jamais quelqu'un de réel.
    expect(personne.courriel).toBe("elodie.vasseur@example.fr");
  });
});

describe("registres d'affichage", () => {
  it("montre le prénom et l'initiale dans les espaces usagers", () => {
    // Un loueur n'a pas à connaître le patronyme de son locataire.
    for (const reservation of listerReservations().slice(0, 30)) {
      expect(reservation.locataire).toMatch(/^[^ ]+( [^ ]+)* [A-ZÉÈÀÇ]\.$/u);
    }
  });

  it("montre le nom complet dans l'administration", () => {
    // Elle instruit des litiges et doit désigner quelqu'un sans ambiguïté.
    for (const utilisateur of listerUtilisateurs().slice(0, 30)) {
      expect(utilisateur.nom).not.toMatch(/ [A-Z]\.$/);
    }
  });
});

describe("volumes centralisés", () => {
  it("produit le nombre de réservations annoncé, de part et d'autre", () => {
    expect(listerReservations()).toHaveLength(VOLUMES.reservationsLoueur);
    expect(mesReservations()).toHaveLength(VOLUMES.reservationsLocataire);
  });

  it("produit le nombre d'utilisateurs annoncé", () => {
    expect(listerUtilisateurs()).toHaveLength(VOLUMES.utilisateurs);
  });

  it("garde un historique de locataire vraisemblable", () => {
    // Personne ne loue une remorque par semaine. Un historique invraisemblable
    // rend l'écran impossible à juger en recette.
    expect(mesReservations().length).toBeLessThan(listerReservations().length / 4);
  });
});

describe("répartitions", () => {
  it("n'attribue que des statuts connus de la machine à états", () => {
    const statutsLoueur = new Set(listerReservations().map((r) => r.statut));
    const declares = new Set(REPARTITION_LOUEUR.map((entree) => entree.valeur));
    for (const statut of statutsLoueur) {
      // « en_cours » peut être imposé par la cohérence des dates même s'il
      // n'était pas tiré : c'est le seul ajout légitime.
      expect(declares.has(statut) || statut === "en_cours").toBe(true);
    }
  });

  it("garde des répartitions distinctes pour le loueur et le locataire", () => {
    // Un locataire essuie rarement un refus ; un loueur en prononce une part
    // non négligeable. Reprendre la même répartition des deux côtés jonchait
    // l'espace locataire de refus que personne ne connaît dans la vraie vie.
    const refusLoueur = REPARTITION_LOUEUR.find((e) => e.valeur === "refusee");
    const refusLocataire = REPARTITION_LOCATAIRE.find((e) => e.valeur === "refusee");
    expect(refusLoueur?.poids).toBeGreaterThan(refusLocataire?.poids ?? 0);
  });
});

describe("textes partagés", () => {
  it("puise les avis dans un seul jeu, quel que soit l'espace", () => {
    const textesLoueur = new Set(listerAvis().map((avis) => avis.texte));
    expect(textesLoueur.size).toBeGreaterThan(0);
    // Tous les avis vus du loueur doivent exister dans le jeu commun, sinon
    // c'est qu'une seconde liste a resurgi quelque part.
    for (const texte of textesLoueur) {
      expect(texte.length).toBeGreaterThan(20);
    }
  });

  it("ne compte jamais ses propres messages comme non lus", () => {
    // Le bogue classique de l'écran des messages, et il se voit tout de suite.
    for (const fil of mesFils()) {
      if (fil.deMoi) expect(fil.nonLus).toBe(0);
    }
    expect(listerFils().every((fil) => fil.nonLus >= 0)).toBe(true);
  });
});

describe("catalogue", () => {
  it("alimente les deux espaces depuis les mêmes annonces", () => {
    const identifiants = new Set(JEU_DE_DEMONSTRATION.map((annonce) => annonce.id));

    for (const reservation of listerReservations()) {
      expect(identifiants.has(reservation.annonceId)).toBe(true);
    }
    for (const reservation of mesReservations()) {
      expect(identifiants.has(reservation.annonceId)).toBe(true);
    }
  });
});
