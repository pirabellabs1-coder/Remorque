import "server-only";

import { and, eq, gte, lt, lte, sql } from "drizzle-orm";

import { FENETRE_AVIS_JOURS } from "@/server/donnees-demo";
import { db } from "@/server/db";
import { annonce, avis, notification, reservation, utilisateur } from "@/server/db/schema";

/**
 * Rappels planifiés.
 *
 * Les notifications posées jusqu'ici réagissaient toutes à un événement : une
 * transition, un message. Il manquait celles que déclenche **le temps qui
 * passe** — et ce sont souvent les plus utiles : une demande qui va expirer
 * faute de réponse, un retrait qu'on a oublié, un avis qu'on ne déposera
 * jamais si personne ne le demande.
 *
 * À lancer par une tâche planifiée quotidienne (`npm run rappels`).
 *
 * **Chaque rappel n'est envoyé qu'une fois.** La boîte d'envoi sert de
 * mémoire : avant d'enfiler, on vérifie qu'aucune notification du même gabarit
 * n'existe déjà pour ce destinataire et cette référence. Un rappel quotidien
 * répété est le plus sûr moyen de faire désabonner quelqu'un.
 */

type Rappel = {
  destinataireId: string;
  gabarit: string;
  donnees: Record<string, string>;
};

/** A-t-on déjà écrit ce rappel à cette personne pour cette location ? */
async function dejaEnvoye(rappel: Rappel): Promise<boolean> {
  const [ligne] = await db
    .select({ id: notification.id })
    .from(notification)
    .where(
      and(
        eq(notification.destinataireId, rappel.destinataireId),
        eq(notification.gabarit, rappel.gabarit),
        sql`${notification.donnees}->>'reference' = ${rappel.donnees.reference}`,
      ),
    )
    .limit(1);

  return ligne !== undefined;
}

async function enfiler(rappels: Rappel[]): Promise<number> {
  const aEcrire: Rappel[] = [];

  for (const rappel of rappels) {
    if (await dejaEnvoye(rappel)) continue;
    aEcrire.push(rappel);
  }

  if (aEcrire.length > 0) await db.insert(notification).values(aEcrire);
  return aEcrire.length;
}

/**
 * Demandes qui expirent dans moins de six heures.
 *
 * Adressé au propriétaire, seul à pouvoir agir. Le locataire, lui, n'y peut
 * rien : lui écrire ne ferait qu'annoncer une mauvaise nouvelle en avance.
 */
async function demandesQuiExpirent(): Promise<Rappel[]> {
  const maintenant = new Date();
  const limite = new Date(maintenant.getTime() + 6 * 3_600_000);

  const lignes = await db
    .select({
      numero: reservation.numero,
      annonceTitre: annonce.titre,
      proprietaireId: reservation.proprietaireId,
      prenom: utilisateur.prenom,
      locatairePrenom: sql<string>`(
        select u.prenom from utilisateur u where u.id = ${reservation.locataireId}
      )`,
    })
    .from(reservation)
    .innerJoin(annonce, eq(annonce.id, reservation.annonceId))
    .innerJoin(utilisateur, eq(utilisateur.id, reservation.proprietaireId))
    .where(
      and(
        eq(reservation.statut, "demandee"),
        gte(reservation.expireLe, maintenant),
        lte(reservation.expireLe, limite),
      ),
    );

  return lignes.map((ligne) => ({
    destinataireId: ligne.proprietaireId,
    gabarit: "rappel.demandeExpire",
    donnees: {
      reference: ligne.numero,
      annonceTitre: ligne.annonceTitre,
      prenom: ligne.prenom ?? "",
      interlocuteur: ligne.locatairePrenom ?? "",
    },
  }));
}

/** Retraits du lendemain : rappel aux deux parties, qui doivent se retrouver. */
async function retraitsDeDemain(): Promise<Rappel[]> {
  const demain = new Date();
  demain.setHours(0, 0, 0, 0);
  demain.setDate(demain.getDate() + 1);

  const surlendemain = new Date(demain.getTime() + 86_400_000);

  const lignes = await db
    .select({
      numero: reservation.numero,
      annonceTitre: annonce.titre,
      locataireId: reservation.locataireId,
      proprietaireId: reservation.proprietaireId,
      locatairePrenom: sql<string>`(
        select u.prenom from utilisateur u where u.id = ${reservation.locataireId}
      )`,
      proprietairePrenom: sql<string>`(
        select u.prenom from utilisateur u where u.id = ${reservation.proprietaireId}
      )`,
    })
    .from(reservation)
    .innerJoin(annonce, eq(annonce.id, reservation.annonceId))
    .where(
      and(
        eq(reservation.statut, "confirmee"),
        gte(reservation.debut, demain),
        lt(reservation.debut, surlendemain),
      ),
    );

  return lignes.flatMap((ligne) => [
    {
      destinataireId: ligne.locataireId,
      gabarit: "rappel.retraitProche",
      donnees: {
        reference: ligne.numero,
        annonceTitre: ligne.annonceTitre,
        prenom: ligne.locatairePrenom ?? "",
        interlocuteur: ligne.proprietairePrenom ?? "",
      },
    },
    {
      destinataireId: ligne.proprietaireId,
      gabarit: "rappel.retraitProche",
      donnees: {
        reference: ligne.numero,
        annonceTitre: ligne.annonceTitre,
        prenom: ligne.proprietairePrenom ?? "",
        interlocuteur: ligne.locatairePrenom ?? "",
      },
    },
  ]);
}

/**
 * Avis à écrire, trois jours après la clôture.
 *
 * Ni le lendemain — la location est encore fraîche, on ne sait pas quoi en
 * dire — ni le dernier jour, où le rappel arrive trop tard pour être suivi
 * d'effet.
 */
async function avisAreclamer(): Promise<Rappel[]> {
  const debut = new Date();
  debut.setHours(0, 0, 0, 0);
  debut.setDate(debut.getDate() - 3);
  const fin = new Date(debut.getTime() + 86_400_000);

  const lignes = await db
    .select({
      numero: reservation.numero,
      annonceTitre: annonce.titre,
      locataireId: reservation.locataireId,
      prenom: utilisateur.prenom,
    })
    .from(reservation)
    .innerJoin(annonce, eq(annonce.id, reservation.annonceId))
    .innerJoin(utilisateur, eq(utilisateur.id, reservation.locataireId))
    .where(
      and(
        eq(reservation.statut, "cloturee"),
        gte(reservation.clotureeLe, debut),
        lt(reservation.clotureeLe, fin),
        // Inutile de réclamer un avis déjà déposé.
        sql`not exists (
          select 1 from ${avis} a
          where a.reservation_id = ${reservation.id}
            and a.auteur_id = ${reservation.locataireId}
        )`,
      ),
    );

  return lignes.map((ligne) => ({
    destinataireId: ligne.locataireId,
    gabarit: "rappel.avisAecrire",
    donnees: {
      reference: ligne.numero,
      annonceTitre: ligne.annonceTitre,
      prenom: ligne.prenom ?? "",
      interlocuteur: "",
    },
  }));
}

export type BilanRappels = {
  demandesQuiExpirent: number;
  retraits: number;
  avis: number;
  fenetreAvisJours: number;
};

export async function poserRappels(): Promise<BilanRappels> {
  return {
    demandesQuiExpirent: await enfiler(await demandesQuiExpirent()),
    retraits: await enfiler(await retraitsDeDemain()),
    avis: await enfiler(await avisAreclamer()),
    fenetreAvisJours: FENETRE_AVIS_JOURS,
  };
}
