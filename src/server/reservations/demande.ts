import "server-only";

import { and, eq, gte, lte, sql } from "drizzle-orm";

import { calculerDevis } from "@/domain/tarification/devis";
import { db } from "@/server/db";
import {
  annonce,
  pays,
  reservation,
  reservationTransition,
  reversement,
  tarif,
} from "@/server/db/schema";
import { enfilerNotificationsReservation } from "@/server/notifications/file";

/**
 * Création d'une demande de réservation.
 *
 * C'est l'acte fondateur du parcours : jusqu'ici, les cent quarante
 * réservations de la base avaient toutes été écrites par un script d'amorçage.
 * Aucune n'était née d'un clic.
 *
 * Trois vérifications précèdent l'écriture, dans cet ordre — de la moins
 * coûteuse à la plus coûteuse, pour ne pas interroger la base quand une date
 * suffit à refuser.
 */

export type ResultatDemande =
  | { ok: true; reservationId: string; numero: string; instantanee: boolean }
  | { ok: false; cle: string };

/** Numéro lisible, communiqué aux deux parties et cité par le support. */
function numeroReservation(debut: Date, suffixe: number): string {
  return `FT-${debut.getFullYear()}-${suffixe.toString().padStart(4, "0")}`;
}

export async function demanderReservation(entree: {
  annonceId: string;
  locataireId: string;
  debut: Date;
  fin: Date;
}): Promise<ResultatDemande> {
  const { annonceId, locataireId, debut, fin } = entree;

  /* ---- 1. Les dates ---- */
  const aujourdhui = new Date();
  aujourdhui.setHours(0, 0, 0, 0);

  if (debut < aujourdhui) return { ok: false, cle: "datePassee" };
  if (fin <= debut) return { ok: false, cle: "dureeInvalide" };

  const nombreJours = Math.ceil((fin.getTime() - debut.getTime()) / 86_400_000);

  /* ---- 2. L'annonce ---- */
  const [ligne] = await db
    .select({
      id: annonce.id,
      proprietaireId: annonce.proprietaireId,
      paysId: annonce.paysId,
      devise: annonce.devise,
      caution: annonce.caution,
      statut: annonce.statut,
      instantanee: annonce.reservationInstantanee,
      dureeMinimum: annonce.dureeMinimumJours,
      dureeMaximum: annonce.dureeMaximumJours,
      prixJour: tarif.prixJour,
      commissionLocataireBp: pays.commissionLocataireBp,
      commissionProprietaireBp: pays.commissionProprietaireBp,
    })
    .from(annonce)
    .leftJoin(tarif, eq(tarif.annonceId, annonce.id))
    .innerJoin(pays, eq(pays.id, annonce.paysId))
    .where(eq(annonce.id, annonceId))
    .limit(1);

  if (!ligne || ligne.statut !== "publiee") return { ok: false, cle: "annonceIndisponible" };

  // Nul ne loue chez soi. Sans ce contrôle, un propriétaire pourrait bloquer
  // son propre calendrier et fausser ses statistiques.
  if (ligne.proprietaireId === locataireId) return { ok: false, cle: "proprePropriete" };

  if (nombreJours < ligne.dureeMinimum) return { ok: false, cle: "dureeTropCourte" };
  if (nombreJours > ligne.dureeMaximum) return { ok: false, cle: "dureeTropLongue" };

  /* ---- 3. La disponibilité ---- */
  //
  // Deux périodes se chevauchent dès que l'une commence avant la fin de
  // l'autre et finit après son début. L'écrire ainsi plutôt qu'en énumérant
  // les cas évite d'oublier celui où la demande englobe une réservation
  // existante.
  const [occupee] = await db
    .select({ id: reservation.id })
    .from(reservation)
    .where(
      and(
        eq(reservation.annonceId, annonceId),
        // Les statuts qui bloquent le calendrier : une demande en attente le
        // bloque aussi, sans quoi deux personnes paieraient la même semaine.
        sql`${reservation.statut} in ('demandee','acceptee','payee','confirmee','en_cours','restituee')`,
        lte(reservation.debut, fin),
        gte(reservation.fin, debut),
      ),
    )
    .limit(1);

  if (occupee) return { ok: false, cle: "indisponible" };

  /* ---- Devis ---- */
  //
  // Les taux viennent de la table `pays`, jamais d'une constante — règle 2.
  const bareme = {
    commissionLocataireBp: ligne.commissionLocataireBp,
    commissionProprietaireBp: ligne.commissionProprietaireBp,
  };

  const devis = calculerDevis({
    prixJour: ligne.prixJour ?? 0,
    nombreJours,
    bareme,
  });

  /* ---- Écriture ---- */
  const [{ suivant }] = await db
    .select({ suivant: sql<number>`coalesce(count(*), 0)::int + 1` })
    .from(reservation);

  const numero = numeroReservation(debut, suivant);

  const cree = await db.transaction(async (tx) => {
    const [nouvelle] = await tx
      .insert(reservation)
      .values({
        numero,
        annonceId,
        locataireId,
        proprietaireId: ligne.proprietaireId,
        paysId: ligne.paysId,
        devise: ligne.devise,
        statut: "demandee",
        debut,
        fin,
        nombreJours,
        loyer: devis.loyer,
        fraisService: devis.fraisService,
        commissionProprietaire: devis.commissionProprietaire,
        montantReverse: devis.montantReverse,
        totalLocataire: devis.totalLocataire,
        caution: ligne.caution,
        // Le barème appliqué est figé dans la réservation : le modifier plus
        // tard depuis l'administration ne doit pas réécrire le passé.
        baremes: bareme,
        // La demande expire si le propriétaire ne répond pas. Sans échéance,
        // un locataire attendrait indéfiniment une réponse qui ne vient pas.
        expireLe: new Date(Date.now() + 48 * 3_600_000),
      })
      .returning({ id: reservation.id });

    // Première trace : l'état initial fait partie de l'histoire, au même titre
    // que les suivants. Un journal qui commence à la deuxième transition ne
    // dit pas d'où l'on part.
    await tx.insert(reservationTransition).values({
      reservationId: nouvelle.id,
      statutPrecedent: null,
      statutSuivant: "demandee",
      acteur: "locataire",
      acteurId: locataireId,
      motif: "Demande déposée",
    });

    // **Aucune caution n'est créée ici.** Une demande n'immobilise rien : la
    // carte du locataire n'est pas engagée tant que le propriétaire n'a pas
    // accepté et que le paiement n'a pas eu lieu. Créer l'empreinte dès la
    // demande ferait afficher au locataire un montant bloqué qui ne l'est pas
    // — le mensonge exact que l'écran des cautions existe pour éviter.
    //
    // Elle naîtra au passage à « payée », dans `transitions.ts`.
    await tx.insert(reversement).values({
      reservationId: nouvelle.id,
      beneficiaireId: ligne.proprietaireId,
      statut: "planifie",
      devise: ligne.devise,
      montant: devis.montantReverse,
      commissionRetenue: devis.commissionProprietaire,
      prevuLe: fin,
    });

    // Le propriétaire est prévenu qu'une demande l'attend — enfilé dans la
    // même transaction : un courriel annonçant une demande qui n'a pas été
    // écrite serait pire que pas de courriel du tout.
    await enfilerNotificationsReservation(tx, nouvelle.id, "demandee");

    return nouvelle;
  });

  return {
    ok: true,
    reservationId: cree.id,
    numero,
    instantanee: ligne.instantanee,
  };
}

/** Périodes déjà prises sur une annonce, pour griser le calendrier. */
export async function periodesOccupees(annonceId: string) {
  return db
    .select({ debut: reservation.debut, fin: reservation.fin })
    .from(reservation)
    .where(
      and(
        eq(reservation.annonceId, annonceId),
        sql`${reservation.statut} in ('demandee','acceptee','payee','confirmee','en_cours','restituee')`,
        gte(reservation.fin, new Date()),
      ),
    )
    .orderBy(reservation.debut);
}
