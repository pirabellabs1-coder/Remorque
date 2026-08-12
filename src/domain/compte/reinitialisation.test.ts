import { describe, expect, it } from "vitest";

import {
  expirationDepuis,
  LONGUEUR_MINIMALE,
  motDePasseRecevable,
  VALIDITE_MINUTES,
  verdictJeton,
} from "./reinitialisation";

/**
 * Ce que ces tests protègent : « un lien de réinitialisation n'ouvre qu'une
 * fois, et pas éternellement ».
 *
 * C'est le point du parcours où l'on prend un compte sans mot de passe. Toute
 * indulgence — un jeton qui resservirait, un jeton sans fin — se paie par un
 * compte perdu, avec ses réservations et ses documents de location.
 */

const maintenant = new Date(2026, 7, 12, 14, 0, 0);

describe("verdict d'un jeton", () => {
  it("ouvre un jeton neuf et non expiré", () => {
    expect(
      verdictJeton(
        { expireLe: new Date(2026, 7, 12, 14, 30), consommeLe: null },
        maintenant,
      ),
    ).toEqual({ valide: true });
  });

  it("refuse un jeton inconnu", () => {
    // Une adresse inventée à la main, ou un lien tronqué par un client de
    // messagerie qui coupe les longues lignes.
    expect(verdictJeton(null, maintenant)).toEqual({
      valide: false,
      cle: "inconnu",
    });
  });

  it("refuse un jeton expiré", () => {
    expect(
      verdictJeton(
        { expireLe: new Date(2026, 7, 12, 13, 59), consommeLe: null },
        maintenant,
      ),
    ).toEqual({ valide: false, cle: "expire" });
  });

  it("refuse un jeton déjà consommé", () => {
    expect(
      verdictJeton(
        {
          expireLe: new Date(2026, 7, 12, 14, 30),
          consommeLe: new Date(2026, 7, 12, 14, 5),
        },
        maintenant,
      ),
    ).toEqual({ valide: false, cle: "dejaUtilise" });
  });

  it("annonce la consommation plutôt que l'expiration quand les deux sont vraies", () => {
    // Le cas qui compte. « Expiré » ferait redemander un lien ; « déjà
    // utilisé » dit que le mot de passe a changé — et si ce n'est pas par soi,
    // c'est le moment de s'en inquiéter.
    expect(
      verdictJeton(
        {
          expireLe: new Date(2026, 7, 12, 13, 0),
          consommeLe: new Date(2026, 7, 12, 12, 30),
        },
        maintenant,
      ),
    ).toEqual({ valide: false, cle: "dejaUtilise" });
  });

  it("refuse à la seconde exacte de l'expiration", () => {
    // Une borne ouverte laisserait passer le jeton pendant sa dernière
    // seconde ; ce n'est pas un cas fréquent, c'est un cas indéfendable.
    expect(
      verdictJeton({ expireLe: maintenant, consommeLe: null }, maintenant),
    ).toEqual({ valide: false, cle: "expire" });
  });
});

describe("expiration", () => {
  it("place l'échéance une heure plus tard", () => {
    const echeance = expirationDepuis(maintenant);
    expect(echeance.getTime() - maintenant.getTime()).toBe(
      VALIDITE_MINUTES * 60_000,
    );
  });
});

describe("mot de passe proposé", () => {
  it("refuse plus court que le minimum de l'inscription", () => {
    // Un parcours de réinitialisation plus permissif que l'inscription serait
    // la porte dérobée du formulaire d'entrée.
    expect(motDePasseRecevable("a".repeat(LONGUEUR_MINIMALE - 1))).toBe(false);
    expect(motDePasseRecevable("a".repeat(LONGUEUR_MINIMALE))).toBe(true);
  });

  it("accepte une phrase entière, sans exiger de symbole", () => {
    expect(motDePasseRecevable("le chat dort sur le toit")).toBe(true);
  });
});
