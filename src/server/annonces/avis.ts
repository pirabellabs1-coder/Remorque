import "server-only";

import { cache } from "react";

import { and, desc, eq, isNotNull, sql } from "drizzle-orm";

import { db } from "@/server/db";
import { annonce, avis as tableAvis, utilisateur } from "@/server/db/schema";
import { annonceDuMarche } from "@/server/annonces/marche";

/**
 * Avis d'une annonce, pour la fiche publique.
 *
 * Les avis existaient déjà — l'espace loueur les affiche — mais la fiche
 * publique n'en montrait aucun. C'était le manque le plus coûteux de la page :
 * on y demande à un inconnu de confier plusieurs centaines d'euros de caution,
 * sans lui donner le seul élément qui fonde la confiance sur une place de
 * marché.
 *
 * Les avis sont lus **pour l'annonce demandée**, et non filtrés après coup. La
 * première version appelait le dépôt d'activité, qui rapatriait les
 * cinquante-sept avis du site entier pour en retenir quatre : la fiche mettait
 * 4,6 secondes à s'afficher. Le filtre appartient à la requête, pas au
 * JavaScript.
 *
 * Ce module reste une **vue**, pas un second dépôt : il n'invente rien, il
 * filtre et il agrège. Un avis lu sur la fiche publique et le même avis lu dans
 * l'espace loueur portent le même texte et la même note.
 */

export type AvisPublic = {
  id: string;
  auteur: string;
  note: number;
  texte: string;
  date: Date;
  reponse: string | null;
};

export type SyntheseAvis = {
  avis: AvisPublic[];
  nombre: number;
  moyenne: number | null;
  /** Cinq entrées, de 5 étoiles à 1 — y compris les notes jamais attribuées. */
  repartition: { note: number; nombre: number }[];
};

/** Prénom et initiale : la fiche publique ne nomme jamais entièrement un client. */
const nomAffiche = sql<string>`
  ${utilisateur.prenom} || coalesce(' ' || left(${utilisateur.nom}, 1) || '.', '')
`;

/**
 * Les avis d'une annonce, du plus récent au plus ancien.
 *
 * La répartition inclut les notes à zéro occurrence. Omettre les lignes vides
 * ferait paraître excellente une annonce n'ayant reçu que des 3 —
 * l'histogramme n'aurait qu'une barre, pleine, et se lirait comme un
 * sans-faute.
 *
 * Le comptage et la moyenne portent sur **tous** les avis de l'annonce, même
 * quand `limite` n'en affiche que quelques-uns : « 4,8 sur 24 avis » au-dessus
 * de quatre commentaires est exact, tandis qu'une moyenne calculée sur les
 * quatre affichés serait fausse et flatteuse.
 */
/**
 * Les avis les plus parlants du marché courant, pour l'accueil.
 *
 * Sélectionnés sur la longueur du commentaire et non sur la note : « Parfait »
 * ne convainc personne, tandis qu'un locataire qui raconte son déménagement
 * dit quelque chose de la plateforme. Les avis restent réels, publiés et non
 * masqués — la vitrine n'a pas de jeu d'avis à elle.
 *
 * La moyenne et le décompte portent sur **tous** les avis du marché, jamais
 * sur les quelques-uns montrés : afficher « 4,8 » calculé sur trois
 * commentaires choisis serait une flatterie, et une fausse.
 */
