import { afterAll, describe, expect, it } from "vitest";

import { eq, inArray, sql } from "drizzle-orm";

import { db } from "@/server/db";
import {
  annonce,
  caution,
  reservation,
  reservationTransition,
  reversement,
  utilisateur,
} from "@/server/db/schema";

import { demanderReservation } from "./demande";
import { changerStatut, historique } from "./transitions";

/**
 * Le parcours de réservation, éprouvé sur la base.
 *
 * C'est le cœur de la place de marché, et c'est aussi ce qui n'existait pas :
 * les cent quarante réservations de la base avaient toutes été écrites par un
 * script d'amorçage, aucune n'était née d'un clic. Le bouton de la fiche était
 * désactivé, et la machine à états — règle 4 — n'était jamais appelée.
 *
 * Ces tests vérifient les deux moitiés du contrat : ce qui doit marcher, et
 * surtout ce qui doit être refusé. Un moteur de réservation qui accepte tout
 * est plus dangereux qu'un moteur absent : il double les locations, laisse un
 * propriétaire louer chez lui, et permet à un locataire d'accepter sa propre
 * demande.
 */

const creees: string[] = [];

async function contexte() {
  const [locataire] = await db
    .select({ id: utilisateur.id })
    .from(utilisateur)
    .where(eq(utilisateur.email, "moi@demonstration.flexitrailer.eu"))
    .limit(1);

  const [cible] = await db
    .select({ id: annonce.id, proprietaireId: annonce.proprietaireId })
    .from(annonce)
    .where(sql`${annonce.proprietaireId} <> ${locataire.id}`)
    .limit(1);

  return { locataire, cible };
}

/** Dates très éloignées : le calendrier de démonstration ne va pas si loin. */
function periode(dansCombienDeJours: number, duree = 2) {
  const debut = new Date(Date.now() + dansCombienDeJours * 86_400_000);
  debut.setHours(12, 0, 0, 0);
  const fin = new Date(debut.getTime() + duree * 86_400_000);
  return { debut, fin };
}

async function demander(dansCombienDeJours: number, duree = 2) {
  const { locataire, cible } = await contexte();
  const { debut, fin } = periode(dansCombienDeJours, duree);

  const resultat = await demanderReservation({
    annonceId: cible.id,
    locataireId: locataire.id,
    debut,
    fin,
  });

  if (resultat.ok) creees.push(resultat.reservationId);
  return { resultat, locataire, cible };
}

afterAll(async () => {
  if (creees.length === 0) return;
  // L'ordre suit les clés étrangères : les mouvements avant la réservation.
  for (const table of [caution, reversement, reservationTransition]) {
    await db.delete(table).where(inArray(table.reservationId, creees));
  }
  await db.delete(reservation).where(inArray(reservation.id, creees));
});

describe("dépôt d'une demande", () => {
  it("crée une réservation avec sa trace et ses mouvements", async () => {
    const { resultat } = await demander(300);
    expect(resultat.ok).toBe(true);
    if (!resultat.ok) return;

    const [ligne] = await db
      .select({ statut: reservation.statut, total: reservation.totalLocataire })
      .from(reservation)
      .where(eq(reservation.id, resultat.reservationId));

    expect(ligne.statut).toBe("demandee");
    // Le total est calculé par le domaine, pas saisi : un montant nul
    // signalerait un tarif non lu.
    expect(ligne.total).toBeGreaterThan(0);

    // L'état initial fait partie de l'histoire : un journal qui commence à la
    // deuxième transition ne dit pas d'où l'on part.
    const trace = await historique(resultat.reservationId);
    expect(trace).toHaveLength(1);
    expect(trace[0].statutPrecedent).toBeNull();
    expect(trace[0].statutSuivant).toBe("demandee");

    // **Aucune caution à ce stade.** Une demande n'immobilise rien : la carte
    // du locataire n'est engagée qu'au paiement. Créer l'empreinte dès la
    // demande afficherait un montant bloqué qui ne l'est pas — le mensonge
    // exact que l'écran des cautions existe pour éviter.
    const empreintes = await db
      .select({ id: caution.id })
      .from(caution)
      .where(eq(caution.reservationId, resultat.reservationId));
    expect(empreintes).toHaveLength(0);

    // Le reversement, lui, est planifié dès la demande : il porte le montant
    // dû au propriétaire, sans être envoyé.
    const [attendu] = await db
      .select({ statut: reversement.statut })
      .from(reversement)
      .where(eq(reversement.reservationId, resultat.reservationId));
    expect(attendu.statut).toBe("planifie");
  });

  it("ne prend l'empreinte de caution qu'au paiement", async () => {
    const { resultat, cible } = await demander(250);
    if (!resultat.ok) return;

    await changerStatut({
      reservationId: resultat.reservationId,
      evenement: "accepter",
      acteur: "proprietaire",
      acteurId: cible.proprietaireId,
    });

    // Acceptée, toujours rien : le propriétaire a dit oui, la carte n'est pas
    // encore engagée.
    expect(
      await db
        .select({ id: caution.id })
        .from(caution)
        .where(eq(caution.reservationId, resultat.reservationId)),
    ).toHaveLength(0);

    await changerStatut({
      reservationId: resultat.reservationId,
      evenement: "encaisser",
      acteur: "systeme",
    });

    const [empreinte] = await db
      .select({ statut: caution.statut, montant: caution.montant })
      .from(caution)
      .where(eq(caution.reservationId, resultat.reservationId));

    expect(empreinte.statut).toBe("constituee");
    expect(empreinte.montant).toBeGreaterThan(0);
  });

  it("refuse une date déjà passée", async () => {
    const { locataire, cible } = await contexte();
    const resultat = await demanderReservation({
      annonceId: cible.id,
      locataireId: locataire.id,
      debut: new Date(Date.now() - 10 * 86_400_000),
      fin: new Date(Date.now() - 8 * 86_400_000),
    });

    expect(resultat.ok).toBe(false);
    if (!resultat.ok) expect(resultat.cle).toBe("datePassee");
  });

  it("refuse une période déjà réservée", async () => {
    const premier = await demander(400);
    expect(premier.resultat.ok).toBe(true);

    // Exactement les mêmes dates : deux personnes ne peuvent pas payer la
    // même semaine sur le même matériel.
    const second = await demander(400);
    expect(second.resultat.ok).toBe(false);
    if (!second.resultat.ok) expect(second.resultat.cle).toBe("indisponible");
  });

  it("refuse un chevauchement partiel", async () => {
    const premier = await demander(500, 5);
    expect(premier.resultat.ok).toBe(true);

    // Commence pendant la précédente : le chevauchement partiel est le cas
    // qu'une comparaison naïve de dates laisse passer.
    const second = await demander(502, 5);
    expect(second.resultat.ok).toBe(false);
    if (!second.resultat.ok) expect(second.resultat.cle).toBe("indisponible");
  });

  it("refuse de louer son propre matériel", async () => {
    const { cible } = await contexte();
    const { debut, fin } = periode(600);

    const resultat = await demanderReservation({
      annonceId: cible.id,
      locataireId: cible.proprietaireId,
      debut,
      fin,
    });

    expect(resultat.ok).toBe(false);
    if (!resultat.ok) expect(resultat.cle).toBe("proprePropriete");
  });
});

