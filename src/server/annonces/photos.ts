import "server-only";

import { and, asc, eq, sql as raw } from "drizzle-orm";

import { PHOTOS_MAXIMUM } from "@/domain/annonce/publication";
import { db } from "@/server/db";
import { annonce, annoncePhoto } from "@/server/db/schema";
import {
  cheminDepuisUrl,
  cheminObjet,
  deposerObjet,
  retirerObjet,
} from "@/server/stockage/objets";

/**
 * Photos d'annonces.
 *
 * Jusqu'ici, publier une annonce y accrochait la photo générique de sa
 * catégorie : deux bennes déposées par deux propriétaires différents
 * montraient la même image. Sur une place de marché, la photo *est*
 * l'annonce — c'est elle qui dit l'état réel du matériel, et c'est sur elle
 * que se règle le litige à la restitution.
 *
 * Tout passe par ici, y compris le contrôle de propriété : une action serveur
 * est une adresse publique (voir le guide Next), et l'identifiant d'annonce
 * qu'elle reçoit vient du navigateur. Vérifier ailleurs, ou pas du tout,
 * reviendrait à laisser n'importe qui déposer une photo sur l'annonce d'autrui.
 */

/**
 * Types acceptés.
 *
 * HEIC des iPhone n'y figure pas volontairement : le navigateur le convertit
 * déjà en JPEG au moment de la réduction côté client, et un HEIC brut déposé
 * tel quel ne s'afficherait sur aucun navigateur de bureau.
 */
const TYPES_ACCEPTES = new Set(["image/jpeg", "image/png", "image/webp"]);

/**
 * Taille maximale d'un fichier reçu, après la réduction faite par le
 * navigateur. Elle reste large : la réduction peut échouer sur un appareil
 * ancien, et il vaut mieux accepter l'original que refuser la photo.
 */
const TAILLE_MAXIMUM = 6 * 1024 * 1024;

export type PhotoAnnonce = {
  id: string;
  url: string;
  ordre: number;
};

/**
 * Reconnaît une image à ses premiers octets.
 *
 * Le type déclaré par le navigateur ne prouve rien : il est fixé par la page
 * qui envoie, donc par quiconque sait faire une requête. Sans cette
 * vérification, le compartiment public deviendrait un hébergeur de fichiers
 * arbitraires sous notre nom de domaine.
 */
function typeReel(octets: Uint8Array): "jpeg" | "png" | "webp" | null {
  if (octets.length < 12) return null;

  if (octets[0] === 0xff && octets[1] === 0xd8 && octets[2] === 0xff) {
    return "jpeg";
  }

  if (
    octets[0] === 0x89 &&
    octets[1] === 0x50 &&
    octets[2] === 0x4e &&
    octets[3] === 0x47
  ) {
    return "png";
  }

  const texte = (debut: number, fin: number) =>
    String.fromCharCode(...octets.slice(debut, fin));

  if (texte(0, 4) === "RIFF" && texte(8, 12) === "WEBP") return "webp";

  return null;
}

/** Les photos d'une annonce, dans leur ordre d'affichage. */
export async function photosDeLAnnonce(
  annonceId: string,
): Promise<PhotoAnnonce[]> {
  return db
    .select({
      id: annoncePhoto.id,
      url: annoncePhoto.url,
      ordre: annoncePhoto.ordre,
    })
    .from(annoncePhoto)
    .where(eq(annoncePhoto.annonceId, annonceId))
    .orderBy(asc(annoncePhoto.ordre));
}

/**
 * Vérifie que l'annonce appartient bien au propriétaire, et la rend.
 *
 * Une seule requête, avec les deux identifiants dans le `where` : chercher
 * l'annonce puis comparer le propriétaire en JavaScript laisse la place à
 * l'oubli d'un `if`.
 */
async function annonceDuProprietaire(
  annonceId: string,
  proprietaireId: string,
): Promise<{ id: string } | null> {
  const [ligne] = await db
    .select({ id: annonce.id })
    .from(annonce)
    .where(
      and(eq(annonce.id, annonceId), eq(annonce.proprietaireId, proprietaireId)),
    )
    .limit(1);

  return ligne ?? null;
}

export type RefusPhoto = "trop" | "type" | "taille" | "introuvable";

export type BilanDepot = {
  deposees: number;
  refus: RefusPhoto[];
};

/**
 * Dépose des photos sur une annonce.
 *
 * Les fichiers refusés le sont un par un : sur un téléphone, une sélection de
 * huit photos dont une est un fichier illisible ne doit pas faire perdre les
 * sept autres.
 */
