import { describe, expect, it } from "vitest";

import { STATUTS } from "@/domain/reservation/machine";
import { rendreCourriel } from "@/server/notifications/expediteur";
import { DESTINATAIRES_PAR_STATUT } from "@/server/notifications/file";

/**
 * Ce que ces tests protègent : l'appariement machine ↔ gabarits.
 *
 * Un état ajouté à la machine sans destinataires déclaré, ou un gabarit
 * renommé sans sa clé de traduction, ne se verrait qu'en production — au
 * moment précis où un usager attend son courriel. Ici, l'oubli casse la
 * compilation du jeu de tests.
 */

const DONNEES = {
  reference: "FT-2026-0001",
  annonceTitre: "Benne basculante 750 kg",
  prenom: "Élodie",
  interlocuteur: "Yanis",
};

describe("notifications", () => {
  it("sait qui prévenir pour chaque état de la machine", () => {
    for (const statut of STATUTS) {
      expect(DESTINATAIRES_PAR_STATUT[statut]).toBeDefined();
    }
  });

  it("rend chaque gabarit de réservation sans clé manquante", async () => {
    for (const statut of STATUTS) {
      const rendu = await rendreCourriel(`reservation.${statut}`, DONNEES);

      // Une clé absente ressort telle quelle (« courriels.reservation.x ») :
      // c'est exactement ce que l'assertion attrape.
      expect(rendu.sujet).not.toContain("courriels.");
      expect(rendu.corps).not.toContain("courriels.");

      // Le destinataire est salué par son prénom et retrouve sa référence —
      // les deux variables sans lesquelles un courriel type sent le robot.
      expect(rendu.corps).toContain(DONNEES.prenom);
      expect(rendu.corps).toContain(DONNEES.reference);
    }
  });

  it("rend le gabarit de nouveau message avec l'expéditeur nommé", async () => {
    const rendu = await rendreCourriel("messagerie.nouveauMessage", DONNEES);
    expect(rendu.sujet).toContain(DONNEES.interlocuteur);
    expect(rendu.corps).toContain(DONNEES.annonceTitre);
  });
});