describe("transitions — règle 4", () => {
  it("mène une demande jusqu'au paiement, en traçant chaque étape", async () => {
    const { resultat, cible } = await demander(700);
    expect(resultat.ok).toBe(true);
    if (!resultat.ok) return;

    const acceptation = await changerStatut({
      reservationId: resultat.reservationId,
      evenement: "accepter",
      acteur: "proprietaire",
      acteurId: cible.proprietaireId,
    });
    expect(acceptation).toEqual({ ok: true, statut: "acceptee" });

    const encaissement = await changerStatut({
      reservationId: resultat.reservationId,
      evenement: "encaisser",
      acteur: "systeme",
    });
    expect(encaissement).toEqual({ ok: true, statut: "payee" });

    const trace = await historique(resultat.reservationId);
    expect(trace.map((entree) => entree.statutSuivant)).toEqual([
      "demandee",
      "acceptee",
      "payee",
    ]);
  });

  it("empêche le locataire d'accepter sa propre demande", async () => {
    const { resultat, locataire } = await demander(800);
    if (!resultat.ok) return;

    const usurpation = await changerStatut({
      reservationId: resultat.reservationId,
      evenement: "accepter",
      acteur: "locataire",
      acteurId: locataire.id,
    });

    expect(usurpation.ok).toBe(false);
  });

  it("empêche un tiers d'agir sur une réservation qui ne le concerne pas", async () => {
    const { resultat } = await demander(900);
    if (!resultat.ok) return;

    const [intrus] = await db
      .select({ id: utilisateur.id })
      .from(utilisateur)
      .where(sql`${utilisateur.email} like '%@demonstration.flexitrailer.eu'`)
      .limit(1)
      .offset(50);

    const tentative = await changerStatut({
      reservationId: resultat.reservationId,
      evenement: "accepter",
      acteur: "proprietaire",
      acteurId: intrus.id,
    });

    expect(tentative.ok).toBe(false);
    if (!tentative.ok) expect(tentative.motif).toContain("partie");
  });

  it("interdit de sauter une étape", async () => {
    const { resultat } = await demander(1000);
    if (!resultat.ok) return;

    // Clôturer une demande jamais payée : la table des transitions ne comporte
    // aucune règle pour ce saut, et c'est elle qui fait autorité.
    const saut = await changerStatut({
      reservationId: resultat.reservationId,
      evenement: "cloturer",
      acteur: "systeme",
    });

    expect(saut.ok).toBe(false);
  });

  it("libère la caution quand une location payée est annulée", async () => {
    const { resultat, cible, locataire } = await demander(1100);
    if (!resultat.ok) return;

    await changerStatut({
      reservationId: resultat.reservationId,
      evenement: "accepter",
      acteur: "proprietaire",
      acteurId: cible.proprietaireId,
    });
    await changerStatut({
      reservationId: resultat.reservationId,
      evenement: "encaisser",
      acteur: "systeme",
    });

    await changerStatut({
      reservationId: resultat.reservationId,
      evenement: "annuler",
      acteur: "locataire",
      acteurId: locataire.id,
      motif: "Changement de programme",
    });

    // Une location annulée dont la caution resterait immobilisée est un appel
    // au support garanti.
    const [empreinte] = await db
      .select({ statut: caution.statut })
      .from(caution)
      .where(eq(caution.reservationId, resultat.reservationId));

    expect(empreinte.statut).toBe("liberee");
  });

  it("conserve le motif de la décision", async () => {
    const { resultat, cible } = await demander(1200);
    if (!resultat.ok) return;

    await changerStatut({
      reservationId: resultat.reservationId,
      evenement: "refuser",
      acteur: "proprietaire",
      acteurId: cible.proprietaireId,
      motif: "Le matériel est en réparation",
    });

    // Sans motif, le locataire reçoit un refus sec et écrit au support pour
    // demander pourquoi.
    const trace = await historique(resultat.reservationId);
    expect(trace.at(-1)?.motif).toBe("Le matériel est en réparation");
  });
});