export async function ajouterPhotos(
  annonceId: string,
  proprietaireId: string,
  fichiers: File[],
  dimensions: { largeur: number; hauteur: number }[] = [],
): Promise<BilanDepot> {
  if (!(await annonceDuProprietaire(annonceId, proprietaireId))) {
    return { deposees: 0, refus: ["introuvable"] };
  }

  const existantes = await photosDeLAnnonce(annonceId);
  let ordre = existantes.reduce((max, photo) => Math.max(max, photo.ordre), -1);
  let restantes = PHOTOS_MAXIMUM - existantes.length;

  const refus: RefusPhoto[] = [];
  let deposees = 0;

  for (const [rang, fichier] of fichiers.entries()) {
    if (restantes <= 0) {
      refus.push("trop");
      break;
    }

    if (fichier.size > TAILLE_MAXIMUM) {
      refus.push("taille");
      continue;
    }

    if (!TYPES_ACCEPTES.has(fichier.type)) {
      refus.push("type");
      continue;
    }

    const octets = new Uint8Array(await fichier.arrayBuffer());
    const reel = typeReel(octets);
    if (!reel) {
      refus.push("type");
      continue;
    }

    const url = await deposerObjet(
      cheminObjet(`annonces/${annonceId}`, reel),
      octets,
      `image/${reel}`,
    );

    ordre += 1;
    restantes -= 1;
    deposees += 1;

    const mesure = dimensions[rang];
    await db.insert(annoncePhoto).values({
      annonceId,
      url,
      ordre,
      largeur: mesure?.largeur,
      hauteur: mesure?.hauteur,
    });
  }

  return { deposees, refus };
}

/**
 * Retire une photo.
 *
 * L'objet est supprimé après la ligne : si le stockage refuse, la photo a tout
 * de même disparu de l'annonce, ce qui est ce que le propriétaire a demandé.
 * L'inverse laisserait une annonce pointant vers une image effacée.
 */
export async function retirerPhoto(
  photoId: string,
  proprietaireId: string,
): Promise<boolean> {
  const [ligne] = await db
    .select({ url: annoncePhoto.url, annonceId: annoncePhoto.annonceId })
    .from(annoncePhoto)
    .innerJoin(annonce, eq(annonce.id, annoncePhoto.annonceId))
    .where(
      and(
        eq(annoncePhoto.id, photoId),
        eq(annonce.proprietaireId, proprietaireId),
      ),
    )
    .limit(1);

  if (!ligne) return false;

  await db.delete(annoncePhoto).where(eq(annoncePhoto.id, photoId));

  const chemin = cheminDepuisUrl(ligne.url);
  if (chemin) await retirerObjet(chemin);

  await resserrerOrdre(ligne.annonceId);
  return true;
}

/**
 * Déplace une photo d'un rang vers le haut ou vers le bas.
 *
 * Deux boutons plutôt qu'un glisser-déposer : le glisser-déposer est
 * inutilisable au clavier, pénible au doigt sur une liste qui défile, et la
 * première photo — celle qui sert de couverture dans toute la recherche — est
 * précisément celle qu'on veut pouvoir désigner sans se battre avec le pouce.
 */
export async function deplacerPhoto(
  photoId: string,
  proprietaireId: string,
  sens: "avant" | "apres",
): Promise<boolean> {
  const [ligne] = await db
    .select({ annonceId: annoncePhoto.annonceId, ordre: annoncePhoto.ordre })
    .from(annoncePhoto)
    .innerJoin(annonce, eq(annonce.id, annoncePhoto.annonceId))
    .where(
      and(
        eq(annoncePhoto.id, photoId),
        eq(annonce.proprietaireId, proprietaireId),
      ),
    )
    .limit(1);

  if (!ligne) return false;

  const photos = await photosDeLAnnonce(ligne.annonceId);
  const rang = photos.findIndex((photo) => photo.id === photoId);
  const cible = sens === "avant" ? rang - 1 : rang + 1;

  if (rang < 0 || cible < 0 || cible >= photos.length) return false;

  // Échange des deux rangs, puis réécriture complète : plus simple à suivre
  // qu'un jeu de deux `update` croisés, et l'ordre reste contigu.
  [photos[rang], photos[cible]] = [photos[cible], photos[rang]];

  await Promise.all(
    photos.map((photo, position) =>
      db
        .update(annoncePhoto)
        .set({ ordre: position })
        .where(eq(annoncePhoto.id, photo.id)),
    ),
  );

  return true;
}

/**
 * Renumérote les photos de 0 à n−1.
 *
 * Après une suppression, l'ordre garde un trou. Il ne se voit pas à
 * l'affichage — le tri reste correct — mais il fait dériver le rang de la
 * photo de couverture au fil des suppressions et des ajouts.
 */
async function resserrerOrdre(annonceId: string): Promise<void> {
  await db.execute(raw`
    update annonce_photo
    set ordre = rang.position
    from (
      select id, (row_number() over (order by ordre) - 1)::smallint as position
      from annonce_photo
      where annonce_id = ${annonceId}
    ) as rang
    where annonce_photo.id = rang.id
  `);
}
