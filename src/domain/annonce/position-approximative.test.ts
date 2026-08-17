import { describe, expect, it } from "vitest";

import {
  approximerPosition,
  distanceM,
  type Position,
} from "./position-approximative";

/**
 * Ce que ces tests protègent : « le point publié n'est pas le vrai point, et
 * ne permet pas de le retrouver ».
 *
 * La fiche publique dessinait un cercle d'imprécision autour du point exact,
 * lequel voyageait dans le HTML. Moissonner le catalogue donnait l'adresse
 * précise de toutes les remorques du pays.
 */

const marseille: Position = { latitude: 43.315549, longitude: 5.386289 };
const oslo: Position = { latitude: 59.9139, longitude: 10.7522 };

describe("déplacement", () => {
  it("ne rend jamais le point d'origine", () => {
    const publie = approximerPosition(marseille, 800, "annonce-1");
    expect(publie).not.toEqual(marseille);
    expect(distanceM(marseille, publie)).toBeGreaterThan(0);
  });

  it("reste à l'intérieur du cercle annoncé", () => {
    // La borne rend le cercle honnête : le matériel est bien quelque part
    // dedans. Un écart plus grand mentirait dans l'autre sens.
    for (let rang = 0; rang < 200; rang += 1) {
      const publie = approximerPosition(marseille, 800, `annonce-${rang}`);
      expect(distanceM(marseille, publie)).toBeLessThanOrEqual(800);
    }
  });

  it("tient compte du rétrécissement des longitudes vers le nord", () => {
    // Sans le cosinus de la latitude, l'écart vers l'est serait deux fois trop
    // petit à Oslo. Le déplacement doit valoir le même nombre de mètres
    // partout, pas le même nombre de degrés.
    const ecarts = Array.from({ length: 60 }, (_, rang) =>
      distanceM(oslo, approximerPosition(oslo, 800, `nord-${rang}`)),
    );
    expect(Math.max(...ecarts)).toBeLessThanOrEqual(800);
    // Et l'on atteint bien les grandes distances : un déplacement écrasé
    // resterait collé au centre.
    expect(Math.max(...ecarts)).toBeGreaterThan(600);
  });
});

describe("stabilité", () => {
  it("rend toujours le même point pour la même graine", () => {
    // La garantie qui compte. Un déplacement retiré à chaque requête
    // paraîtrait plus sûr et serait bien pire : vingt chargements donneraient
    // vingt points autour du vrai, dont la moyenne le désigne.
    const a = approximerPosition(marseille, 800, "annonce-1");
    const b = approximerPosition(marseille, 800, "annonce-1");
    expect(a).toEqual(b);
  });

  it("donne des points différents à deux annonces voisines", () => {
    // Deux remorques dans la même rue ne doivent pas être déplacées du même
    // vecteur : leur écart relatif trahirait la structure du voisinage.
    const a = approximerPosition(marseille, 800, "annonce-1");
    const b = approximerPosition(marseille, 800, "annonce-2");
    expect(distanceM(a, b)).toBeGreaterThan(1);
  });

  it("résiste au moyennage sur un même point", () => {
    // Le scénario d'attaque, écrit noir sur blanc : recharger la même fiche
    // cinquante fois ne rapproche pas du vrai point, puisque la réponse ne
    // change pas.
    const tirages = Array.from({ length: 50 }, () =>
      approximerPosition(marseille, 800, "annonce-1"),
    );

    const moyenne = {
      latitude: tirages.reduce((s, p) => s + p.latitude, 0) / tirages.length,
      longitude: tirages.reduce((s, p) => s + p.longitude, 0) / tirages.length,
    };

    // La moyenne vaut le point publié, pas le point réel.
    expect(distanceM(moyenne, tirages[0])).toBeLessThan(1);
    expect(distanceM(moyenne, marseille)).toBeGreaterThan(1);
  });
});

describe("répartition", () => {
  it("ne concentre pas les points près du centre", () => {
    // Sans racine carrée, les points s'agglutinent au milieu — et le milieu
    // est exactement ce qu'on cherche à ne pas désigner.
    const ecarts = Array.from({ length: 400 }, (_, rang) =>
      distanceM(marseille, approximerPosition(marseille, 800, `x-${rang}`)),
    );

    const lointains = ecarts.filter((ecart) => ecart > 400).length;
    // Une répartition uniforme en surface met les trois quarts des points
    // au-delà de la moitié du rayon.
    expect(lointains / ecarts.length).toBeGreaterThan(0.6);
  });
});

describe("cas limites", () => {
  it("rend le point tel quel si aucun rayon n'est déclaré", () => {
    // Un rayon nul veut dire « pas d'imprécision demandée ». Déplacer quand
    // même produirait une carte fausse sans que personne l'ait voulu.
    expect(approximerPosition(marseille, 0, "annonce-1")).toEqual(marseille);
  });
});
