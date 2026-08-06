import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { db } from "@/server/db";
import { tentativeConnexion } from "@/server/db/schema";
import { eq, like } from "drizzle-orm";

import {
  consignerTentative,
  reinitialiserTentatives,
  tentativeAutorisee,
} from "./limitation";

/**
 * La limitation est le genre de garde qu'on croit en place jusqu'au jour où on
 * l'éprouve. Elle n'a aucun effet visible tant qu'elle fonctionne : la seule
 * façon de savoir qu'elle existe est de la déclencher.
 *
 * Un défaut a d'ailleurs été trouvé en l'écrivant : `max()` revient du pilote
 * sous forme de chaîne, jamais de date. Le calcul du délai levait donc une
 * exception — au moment précis du blocage, c'est-à-dire au seul moment où ce
 * code doit fonctionner. Rien avant ne l'aurait signalé.
 */

const PREFIXE = "test.limitation.";
const IP = "203.0.113.7";

async function nettoyer() {
  await db
    .delete(tentativeConnexion)
    .where(like(tentativeConnexion.courriel, `${PREFIXE}%`));
  await db
    .delete(tentativeConnexion)
    .where(eq(tentativeConnexion.adresseIp, IP));
}

beforeEach(nettoyer);
afterAll(nettoyer);

describe("limitation des tentatives", () => {
  it("laisse passer une adresse sans historique", async () => {
    const verdict = await tentativeAutorisee(`${PREFIXE}neuf@exemple.fr`, IP);
    expect(verdict.autorise).toBe(true);
  });

  it("bloque après huit échecs sur la même adresse", async () => {
    const courriel = `${PREFIXE}cible@exemple.fr`;

    for (let essai = 0; essai < 7; essai += 1) {
      await consignerTentative(courriel, undefined, false);
    }
    // Sept échecs : encore permis. Le seuil se vérifie des deux côtés, sinon
    // un test passe aussi bien avec un seuil de deux qu'avec un seuil de mille.
    expect((await tentativeAutorisee(courriel, undefined)).autorise).toBe(true);

    await consignerTentative(courriel, undefined, false);

    const verdict = await tentativeAutorisee(courriel, undefined);
    expect(verdict.autorise).toBe(false);
    if (!verdict.autorise) {
      // Le délai doit être calculable, non `NaN` : c'est exactement ce que le
      // défaut du pilote produisait.
      expect(Number.isFinite(verdict.secondesAvant)).toBe(true);
      expect(verdict.secondesAvant).toBeGreaterThan(0);
    }
  });

  it("ne compte pas les réussites dans le blocage", async () => {
    const courriel = `${PREFIXE}reussites@exemple.fr`;

    for (let essai = 0; essai < 12; essai += 1) {
      await consignerTentative(courriel, undefined, true);
    }

    expect((await tentativeAutorisee(courriel, undefined)).autorise).toBe(true);
  });

  it("libère l'adresse après une connexion réussie", async () => {
    const courriel = `${PREFIXE}libere@exemple.fr`;

    for (let essai = 0; essai < 8; essai += 1) {
      await consignerTentative(courriel, undefined, false);
    }
    expect((await tentativeAutorisee(courriel, undefined)).autorise).toBe(false);

    await reinitialiserTentatives(courriel);

    // Quelqu'un qui se trompe sept fois puis réussit resterait sinon à un essai
    // du blocage pendant un quart d'heure, pour un compte dont il vient
    // pourtant de prouver qu'il est le titulaire.
    expect((await tentativeAutorisee(courriel, undefined)).autorise).toBe(true);
  });

  it("bloque un balayage réparti sur de nombreuses adresses", async () => {
    // Le scénario que le compteur par adresse électronique ne verrait jamais :
    // un seul mot de passe très répandu, essayé sur des centaines de comptes
    // différents. Chaque adresse ne compte qu'un échec ; c'est l'IP qui trahit.
    for (let essai = 0; essai < 30; essai += 1) {
      await consignerTentative(`${PREFIXE}balayage${essai}@exemple.fr`, IP, false);
    }

    const verdict = await tentativeAutorisee(`${PREFIXE}suivante@exemple.fr`, IP);
    expect(verdict.autorise).toBe(false);
  });

  it("n'écarte pas une adresse innocente partageant la même IP qu'un compte visé", async () => {
    // Huit échecs sur une adresse ne doivent pas bloquer le voisin de bureau :
    // le seuil par IP est bien plus haut, précisément pour cela.
    const courriel = `${PREFIXE}vise@exemple.fr`;
    for (let essai = 0; essai < 8; essai += 1) {
      await consignerTentative(courriel, IP, false);
    }

    expect((await tentativeAutorisee(courriel, IP)).autorise).toBe(false);
    expect(
      (await tentativeAutorisee(`${PREFIXE}voisin@exemple.fr`, IP)).autorise,
    ).toBe(true);
  });

  it("ignore les échecs sortis de la fenêtre", async () => {
    const courriel = `${PREFIXE}ancien@exemple.fr`;
    const ancien = new Date(Date.now() - 60 * 60_000);

    for (let essai = 0; essai < 10; essai += 1) {
      await db
        .insert(tentativeConnexion)
        .values({ courriel, reussie: false, creeLe: ancien });
    }

    // Une heure plus tard, la fenêtre de quinze minutes les a laissés passer :
    // sans expiration, un compte visé une fois resterait bloqué à vie.
    expect((await tentativeAutorisee(courriel, undefined)).autorise).toBe(true);
  });

  it("consigne bien ce qu'on lui demande", async () => {
    const courriel = `${PREFIXE}journal@exemple.fr`;
    await consignerTentative(courriel, IP, false);
    await consignerTentative(courriel, IP, true);

    const lignes = await db
      .select()
      .from(tentativeConnexion)
      .where(eq(tentativeConnexion.courriel, courriel));

    expect(lignes).toHaveLength(2);
    expect(lignes.filter((ligne) => ligne.reussie)).toHaveLength(1);
    // L'adresse électronique est conservée telle quelle même sans compte
    // correspondant : les tentatives sur des adresses inexistantes sont
    // précisément le signe d'un balayage.
    expect(lignes.every((ligne) => ligne.adresseIp === IP)).toBe(true);
  });
});