export const avisEnVitrine = cache(async function avisEnVitrine(
  limite = 3,
): Promise<{ avis: AvisPublic[]; nombre: number; moyenne: number | null }> {
  const publies = and(
    isNotNull(tableAvis.publieLe),
    eq(tableAvis.masque, false),
    await annonceDuMarche(),
  );

  const [agregats, lignes] = await Promise.all([
    db
      .select({
        nombre: sql<number>`count(*)::int`,
        moyenne: sql<string | null>`avg(${tableAvis.note})`,
      })
      .from(tableAvis)
      .innerJoin(annonce, eq(annonce.id, tableAvis.annonceId))
      .where(publies),

    db
      .select({
        id: tableAvis.id,
        auteur: nomAffiche,
        note: tableAvis.note,
        texte: tableAvis.commentaire,
        date: tableAvis.publieLe,
        reponse: tableAvis.reponse,
      })
      .from(tableAvis)
      .innerJoin(utilisateur, eq(utilisateur.id, tableAvis.auteurId))
      .innerJoin(annonce, eq(annonce.id, tableAvis.annonceId))
      .where(and(publies, sql`length(${tableAvis.commentaire}) > 80`))
      .orderBy(desc(tableAvis.note), desc(sql`length(${tableAvis.commentaire})`))
      .limit(limite),
  ]);

  const compte = agregats[0];

  return {
    avis: lignes.map((ligne) => ({
      id: ligne.id,
      auteur: ligne.auteur,
      note: ligne.note,
      texte: ligne.texte ?? "",
      date: ligne.date as Date,
      reponse: ligne.reponse,
    })),
    nombre: compte?.nombre ?? 0,
    moyenne: compte?.moyenne === null || compte?.moyenne === undefined
      ? null
      : Number(compte.moyenne),
  };
});

export const avisDeLannonce = cache(async function avisDeLannonce(
  annonceId: string,
  limite?: number,
): Promise<SyntheseAvis> {
  const publies = and(
    eq(tableAvis.annonceId, annonceId),
    isNotNull(tableAvis.publieLe),
    eq(tableAvis.masque, false),
  );

  const [agregats, lignes] = await Promise.all([
    db
      .select({
        nombre: sql<number>`count(*)::int`,
        moyenne: sql<string | null>`avg(${tableAvis.note})`,
        // La répartition est comptée par la base en une passe, plutôt que par
        // cinq filtres successifs sur un tableau rapatrié.
        note5: sql<number>`count(*) filter (where ${tableAvis.note} = 5)::int`,
        note4: sql<number>`count(*) filter (where ${tableAvis.note} = 4)::int`,
        note3: sql<number>`count(*) filter (where ${tableAvis.note} = 3)::int`,
        note2: sql<number>`count(*) filter (where ${tableAvis.note} = 2)::int`,
        note1: sql<number>`count(*) filter (where ${tableAvis.note} = 1)::int`,
      })
      .from(tableAvis)
      .where(publies),

    db
      .select({
        id: tableAvis.id,
        auteur: nomAffiche,
        note: tableAvis.note,
        texte: tableAvis.commentaire,
        date: tableAvis.publieLe,
        reponse: tableAvis.reponse,
      })
      .from(tableAvis)
      .innerJoin(utilisateur, eq(utilisateur.id, tableAvis.auteurId))
      .where(publies)
      .orderBy(desc(tableAvis.publieLe))
      .limit(limite ?? 1000),
  ]);

  const compte = agregats[0];

  return {
    avis: lignes.map((ligne) => ({
      id: ligne.id,
      auteur: ligne.auteur,
      note: ligne.note,
      texte: ligne.texte ?? "",
      date: ligne.date!,
      reponse: ligne.reponse,
    })),
    nombre: compte?.nombre ?? 0,
    // `avg` rend une chaîne : PostgreSQL refuse de perdre de la précision à
    // notre place. Une annonce sans avis n'a pas de note, ce qui ne se dit pas
    // « 0 ».
    moyenne: compte?.moyenne == null ? null : Number(compte.moyenne),
    repartition: [
      { note: 5, nombre: compte?.note5 ?? 0 },
      { note: 4, nombre: compte?.note4 ?? 0 },
      { note: 3, nombre: compte?.note3 ?? 0 },
      { note: 2, nombre: compte?.note2 ?? 0 },
      { note: 1, nombre: compte?.note1 ?? 0 },
    ],
  };
});
