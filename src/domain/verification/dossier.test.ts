import { describe, expect, it } from "vitest";

import {
  avancement,
  manquesPourPublier,
  manquesPourReserver,
  peutPublier,
  peutReserver,
  piecesRequises,
  type EtatVerification,
} from "./dossier";

/**
 * Ce que ces tests protègent : « nul n'agit sans avoir dit qui il est ».
 *
 * La règle a deux lecteurs — la porte du serveur et le bandeau de l'espace. Si
 * l'un des deux se met à juger autrement, le symptôme est celui qu'on redoute
 * le plus : un bouton présenté comme actif, puis un refus après le clic. Les
 * deux appellent donc les mêmes fonctions, et ces tests les tiennent.
 */

const maintenant = new Date(2026, 7, 12);

const complet: EtatVerification = {
  emailVerifie: true,
  identiteStatut: "verifie",
  permisStatut: "verifie",
  permisExpireLe: new Date(2030, 0, 1),
};

describe("publier", () => {
  it("laisse publier un propriétaire vérifié", () => {
    expect(peutPublier(complet)).toBe(true);
  });

  it("refuse tant que l'identité n'est pas vérifiée", () => {
    for (const statut of ["non_soumis", "en_attente", "refuse"] as const) {
      expect(peutPublier({ ...complet, identiteStatut: statut }), statut).toBe(
        false,
      );
    }
  });

  it("ne demande pas le permis au propriétaire", () => {
    // Il remet un bien, il ne le conduit pas. Exiger son permis écarterait
    // sans raison ceux qui n'en ont pas — un loueur professionnel de matériel
    // de chantier, par exemple.
    expect(peutPublier({ ...complet, permisStatut: "non_soumis" })).toBe(true);
  });

  it("refuse tant que l'adresse électronique n'est pas confirmée", () => {
    // Une annonce dont le propriétaire est injoignable ne vaut rien pour
    // personne : ni pour le locataire qui attend une réponse, ni pour la
    // plateforme qui compte une annonce morte dans son catalogue.
    expect(peutPublier({ ...complet, emailVerifie: false })).toBe(false);
  });
});

describe("réserver", () => {
  it("laisse réserver un locataire au dossier complet", () => {
    expect(peutReserver(complet, maintenant)).toBe(true);
  });

  it("exige le permis, à la différence de la publication", () => {
    expect(peutReserver({ ...complet, permisStatut: "non_soumis" }, maintenant)).toBe(
      false,
    );
  });

  it("refuse un permis dont la validité a expiré", () => {
    // Le cas qui compte : la pièce a bien été contrôlée, et elle a cessé
    // d'être valable depuis. Sans cette lecture de la date, un permis vérifié
    // en 2026 ouvrirait encore les locations en 2040.
    const perime = {
      ...complet,
      permisExpireLe: new Date(2026, 0, 1),
    };
    expect(peutReserver(perime, maintenant)).toBe(false);
    expect(manquesPourReserver(perime, maintenant)).toContain("permisExpire");
  });

  it("distingue un permis expiré d'un permis refusé", () => {
    // Dire « refusé » à quelqu'un dont la pièce était bonne serait faux, et
    // il ne saurait pas qu'il lui suffit d'en déposer une à jour.
    const expire = manquesPourReserver(
      { ...complet, permisExpireLe: new Date(2026, 0, 1) },
      maintenant,
    );
    expect(expire).not.toContain("permisRefuse");
  });

  it("ne se plaint pas d'une date de fin absente", () => {
    // Tous les permis ne portent pas de date exploitable — les anciens modèles
    // roses n'en ont pas. Refuser faute d'avoir su lire une date reviendrait à
    // punir le titulaire pour la forme de son document.
    expect(
      peutReserver({ ...complet, permisExpireLe: null }, maintenant),
    ).toBe(true);
  });
});

describe("ce qui manque", () => {
  it("nomme chaque étape du parcours d'une pièce", () => {
    const vierge: EtatVerification = {
      emailVerifie: false,
      identiteStatut: "non_soumis",
      permisStatut: "non_soumis",
      permisExpireLe: null,
    };

    expect(manquesPourReserver(vierge, maintenant)).toEqual([
      "emailNonVerifie",
      "identiteNonSoumise",
      "permisNonSoumis",
    ]);
  });

  it("dit « en attente » plutôt que « manquant » sur une pièce déposée", () => {
    // L'écart n'est pas cosmétique : « manquant » invite à redéposer ce qui
    // est déjà chez nous, et double la file de contrôle.
    expect(
      manquesPourPublier({ ...complet, identiteStatut: "en_attente" }),
    ).toEqual(["identiteEnAttente"]);
  });
});

describe("pièces requises", () => {
  it("demande le permis au locataire, pas au propriétaire seul", () => {
    expect(
      piecesRequises({ profilLocataire: false, profilProprietaire: true }),
    ).toEqual(["identite"]);
    expect(
      piecesRequises({ profilLocataire: true, profilProprietaire: false }),
    ).toEqual(["identite", "permis"]);
  });

  it("ne demande pas deux fois l'identité au compte qui porte les deux profils", () => {
    // « Un compte, deux profils » : la même carte ne se dépose pas deux fois.
    expect(
      piecesRequises({ profilLocataire: true, profilProprietaire: true }),
    ).toEqual(["identite", "permis"]);
  });
});

describe("avancement", () => {
  it("compte une pièce en attente comme faite", () => {
    // L'intéressé n'a plus rien à faire ; une barre incomplète l'inviterait à
    // recommencer.
    expect(
      avancement({ ...complet, identiteStatut: "en_attente" }, ["identite"]),
    ).toEqual({ faits: 2, total: 2 });
  });

  it("ne compte pas une pièce refusée", () => {
    expect(
      avancement({ ...complet, identiteStatut: "refuse" }, ["identite"]),
    ).toEqual({ faits: 1, total: 2 });
  });

  it("compte l'adresse électronique dans le total", () => {
    // Sans elle, un dossier afficherait « 2 sur 2 » tout en restant bloqué.
    expect(
      avancement({ ...complet, emailVerifie: false }, ["identite", "permis"]),
    ).toEqual({ faits: 2, total: 3 });
  });
});
