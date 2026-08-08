import "server-only";

import { and, desc, eq, isNull, ne, or, sql } from "drizzle-orm";
import { cache } from "react";

import { compteConnecte } from "@/server/authentification/session";
import { db } from "@/server/db";
import { annonce, conversation, message, reservation, utilisateur } from "@/server/db/schema";

/**
 * Messagerie.
 *
 * Les fils affichés jusqu'ici étaient dérivés des réservations, avec des
 * amorces prises dans un jeu de textes : les interlocuteurs et les matériels
 * étaient vrais, les messages inventés. On ne pouvait ni écrire ni répondre.
 *
 * Une conversation est rattachée à une réservation, et c'est le point
 * important : sur une place de marché, « bonjour, est-ce disponible samedi ? »
 * n'a de sens qu'à côté du dossier qu'il concerne. Un fil détaché obligerait
 * le support à demander « de quelle location parlez-vous ? » à chaque échange.
 */

export type Fil = {
  id: string;
  reservationId: string | null;
  reference: string | null;
  annonceTitre: string;
  interlocuteur: string;
  dernierMessage: string | null;
  deMoi: boolean;
  date: Date | null;
  nonLus: number;
};

export type MessageFil = {
  id: string;
  contenu: string;
  deMoi: boolean;
  date: Date;
  luLe: Date | null;
  /** Des coordonnées ont été masquées : l'auteur doit savoir que son texte a été altéré. */
  coordonneesMasquees: boolean;
};

/** Prénom et initiale : l'autre partie n'a pas à connaître le patronyme. */
const nomAffiche = sql<string>`
  ${utilisateur.prenom} || coalesce(' ' || left(${utilisateur.nom}, 1) || '.', '')
`;

/**
 * Les fils du compte connecté, quel que soit le côté où il se trouve.
 *
 * Une même personne peut être locataire dans un fil et propriétaire dans un
 * autre : la requête ne présume pas du rôle, elle prend les deux et déduit
 * l'interlocuteur de celui qu'on n'est pas.
 */
export const mesFils = cache(async (): Promise<Fil[]> => {
  const moi = await compteConnecte();
  if (!moi) return [];

  const lignes = await db
    .select({
      id: conversation.id,
      reservationId: conversation.reservationId,
      reference: reservation.numero,
      annonceTitre: annonce.titre,
      locataireId: conversation.locataireId,
      proprietaireId: conversation.proprietaireId,
      date: conversation.dernierMessageLe,
      // Sous-requêtes plutôt que jointures : le dernier message et le compte
      // des non-lus sont deux agrégats différents sur la même table, et les
      // joindre tous deux multiplierait les lignes.
      dernierMessage: sql<string | null>`(
        select m.contenu from message m
        where m.conversation_id = ${conversation.id}
        order by m.cree_le desc limit 1
      )`,
      dernierAuteur: sql<string | null>`(
        select m.auteur_id from message m
        where m.conversation_id = ${conversation.id}
        order by m.cree_le desc limit 1
      )`,
      nonLus: sql<number>`(
        select count(*)::int from message m
        where m.conversation_id = ${conversation.id}
          and m.auteur_id <> ${moi.id}
          and m.lu_le is null
      )`,
    })
    .from(conversation)
    .leftJoin(reservation, eq(reservation.id, conversation.reservationId))
    .leftJoin(annonce, eq(annonce.id, conversation.annonceId))
    .where(
      or(
        eq(conversation.locataireId, moi.id),
        eq(conversation.proprietaireId, moi.id),
      ),
    )
    .orderBy(desc(conversation.dernierMessageLe));

  // Le nom de l'interlocuteur demande une seconde lecture : il dépend du côté
  // où l'on se trouve, ce qu'une jointure fixe ne saurait exprimer.
  const autres = new Set(
    lignes.map((ligne) =>
      ligne.locataireId === moi.id ? ligne.proprietaireId : ligne.locataireId,
    ),
  );

  const noms = new Map(
    autres.size === 0
      ? []
      : (
          await db
            .select({ id: utilisateur.id, nom: nomAffiche })
            .from(utilisateur)
            .where(sql`${utilisateur.id} = any(${sql.raw(`ARRAY['${[...autres].join("','")}']::uuid[]`)})`)
        ).map((ligne) => [ligne.id, ligne.nom] as const),
  );

  return lignes.map((ligne) => {
    const autre =
      ligne.locataireId === moi.id ? ligne.proprietaireId : ligne.locataireId;

    return {
      id: ligne.id,
      reservationId: ligne.reservationId,
      reference: ligne.reference,
      annonceTitre: ligne.annonceTitre ?? "",
      interlocuteur: noms.get(autre) ?? "",
      dernierMessage: ligne.dernierMessage,
      deMoi: ligne.dernierAuteur === moi.id,
      date: ligne.date,
      nonLus: ligne.nonLus,
    };
  });
});

/**
 * Les messages d'un fil, du plus ancien au plus récent.
 *
 * L'accès est vérifié ici et non chez l'appelant : un identifiant de
 * conversation se devine mal, mais se recopie très bien depuis une adresse.
 */
export async function messagesDuFil(conversationId: string): Promise<MessageFil[]> {
  const moi = await compteConnecte();
  if (!moi) return [];

  const [acces] = await db
    .select({ id: conversation.id })
    .from(conversation)
    .where(
      and(
        eq(conversation.id, conversationId),
        or(
          eq(conversation.locataireId, moi.id),
          eq(conversation.proprietaireId, moi.id),
        ),
      ),
    )
    .limit(1);

  if (!acces) return [];

  const lignes = await db
    .select({
      id: message.id,
      contenu: message.contenu,
      auteurId: message.auteurId,
      date: message.creeLe,
      luLe: message.luLe,
      coordonneesMasquees: message.coordonneesMasquees,
    })
    .from(message)
    .where(eq(message.conversationId, conversationId))
    .orderBy(message.creeLe);

  return lignes.map((ligne) => ({
    id: ligne.id,
    contenu: ligne.contenu,
    deMoi: ligne.auteurId === moi.id,
    date: ligne.date,
    luLe: ligne.luLe,
    coordonneesMasquees: ligne.coordonneesMasquees,
  }));
}

/**
 * Marque comme lus les messages reçus dans un fil.
 *
 * Seuls ceux des autres : marquer les siens comme lus est un défaut classique
 * qui fait retomber le compteur à zéro sans qu'on ait rien ouvert.
 */
export async function marquerLus(conversationId: string): Promise<void> {
  const moi = await compteConnecte();
  if (!moi) return;

  await db
    .update(message)
    .set({ luLe: new Date() })
    .where(
      and(
        eq(message.conversationId, conversationId),
        ne(message.auteurId, moi.id),
        isNull(message.luLe),
      ),
    );
}

/** Nombre total de messages non lus, pour la pastille de navigation. */
export const nombreNonLus = cache(async (): Promise<number> => {
  const fils = await mesFils();
  return fils.reduce((somme, fil) => somme + fil.nonLus, 0);
});
