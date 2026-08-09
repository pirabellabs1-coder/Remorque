import { describe, expect, it } from "vitest";

import { db } from "@/server/db";

/**
 * Règle 6 — gel des fonds, vérifiée sur les lignes réelles.
 *
 * « Un litige ou un sinistre ouvert interdit le transfert au propriétaire et la
 * libération de la caution. »
 *
 * Les tests existants portaient sur ce que les écrans *affichent*. Ceux-ci
 * portent sur ce que la base *contient* — la différence n'est pas théorique :
 * un écran peut afficher le bon total tout en laissant partir un virement,
 * puisque ce ne sont pas les mêmes lignes. Ici, on interroge directement les
 * tables `reversement` et `caution` face aux tables `litige` et `sinistre`.
 *
 * Les deux sens sont vérifiés, et c'est délibéré. Un test qui ne contrôlerait
 * que « tout gel a un dossier » laisserait passer le défaut le plus coûteux :
 * un dossier ouvert dont les fonds partent quand même.
 */

/** Un dossier est ouvert tant qu'il n'est pas tranché. */
const CLAUSE_DOSSIER_OUVERT = `
  EXISTS (
    SELECT 1 FROM litige l
    WHERE l.reservation_id = rv.reservation_id
      AND l.statut NOT IN ('resolu', 'clos_sans_suite')
  )
  OR EXISTS (
    SELECT 1 FROM sinistre s
    WHERE s.reservation_id = rv.reservation_id
      AND s.statut IN ('declare', 'transmis', 'en_cours')
  )
`;

/**
 * Un dossier ouvert **pendant que l'argent était encore là**.
 *
 * Le gel immobilise ce que la plateforme détient — pas ce qui est déjà parti :
 * un dossier ouvert sur une vieille location close, caution rendue et
 * reversement payé, est instruisable mais n'a plus rien à retenir. L'exiger
 * gelé quand même transformerait chaque déclaration tardive en fausse alerte.
 * La borne est la date d'ouverture du dossier face à la date de sortie des
 * fonds ; une sortie sans date compte comme une violation, pas comme une
 * excuse.
 */
function clauseDossierOuvertAvant(sortie: string): string {
  return `
  EXISTS (
    SELECT 1 FROM litige l
    WHERE l.reservation_id = rv.reservation_id
      AND l.statut NOT IN ('resolu', 'clos_sans_suite')
      AND l.cree_le < coalesce(${sortie}, 'infinity'::timestamptz)
  )
  OR EXISTS (
    SELECT 1 FROM sinistre s
    WHERE s.reservation_id = rv.reservation_id
      AND s.statut IN ('declare', 'transmis', 'en_cours')
      AND s.cree_le < coalesce(${sortie}, 'infinity'::timestamptz)
  )
`;
}

async function compter(requete: string): Promise<number> {
  const lignes = await db.execute(requete);
  const premiere = (lignes as unknown as { n: number }[])[0];
  return Number(premiere?.n ?? 0);
}

describe("règle 6 — transfert au propriétaire", () => {
  it("ne gèle aucun reversement sans dossier ouvert", async () => {
    const orphelins = await compter(`
      SELECT count(*)::int AS n FROM reversement rv
      WHERE rv.statut = 'gele' AND NOT (${CLAUSE_DOSSIER_OUVERT})
    `);

    // Un gel sans motif immobilise l'argent d'un propriétaire qui n'a rien
    // fait, et que rien ne permet de débloquer : personne ne sait quel dossier
    // fermer.
    expect(orphelins).toBe(0);
  });

  it("gèle tout reversement dont la location porte un dossier ouvert", async () => {
    const fuites = await compter(`
      SELECT count(*)::int AS n FROM reversement rv
      WHERE rv.statut <> 'gele' AND (${clauseDossierOuvertAvant("rv.envoye_le")})
    `);

    // C'est le défaut coûteux : le virement part alors que le litige est en
    // cours. L'argent est chez le propriétaire, le locataire réclame, et la
    // plateforme paie deux fois.
    expect(fuites).toBe(0);
  });

  it("n'envoie jamais un reversement gelé", async () => {
    const envoyes = await compter(`
      SELECT count(*)::int AS n FROM reversement
      WHERE statut = 'gele' AND envoye_le IS NOT NULL
    `);
    expect(envoyes).toBe(0);
  });

  it("porte un motif sur chaque gel", async () => {
    // Un propriétaire qui voit un versement bloqué sans explication appelle le
    // support. Le motif est donc obligatoire, pas décoratif.
    const sansMotif = await compter(`
      SELECT count(*)::int AS n FROM reversement
      WHERE statut = 'gele' AND (gele_motif IS NULL OR gele_motif = '')
    `);
    expect(sansMotif).toBe(0);
  });
});

describe("règle 6 — libération de la caution", () => {
  it("ne libère aucune caution dont la location porte un dossier ouvert", async () => {
    // Même borne que pour le reversement : une caution rendue avant
    // l'ouverture du dossier n'est pas une fuite, elle est partie à l'heure.
    const liberees = await compter(`
      SELECT count(*)::int AS n FROM caution rv
      WHERE rv.statut = 'liberee' AND (${clauseDossierOuvertAvant("rv.liberee_le")})
    `);
    expect(liberees).toBe(0);
  });

  it("ne date pas la libération d'une caution non libérée", async () => {
    const incoherentes = await compter(`
      SELECT count(*)::int AS n FROM caution
      WHERE statut <> 'liberee' AND liberee_le IS NOT NULL
    `);
    expect(incoherentes).toBe(0);
  });
});

describe("cohérence des mouvements", () => {
  it("exprime tous les montants en entiers de centimes", async () => {
    // Un montant fractionnaire trahirait un flottant qui aurait franchi la
    // frontière — règle 1. La base est le dernier endroit où l'attraper.
    for (const table of ["paiement", "caution", "reversement"]) {
      const fractionnaires = await compter(`
        SELECT count(*)::int AS n FROM ${table} WHERE montant <> round(montant)
      `);
      expect(fractionnaires, table).toBe(0);
    }
  });

  it("ne rembourse jamais plus que le montant payé", async () => {
    const excessifs = await compter(`
      SELECT count(*)::int AS n FROM paiement
      WHERE montant_rembourse > montant
    `);
    expect(excessifs).toBe(0);
  });

  it("ne reverse jamais plus que le total encaissé sur la location", async () => {
    const excessifs = await compter(`
      SELECT count(*)::int AS n
      FROM reversement rv
      JOIN reservation r ON r.id = rv.reservation_id
      WHERE rv.montant + coalesce(rv.commission_retenue, 0) > r.total_locataire
    `);
    expect(excessifs).toBe(0);
  });

  it("n'attache aucun mouvement à une demande jamais payée", async () => {
    // Une demande refusée ou expirée n'a produit ni empreinte ni débit. Un
    // mouvement sur une telle réservation ferait apparaître de l'argent là où
    // il n'y en a jamais eu.
    for (const table of ["paiement", "caution", "reversement"]) {
      const fantomes = await compter(`
        SELECT count(*)::int AS n FROM ${table} m
        JOIN reservation r ON r.id = m.reservation_id
        WHERE r.statut IN ('demandee', 'refusee', 'expiree')
      `);
      expect(fantomes, table).toBe(0);
    }
  });
});
