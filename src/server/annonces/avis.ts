import "server-only";

import { listerAvis } from "@/server/espaces/activite";

/**
 * Avis d'une annonce, pour la fiche publique.
 *
 * Les avis existaient déjà — l'espace loueur les affiche — mais la fiche
 * publique n'en montrait aucun. C'était le manque le plus coûteux de la page :
 * on y demande à un inconnu de confier plusieurs centaines d'euros de caution,
 * sans lui donner le seul élément qui fonde la confiance sur une place de
 * marché.
 *
 * Ce module est une **vue** sur le dépôt d'activité, pas un second dépôt. Il
 * n'invente rien : il filtre et il agrège. C'est ce qui garantit qu'un avis lu
 * sur la fiche publique et le même avis lu dans l'espace loueur portent le même
 * texte et la même note.
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

/**
 * Les avis d'une annonce, du plus récent au plus ancien.
 *
 * La répartition inclut les notes à zéro occurrence. Omettre les lignes vides
 * ferait paraître excellente une annonce n'ayant reçu que des 3 — l'histogramme
 * n'aurait qu'une barre, pleine, et se lirait comme un sans-faute.
 */
export function avisDeLannonce(annonceId: string, limite?: number): SyntheseAvis {
  const tous = listerAvis()
    .filter((avis) => avis.annonceId === annonceId)
    .sort((a, b) => b.date.getTime() - a.date.getTime());

  const repartition = [5, 4, 3, 2, 1].map((note) => ({
    note,
    nombre: tous.filter((avis) => avis.note === note).length,
  }));

  return {
    avis: (limite === undefined ? tous : tous.slice(0, limite)).map((avis) => ({
      id: avis.id,
      auteur: avis.auteur,
      note: avis.note,
      texte: avis.texte,
      date: avis.date,
      reponse: avis.reponse,
    })),
    nombre: tous.length,
    moyenne:
      tous.length > 0
        ? tous.reduce((somme, avis) => somme + avis.note, 0) / tous.length
        : null,
    repartition,
  };
}

/** Nombre d'annonces publiées par un même loueur, pour situer son activité. */
export function annoncesDuMemeLoueur(prenom: string, annonces: { proprietaire: { prenom: string } }[]): number {
  return annonces.filter((annonce) => annonce.proprietaire.prenom === prenom).length;
}
