import { describe, expect, it } from "vitest";

import { espaceDaccueil, profilsDuRole, ROLES } from "./roles";

/**
 * Le rôle choisi à l'inscription décide de deux choses : les profils écrits en
 * base, et l'espace où l'on atterrit. Les deux se trompent en silence — un
 * compte se crée, une page s'affiche, et c'est seulement la personne devant
 * l'écran qui constate qu'elle n'est pas au bon endroit.
 */

describe("traduction du rôle en profils", () => {
  it("donne à chaque rôle les profils attendus", () => {
    expect(profilsDuRole("locataire")).toEqual({
      profilLocataire: true,
      profilProprietaire: false,
    });
    expect(profilsDuRole("proprietaire")).toEqual({
      profilLocataire: false,
      profilProprietaire: true,
    });
  });

  it("n'engendre jamais un compte sans aucun profil", () => {
    // Un compte sans profil se connecterait pour arriver nulle part : les
    // gardes le renverraient d'un espace à l'autre indéfiniment.
    for (const role of ROLES) {
      const profils = profilsDuRole(role);
      expect(profils.profilLocataire || profils.profilProprietaire, role).toBe(true);
    }
  });

  it("couvre exactement les deux rôles proposés", () => {
    // Si un troisième rôle apparaît dans l'interface sans être traité ici, ce
    // test tombe — plutôt qu'un compte créé avec des profils muets.
    expect([...ROLES]).toEqual(["locataire", "proprietaire"]);
  });

  it("n'active qu'un seul profil à l'inscription", () => {
    // Le choix d'entrée n'est pas un choix définitif : les deux booléens
    // demeurent en base, et le second profil s'active depuis les paramètres.
    // Mais on n'en ouvre qu'un, pour ne pas déposer quelqu'un dans un espace
    // qu'il n'a pas demandé.
    for (const role of ROLES) {
      const profils = profilsDuRole(role);
      expect(
        Number(profils.profilLocataire) + Number(profils.profilProprietaire),
        role,
      ).toBe(1);
    }
  });
});

describe("espace d'accueil", () => {
  it("mène le loueur pur vers son espace", () => {
    expect(
      espaceDaccueil({ profilLocataire: false, profilProprietaire: true }),
    ).toBe("/proprietaire");
  });

  it("mène le locataire, et le compte mixte, vers l'espace locataire", () => {
    // Le locataire l'emporte quand les deux profils sont actifs : c'est le
    // côté par lequel on entre le plus souvent, et la bascule est à un clic
    // dans la navigation.
    expect(
      espaceDaccueil({ profilLocataire: true, profilProprietaire: false }),
    ).toBe("/compte");
    expect(
      espaceDaccueil({ profilLocataire: true, profilProprietaire: true }),
    ).toBe("/compte");
  });

  it("mène chaque rôle vers un espace que sa garde laisse passer", () => {
    // Le vrai risque : un rôle dont l'espace d'accueil est protégé par un
    // profil qu'il n'a pas. La garde redirige, la destination redirige en
    // retour, et le navigateur tourne en rond.
    for (const role of ROLES) {
      const profils = profilsDuRole(role);
      const destination = espaceDaccueil(profils);

      const autorise =
        destination === "/proprietaire"
          ? profils.profilProprietaire
          : profils.profilLocataire;

      expect(autorise, `${role} → ${destination}`).toBe(true);
    }
  });
});
