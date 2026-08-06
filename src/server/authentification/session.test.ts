import { describe, expect, it } from "vitest";

import { hacherMotDePasse, verifierMotDePasse } from "./session";

/**
 * Ce que ces tests protègent.
 *
 * Le hachage est le genre de code qui « marche » jusqu'au jour où il ne
 * protège plus rien : une empreinte non salée, une comparaison qui accepte
 * n'importe quoi, un paramètre trop faible. Rien de tout cela ne se voit à
 * l'écran — l'inscription réussit, la connexion réussit, et la fuite se
 * découvre des mois plus tard.
 *
 * Le premier de ces tests a d'ailleurs trouvé un défaut réel : les paramètres
 * choisis dépassaient le plafond mémoire par défaut de Node, et l'appel levait
 * `ERR_CRYPTO_INVALID_SCRYPT_PARAMS`. La compilation passait ; c'est la
 * première inscription qui aurait échoué.
 */

describe("hachage des mots de passe", () => {
  it("accepte le bon mot de passe", async () => {
    const empreinte = await hacherMotDePasse("MotDePasseAssezLong2026");
    expect(await verifierMotDePasse("MotDePasseAssezLong2026", empreinte)).toBe(true);
  });

  it("refuse un mot de passe voisin", async () => {
    const empreinte = await hacherMotDePasse("MotDePasseAssezLong2026");

    for (const essai of [
      "MotDePasseAssezLong2025",
      "motdepasseassezlong2026",
      "MotDePasseAssezLong202",
      "",
    ]) {
      expect(await verifierMotDePasse(essai, empreinte), essai).toBe(false);
    }
  });

  it("sale chaque empreinte", async () => {
    // Deux comptes ayant choisi le même mot de passe doivent produire deux
    // empreintes différentes. Sans sel, une table précalculée les casse toutes
    // les deux d'un coup.
    const [a, b] = await Promise.all([
      hacherMotDePasse("MotDePasseIdentique2026"),
      hacherMotDePasse("MotDePasseIdentique2026"),
    ]);

    expect(a).not.toBe(b);
    expect(await verifierMotDePasse("MotDePasseIdentique2026", a)).toBe(true);
    expect(await verifierMotDePasse("MotDePasseIdentique2026", b)).toBe(true);
  });

  it("ne laisse jamais le mot de passe dans l'empreinte", async () => {
    const empreinte = await hacherMotDePasse("SesameTresParticulier2026");
    expect(empreinte).not.toContain("SesameTresParticulier2026");
  });

  it("normalise les formes Unicode équivalentes", async () => {
    // « é » composé et « é » décomposé s'affichent pareil et se saisissent
    // différemment selon le clavier et le système. Sans normalisation, un
    // usager de macOS ne pourrait pas se connecter depuis Windows.
    const compose = "Café́Interdit2026";
    const decompose = compose.normalize("NFC");

    const empreinte = await hacherMotDePasse(compose);
    expect(await verifierMotDePasse(decompose, empreinte)).toBe(true);
  });

  it("refuse une empreinte d'algorithme inconnu", async () => {
    // Un jour, on changera d'algorithme. Ce test garantit qu'une ancienne
    // empreinte ne sera pas acceptée par accident au lieu d'être migrée.
    expect(await verifierMotDePasse("peu importe", "md5$abc$def")).toBe(false);
  });
});
