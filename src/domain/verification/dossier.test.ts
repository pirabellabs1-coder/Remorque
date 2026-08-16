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
    expect(peutReserver(complet)).toBe(true);
  });

  it("n'exige pas le permis pour réserver", () => {
    // Celui qui réserve n'est pas nécessairement celui qui conduit : une
    // entreprise réserve pour son employé, quelqu'un organise un déménagement
    // sans prendre le volant. Exiger le permis ici écartait ces cas tout en ne
    // prouvant rien sur le conducteur réel — c'est au constat de départ que le
    // propriétaire relève qui part avec la remorque.
    expect(
      peutReserver({ ...complet, permisStatut: "non_soumis" }),
    ).toBe(true);
  });

  it("ne bloque pas sur un permis expiré", () => {
    // Même raison : la validité du permis du titulaire du compte ne dit rien
    // de celle du conducteur. Elle est relevée sur la pièce présentée à la
    // remise, pas sur une date en base.
    expect(
      peutReserver({ ...complet, permisExpireLe: new Date(2026, 0, 1) }),
    ).toBe(true);
  });

  it("exige en revanche de savoir qui réserve", () => {
    // Quelqu'un répond du matériel, paie la caution et signe le contrat, même
    // s'il ne conduit pas. Cette exigence-là ne bouge pas.
    expect(
      peutReserver({ ...complet, identiteStatut: "non_soumis" }),
    ).toBe(false);
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

    expect(manquesPourReserver(vierge)).toEqual([
      "emailNonVerifie",
      "identiteNonSoumise",
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
  it("propose le permis au locataire, pas au propriétaire seul", () => {
    // « Propose » et non « exige » : le dossier le suggère pour alimenter le
    // calcul de compatibilité d'attelage et éviter de présenter la pièce à
    // chaque retrait, mais son absence n'empêche pas de réserver.
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
