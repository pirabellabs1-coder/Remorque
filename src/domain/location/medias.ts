/**
 * Ce qu'on accepte comme pièce jointe à un état des lieux.
 *
 * Le constat était textuel : cinq points de contrôle, un kilométrage, un
 * commentaire. La table des photos existait pourtant depuis l'origine, avec
 * ses angles imposés et ses annotations — mais rien ne permettait d'y déposer
 * quoi que ce soit. Un constat sans image ne prouve rien : « le plancher était
 * fendu au départ » contre « il ne l'était pas » se tranche par une
 * photographie horodatée, ou ne se tranche pas.
 *
 * **Pourquoi la vidéo, et pas seulement la photo.** Certains défauts ne se
 * photographient pas : un jeu dans l'attelage, un feu qui clignote mal, un
 * grincement de suspension. Dix secondes de vidéo les montrent, là où il
 * faudrait trois photos et un paragraphe — et le paragraphe, personne ne
 * l'écrit sur un parking sous la pluie.
 *
 * Logique pure : aucune base, aucun réseau, aucun accès au disque.
 */

export const TYPES_MEDIA = ["photo", "video"] as const;
export type TypeMedia = (typeof TYPES_MEDIA)[number];

/**
 * Formats acceptés.
 *
 * Trois formats d'image, deux de vidéo, et rien d'autre. La liste est courte
 * exprès : ce sont ceux que produisent les appareils photo des téléphones, et
 * chacun s'affiche nativement dans un navigateur. Accepter davantage
 * obligerait à transcoder — donc à faire attendre quelqu'un debout à côté
 * d'une remorque.
 */
export const FORMATS: Record<TypeMedia, readonly string[]> = {
  photo: ["image/jpeg", "image/png", "image/webp"],
  video: ["video/mp4", "video/quicktime"],
};

/**
 * Tailles maximales, en octets.
 *
 * La vidéo est large — cinquante mégaoctets — parce qu'un téléphone récent
 * filme en haute définition et qu'on ne va pas demander à quelqu'un de régler
 * son appareil avant un état des lieux. Elle reste bornée : au-delà, l'envoi
 * échoue en bordure de réseau, sur un parking, au pire moment.
 */
export const TAILLE_MAXIMUM: Record<TypeMedia, number> = {
  photo: 8 * 1024 * 1024,
  video: 50 * 1024 * 1024,
};

/**
 * Nombre maximal de pièces par constat.
 *
 * Vingt suffisent à faire le tour d'une remorque sous tous les angles. La
 * borne n'est pas là pour économiser du stockage : elle empêche qu'un dépôt
 * lancé par erreur — une pellicule entière sélectionnée d'un geste — bloque
 * la remise du matériel pendant dix minutes.
 */
export const MEDIAS_MAXIMUM = 20;

/** Le minimum pour qu'un constat ait valeur de preuve. */
export const PHOTOS_MINIMUM = 4;

export type RefusMedia = "type" | "taille" | "trop";

/**
 * Ce fichier est-il recevable ?
 *
 * Rend un motif plutôt qu'un booléen : « refusé » sans raison fait recommencer
 * à l'identique, et l'on est sur le terrain.
 */
export function verdictMedia(
  fichier: { typeMime: string; taille: number },
  dejaDeposes: number,
): { ok: true; type: TypeMedia } | { ok: false; motif: RefusMedia } {
  if (dejaDeposes >= MEDIAS_MAXIMUM) return { ok: false, motif: "trop" };

  const type = TYPES_MEDIA.find((candidat) =>
    FORMATS[candidat].includes(fichier.typeMime),
  );

  if (!type) return { ok: false, motif: "type" };
  if (fichier.taille > TAILLE_MAXIMUM[type]) {
    return { ok: false, motif: "taille" };
  }

  return { ok: true, type };
}

/**
 * Le constat porte-t-il assez d'images pour valoir preuve ?
 *
 * Les vidéos ne comptent pas dans ce minimum, et ce n'est pas un oubli : une
 * vidéo se regarde mal en pièce jointe d'un litige, elle ne s'imprime pas, et
 * un assureur demande des photographies. Elle complète, elle ne remplace pas.
 */
export function constatSuffisammentIllustre(
  medias: readonly { type: TypeMedia }[],
): boolean {
  return medias.filter((media) => media.type === "photo").length >= PHOTOS_MINIMUM;
}
