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
 * Les avis les plus parlants, pour l'accueil et les pages de ville.
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
  villeSlug?: string,
): Promise<{ avis: AvisPublic[]; nombre: number; moyenne: number | null }> {
  const publies = and(
    isNotNull(tableAvis.publieLe),
    eq(tableAvis.masque, false),
    await annonceDuMarche(),
    // Restreint à une ville pour les pages locales : un avis lu sur la page de
    // Lyon doit parler d'une remorque lyonnaise, sans quoi la preuve n'en est
    // plus une — elle devient un argument général posé là.
    villeSlug ? eq(annonce.villeSlug, villeSlug) : undefined,
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
      // Un commentaire d'au moins cinquante caractères : en dessous, c'est
      // « Parfait, merci », qui ne convainc personne. Le seuil est bas à
      // dessein — trop haut, il ne retient rien et la section disparaît,
      // ce qui est pire que trois avis brefs mais sincères.
      .where(and(publies, sql`length(${tableAvis.commentaire}) >= 50`))
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

export type AvisDuMarche = AvisPublic & {
  /** L'annonce notée, pour qu'un avis convaincant mène quelque part. */
  annonce: { titre: string; villeSlug: string; slug: string; ville: string };
};

/**
 * Tous les avis du marché courant, pour la page publique dédiée.
 *
 * **Distincte de la vitrine, et pas par commodité.** `avisEnVitrine` retient
 * les avis les plus flatteurs et les plus longs : c'est un choix légitime pour
 * une accroche d'accueil, où l'on dispose de trois emplacements. Une page
 * intitulée « Avis » qui appliquerait le même tri mentirait — elle
 * présenterait une sélection en la faisant passer pour un ensemble. Ici,
 * l'ordre est chronologique et rien n'est écarté sur la longueur.
 *
 * L'annonce voyage avec l'avis : un témoignage qui convainc doit mener au
 * matériel dont il parle, sans quoi le lecteur convaincu n'a nulle part où
 * aller.
 */
export const avisDuMarche = cache(async function avisDuMarche(
  limite = 60,
): Promise<{
  avis: AvisDuMarche[];
  nombre: number;
  moyenne: number | null;
  repartition: { note: number; nombre: number }[];
}> {
  const publies = and(
    isNotNull(tableAvis.publieLe),
    eq(tableAvis.masque, false),
    await annonceDuMarche(),
  );

  const [agregats, parNote, lignes] = await Promise.all([
    db
      .select({
        nombre: sql<number>`count(*)::int`,
        moyenne: sql<string | null>`avg(${tableAvis.note})`,
      })
      .from(tableAvis)
      .innerJoin(annonce, eq(annonce.id, tableAvis.annonceId))
      .where(publies),

    db
      .select({ note: tableAvis.note, nombre: sql<number>`count(*)::int` })
      .from(tableAvis)
      .innerJoin(annonce, eq(annonce.id, tableAvis.annonceId))
      .where(publies)
      .groupBy(tableAvis.note),

    db
      .select({
        id: tableAvis.id,
        auteur: nomAffiche,
        note: tableAvis.note,
        texte: tableAvis.commentaire,
        date: tableAvis.publieLe,
        reponse: tableAvis.reponse,
        titre: annonce.titre,
        villeSlug: annonce.villeSlug,
        slug: annonce.slug,
        ville: annonce.ville,
      })
      .from(tableAvis)
      .innerJoin(utilisateur, eq(utilisateur.id, tableAvis.auteurId))
      .innerJoin(annonce, eq(annonce.id, tableAvis.annonceId))
      .where(publies)
      // Du plus récent au plus ancien : c'est l'ordre qu'on attend d'une page
      // d'avis, et le seul qui ne trie pas en faveur de la plateforme.
      .orderBy(desc(tableAvis.publieLe))
      .limit(limite),
  ]);

  const compte = agregats[0];
  const compteurs = new Map(parNote.map((ligne) => [ligne.note, ligne.nombre]));

  return {
    avis: lignes.map((ligne) => ({
      id: ligne.id,
      auteur: ligne.auteur,
      note: ligne.note,
      texte: ligne.texte ?? "",
      date: ligne.date as Date,
      reponse: ligne.reponse,
      annonce: {
        titre: ligne.titre,
        villeSlug: ligne.villeSlug,
        slug: ligne.slug,
        ville: ligne.ville,
      },
    })),
    nombre: compte?.nombre ?? 0,
    moyenne:
      compte?.moyenne === null || compte?.moyenne === undefined
        ? null
        : Number(compte.moyenne),
    // Les cinq notes, y compris celles jamais attribuées : un histogramme
    // n'ayant qu'une barre, pleine, se lit comme un sans-faute.
    repartition: [5, 4, 3, 2, 1].map((note) => ({
      note,
      nombre: compteurs.get(note) ?? 0,
    })),
  };
});
