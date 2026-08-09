import { afterAll, describe, expect, it } from "vitest";

import { eq, inArray, sql } from "drizzle-orm";

import { remboursementAnnulation } from "@/domain/reservation/annulation";
import { db } from "@/server/db";
import {
  annonce,
  caution,
  notification,
  paiement,
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

async function contexte(instantanee = false) {
  const [locataire] = await db
    .select({ id: utilisateur.id })
    .from(utilisateur)
    .where(eq(utilisateur.email, "moi@demonstration.flexitrailer.eu"))
    .limit(1);

  // L'annonce est choisie selon ce que le test éprouve : le parcours manuel
  // — accepter, refuser — exige une annonce **sans** réservation instantanée,
  // sans quoi l'acceptation automatique prend la machine de vitesse et le
  // test mesure autre chose que ce qu'il croit.
  const [cible] = await db
    .select({ id: annonce.id, proprietaireId: annonce.proprietaireId })
    .from(annonce)
    .where(
      sql`${annonce.proprietaireId} <> ${locataire.id}
          and ${annonce.reservationInstantanee} = ${instantanee}`,
    )
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

async function demander(dansCombienDeJours: number, duree = 2, instantanee = false) {
  const { locataire, cible } = await contexte(instantanee);
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

  // Les notifications d'abord : elles ne portent pas la clé étrangère mais la
  // référence, qu'il faut lire avant de supprimer les réservations. Les
  // laisser encombrerait la file d'envoi de courriels d'essai — que
  // `npm run courriels` afficherait comme s'ils étaient vrais.
  const numeros = await db
    .select({ numero: reservation.numero })
    .from(reservation)
    .where(inArray(reservation.id, creees));

  for (const { numero } of numeros) {
    await db.delete(notification).where(sql`${notification.donnees}->>'reference' = ${numero}`);
  }

  // L'ordre suit les clés étrangères : les mouvements avant la réservation.
  for (const table of [caution, reversement, paiement, reservationTransition]) {
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

    // Le reversement non plus n'existe pas encore : rien n'est dû au
    // propriétaire tant que rien n'est encaissé. Une ligne née à la demande
    // affirmerait une dette sans argent — et resterait à jamais « planifiée »
    // sur une demande refusée ou expirée.
    const versements = await db
      .select({ id: reversement.id })
      .from(reversement)
      .where(eq(reversement.reservationId, resultat.reservationId));
    expect(versements).toHaveLength(0);
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

describe("réservation instantanée — M05", () => {
  it("accepte d'elle-même, au nom du propriétaire, et le trace", async () => {
    const { resultat } = await demander(420, 2, true);
    expect(resultat.ok).toBe(true);
    if (!resultat.ok) return;

    expect(resultat.instantanee).toBe(true);

    const [ligne] = await db
      .select({ statut: reservation.statut })
      .from(reservation)
      .where(eq(reservation.id, resultat.reservationId));

    expect(ligne.statut).toBe("acceptee");

    // Deux transitions, pas une : l'instantanéité n'est pas un état de
    // naissance différent, c'est une acceptation ordinaire qui suit la
    // demande — tracée, motivée, au nom de celui qui l'a décidée en
    // publiant l'annonce.
    const trace = await historique(resultat.reservationId);
    expect(trace.map((etape) => etape.statutSuivant)).toEqual([
      "demandee",
      "acceptee",
    ]);
    expect(trace.at(-1)?.acteur).toBe("proprietaire");
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

    // Les deux mouvements naissent au paiement, ensemble : l'empreinte qui
    // garantit le locataire, et le reversement qui porte la dette envers le
    // propriétaire — laquelle n'existe que depuis que l'argent est là.
    const [versement] = await db
      .select({ statut: reversement.statut, montant: reversement.montant })
      .from(reversement)
      .where(eq(reversement.reservationId, resultat.reservationId));
    expect(versement.statut).toBe("planifie");
    expect(versement.montant).toBeGreaterThan(0);
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

  it("rembourse une annulation selon la politique de l'annonce — M05", async () => {
    // Départ très lointain : quel que soit le barème de l'annonce, on est
    // au-dessus de tous les seuils.
    const { resultat, cible, locataire } = await demander(1400);
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

    // Le paiement qu'aurait écrit le webhook Stripe : capture du total.
    const [dossier] = await db
      .select({
        devise: reservation.devise,
        total: reservation.totalLocataire,
        debut: reservation.debut,
        loyer: reservation.loyer,
        remise: reservation.remise,
        fraisService: reservation.fraisService,
        primeAssurance: reservation.primeAssurance,
        fraisLivraison: reservation.fraisLivraison,
        politique: annonce.politiqueAnnulation,
      })
      .from(reservation)
      .innerJoin(annonce, eq(annonce.id, reservation.annonceId))
      .where(eq(reservation.id, resultat.reservationId));

    await db.insert(paiement).values({
      reservationId: resultat.reservationId,
      statut: "capture",
      devise: dossier.devise,
      montant: dossier.total,
      autoriseLe: new Date(),
      captureLe: new Date(),
    });

    const [versementAvant] = await db
      .select({ montant: reversement.montant })
      .from(reversement)
      .where(eq(reversement.reservationId, resultat.reservationId));

    const annulation = await changerStatut({
      reservationId: resultat.reservationId,
      evenement: "annuler",
      acteur: "locataire",
      acteurId: locataire.id,
      motif: "Changement de programme",
    });
    expect(annulation.ok).toBe(true);

    // Le remboursement attendu est celui que le domaine promet pour ces
    // montants-là : le test vérifie le branchement, le barème lui-même a ses
    // propres tests.
    const attendu = remboursementAnnulation({
      politique: dossier.politique,
      annulePar: "locataire",
      heuresAvantDebut: (dossier.debut.getTime() - Date.now()) / 3_600_000,
      loyer: dossier.loyer,
      remise: dossier.remise,
      fraisService: dossier.fraisService,
      primeAssurance: dossier.primeAssurance,
      fraisLivraison: dossier.fraisLivraison,
    });
    expect(attendu.total).toBeGreaterThan(0);

    const [reglement] = await db
      .select({ rembourse: paiement.montantRembourse, statut: paiement.statut })
      .from(paiement)
      .where(eq(paiement.reservationId, resultat.reservationId));

    expect(reglement.rembourse).toBe(attendu.total);
    expect(["rembourse", "rembourse_partiellement"]).toContain(reglement.statut);

    // Le reversement suit le loyer conservé, au prorata exact : rien pour le
    // propriétaire si tout le loyer revient au locataire, la proportion du
    // barème sinon.
    const [versementApres] = await db
      .select({ montant: reversement.montant })
      .from(reversement)
      .where(eq(reversement.reservationId, resultat.reservationId));

    const loyerNet = Math.max(0, dossier.loyer - Math.max(0, dossier.remise));
    const proportionAttendue =
      loyerNet > 0
        ? Math.round((versementAvant.montant * attendu.loyerConserve) / loyerNet)
        : 0;

    expect(versementApres.montant).toBe(proportionAttendue);
  });

  it("plafonne le remboursement quand la charge a déjà été entamée", async () => {
    // Le cas qui se produit après un litige tranché en faveur du locataire :
    // une partie du paiement lui a déjà été rendue, puis la location est
    // annulée. Le barème promet le total, mais la charge ne peut rendre que
    // ce qui reste — et ce qui part à la banque est ce **delta**, pas le
    // total, sans quoi le prestataire rejette l'appel et le relevé annonce un
    // remboursement qui n'a jamais eu lieu.
    const { resultat, cible } = await demander(1500);
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

    const [dossier] = await db
      .select({ devise: reservation.devise, total: reservation.totalLocataire })
      .from(reservation)
      .where(eq(reservation.id, resultat.reservationId));

    // Un tiers de la charge est déjà rendu — l'arbitrage d'hier.
    const dejaRendu = Math.round(dossier.total / 3);

    await db.insert(paiement).values({
      reservationId: resultat.reservationId,
      statut: "rembourse_partiellement",
      devise: dossier.devise,
      montant: dossier.total,
      montantRembourse: dejaRendu,
      autoriseLe: new Date(),
      captureLe: new Date(),
    });

    // Le propriétaire annule : le barème rend tout, donc plus que ce qui
    // reste sur la charge.
    const annulation = await changerStatut({
      reservationId: resultat.reservationId,
      evenement: "annuler",
      acteur: "proprietaire",
      acteurId: cible.proprietaireId,
      motif: "Matériel indisponible",
    });
    expect(annulation.ok).toBe(true);

    const [reglement] = await db
      .select({ rembourse: paiement.montantRembourse, statut: paiement.statut })
      .from(paiement)
      .where(eq(paiement.reservationId, resultat.reservationId));

    // Jamais plus que la charge : le cumul s'arrête au montant payé, il ne
    // s'additionne pas au-delà.
    expect(reglement.rembourse).toBe(dossier.total);
    expect(reglement.statut).toBe("rembourse");
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
