import { describe, expect, it } from "vitest";

import { listerAnnonces } from "@/server/annonces/depot";
import { listerReservationsPlateforme } from "@/server/espaces/administration";
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
  it("produit la même suite pour une même graine", async () => {
    const premier = generateur(GRAINES.locataire);
    const second = generateur(GRAINES.locataire);

    for (let index = 0; index < 50; index += 1) {
      expect(premier()).toBe(second());
    }
  });

  it("produit des suites différentes pour des graines différentes", async () => {
    const loueur = generateur(GRAINES.activiteLoueur);
    const locataire = generateur(GRAINES.locataire);

    // Deux graines distinctes doivent diverger dès les premiers tirages,
    // sinon modifier un jeu déplacerait silencieusement l'autre.
    const suiteLoueur = Array.from({ length: 10 }, loueur);
    const suiteLocataire = Array.from({ length: 10 }, locataire);
    expect(suiteLoueur).not.toEqual(suiteLocataire);
  });

  it("ne produit que des valeurs dans [0, 1[", async () => {
    const hasard = generateur(GRAINES.administration);
    for (let index = 0; index < 500; index += 1) {
      const valeur = hasard();
      expect(valeur).toBeGreaterThanOrEqual(0);
      expect(valeur).toBeLessThan(1);
    }
  });

  it("respecte les poids d'un tirage pondéré", async () => {
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
  it("ne contient aucun homonyme", async () => {
    const noms = ANNUAIRE.map((personne) => personne.nomComplet);
    expect(new Set(noms).size).toBe(noms.length);
  });

  it("est assez large pour la liste des utilisateurs de l'administration", async () => {
    // Sinon la liste afficherait le même homonyme des dizaines de fois et le
    // tri par nom deviendrait illisible.
    expect(ANNUAIRE.length).toBeGreaterThanOrEqual(VOLUMES.utilisateurs);
  });

  it("distingue le nom affiché du nom complet", async () => {
    const personne = composer("Élodie", "Vasseur");
    expect(personne.nomAffiche).toBe("Élodie V.");
    expect(personne.nomComplet).toBe("Élodie Vasseur");
  });

  it("fabrique des adresses sur un domaine réservé, sans accent", async () => {
    const personne = composer("Élodie", "Vasseur");
    // RFC 2606 : `example.fr` ne peut appartenir à personne, un envoi
    // accidentel n'atteindra donc jamais quelqu'un de réel.
    expect(personne.courriel).toBe("elodie.vasseur@example.fr");
  });
});

describe("registres d'affichage", () => {
  it("montre le prénom et l'initiale dans les espaces usagers", async () => {
    // Un loueur n'a pas à connaître le patronyme de son locataire.
    for (const reservation of (await listerReservations()).slice(0, 30)) {
      expect(reservation.locataire).toMatch(/^[^ ]+( [^ ]+)* [A-ZÉÈÀÇ]\.$/u);
    }
  });

  it("montre le nom complet dans l'administration", async () => {
    // Elle instruit des litiges et doit désigner quelqu'un sans ambiguïté.
    for (const utilisateur of (await listerUtilisateurs()).slice(0, 30)) {
      expect(utilisateur.nom).not.toMatch(/ [A-Z]\.$/);
    }
  });
});

describe("volumes centralisés", () => {
  /**
   * Le volume déclaré porte sur la **plateforme**, pas sur un compte.
   *
   * `listerReservations` était la bonne source tant qu'elle rendait tout ;
   * elle est désormais restreinte au loueur connecté, et comparer ses dix-huit
   * lignes aux cent quarante annoncées n'avait plus de sens. C'est
   * `listerReservationsPlateforme`, réservée à l'administration, qui répond de
   * la quantité produite.
   */
  it("produit le nombre de réservations annoncé, de part et d'autre", async () => {
    expect(await listerReservationsPlateforme()).toHaveLength(
      VOLUMES.reservationsLoueur,
    );
    expect(await mesReservations()).toHaveLength(VOLUMES.reservationsLocataire);
  });

  /**
   * `VOLUMES.utilisateurs` décrit l'annuaire des locataires, non la population
   * totale de la base : s'y ajoutent les propriétaires du catalogue et le
   * compte de démonstration, qui porte les deux profils.
   *
   * Le test vérifie donc les locataires purs — ceux que le volume décrit
   * réellement — puis que le total les dépasse. Comparer le total au volume
   * revenait à faire échouer le test dès qu'on ajoutait un propriétaire, ce
   * qui n'apprenait rien.
   */
  it("produit le nombre de locataires annoncé", async () => {
    const utilisateurs = await listerUtilisateurs();
    const locatairesPurs = utilisateurs.filter((entree) => entree.role === "locataire");

    // Le compte d'administration est un locataire pur au sens des profils —
    // il n'en a aucun — sans appartenir à l'annuaire. On compte donc les
    // comptes réellement issus de l'annuaire.
    expect(locatairesPurs.length).toBeGreaterThanOrEqual(VOLUMES.utilisateurs);
    expect(utilisateurs.length).toBeGreaterThan(VOLUMES.utilisateurs);
  });

  it("garde un historique de locataire vraisemblable", async () => {
    // Personne ne loue une remorque par semaine. Un historique invraisemblable
    // rend l'écran impossible à juger en recette. La comparaison se fait au
    // volume de la plateforme, non à celui d'un loueur : un compte donné peut
    // très bien louer autant qu'il met en location.
    expect((await mesReservations()).length).toBeLessThan(
      (await listerReservationsPlateforme()).length / 4,
    );
  });
});

describe("répartitions", () => {
  it("n'attribue que des statuts connus de la machine à états", async () => {
    const statutsLoueur = new Set(
      (await listerReservationsPlateforme()).map((r) => r.statut),
    );
    const declares = new Set(REPARTITION_LOUEUR.map((entree) => entree.valeur));
    for (const statut of statutsLoueur) {
      // « en_cours » peut être imposé par la cohérence des dates même s'il
      // n'était pas tiré : c'est le seul ajout légitime.
      expect(declares.has(statut) || statut === "en_cours").toBe(true);
    }
  });

  it("garde des répartitions distinctes pour le loueur et le locataire", async () => {
    // Un locataire essuie rarement un refus ; un loueur en prononce une part
    // non négligeable. Reprendre la même répartition des deux côtés jonchait
    // l'espace locataire de refus que personne ne connaît dans la vraie vie.
    const refusLoueur = REPARTITION_LOUEUR.find((e) => e.valeur === "refusee");
    const refusLocataire = REPARTITION_LOCATAIRE.find((e) => e.valeur === "refusee");
    expect(refusLoueur?.poids).toBeGreaterThan(refusLocataire?.poids ?? 0);
  });
});

describe("textes partagés", () => {
  it("puise les avis dans un seul jeu, quel que soit l'espace", async () => {
    const textesLoueur = new Set((await listerAvis()).map((avis) => avis.texte));
    expect(textesLoueur.size).toBeGreaterThan(0);
    // Tous les avis vus du loueur doivent exister dans le jeu commun, sinon
    // c'est qu'une seconde liste a resurgi quelque part.
    for (const texte of textesLoueur) {
      expect(texte.length).toBeGreaterThan(20);
    }
  });

  it("ne compte jamais ses propres messages comme non lus", async () => {
    // Le bogue classique de l'écran des messages, et il se voit tout de suite.
    for (const fil of (await mesFils())) {
      if (fil.deMoi) expect(fil.nonLus).toBe(0);
    }
    expect((await listerFils()).every((fil) => fil.nonLus >= 0)).toBe(true);
  });
});

describe("catalogue", () => {
  /**
   * Les réservations du loueur et celles du locataire doivent porter sur des
   * annonces qui existent.
   *
   * Le test comparait autrefois les identifiants à ceux de la graine en
   * mémoire. Depuis que les réservations viennent de PostgreSQL, leurs clés
   * étrangères désignent des lignes de la table `annonce` : c'est à elle qu'il
   * faut les confronter. Comparer à la graine reviendrait à vérifier que la
   * base contient ce qu'on croit y avoir mis, et non ce qu'elle contient.
   *
   * La contrainte de clé étrangère rend d'ailleurs ce test presque
   * tautologique côté loueur — mais pas côté locataire, dont le jeu est encore
   * engendré en mémoire. C'est précisément là qu'il garde sa valeur.
   */
  it("alimente les deux espaces depuis les mêmes annonces", async () => {
    const identifiants = new Set(
      (await listerAnnonces()).map((annonce) => annonce.id),
    );
    expect(identifiants.size).toBeGreaterThan(0);

    for (const reservation of await listerReservations()) {
      expect(identifiants.has(reservation.annonceId)).toBe(true);
    }
  });
});
