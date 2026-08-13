"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { verdictMedia, type RefusMedia } from "@/domain/location/medias";
import { compteConnecte } from "@/server/authentification/session";
import { db } from "@/server/db";
import { etatDesLieux, etatDesLieuxPhoto, reservation } from "@/server/db/schema";
import { cheminObjet, deposerObjet, retirerObjet } from "@/server/stockage/objets";
import { typeReel } from "@/server/stockage/signature-image";

/**
 * Pièces jointes d'un état des lieux — photographies et vidéos.
 *
 * **Le constat existe avant ses pièces.** On ne peut pas rattacher une photo à
 * un constat qui n'a pas encore de ligne : le dépôt crée donc le constat au
 * besoin, en brouillon, sans signature ni finalisation. C'est ce qui permet de
 * photographier d'abord et de signer ensuite — l'ordre réel sur le terrain,
 * où l'on fait le tour du matériel avant de se mettre d'accord.
 *
 * **Une seule partie suffit à déposer.** Locataire ou propriétaire, peu
 * importe : ils sont côte à côte, et exiger que ce soit le titulaire de
 * l'appareil ferait recommencer si c'est l'autre qui tient le téléphone. Ce
 * qui doit être contradictoire, c'est la signature — pas la prise de vue.
 */

export type BilanMedia = {
  deposes: number;
  refus: RefusMedia[];
};

/** Vérifie que le compte est partie à cette réservation, et rend le constat. */
async function constatAccessible(
  reservationId: string,
  type: "depart" | "retour",
  compteId: string,
): Promise<{ id: string; deja: number } | null> {
  const [dossier] = await db
    .select({
      locataireId: reservation.locataireId,
      proprietaireId: reservation.proprietaireId,
    })
    .from(reservation)
    .where(eq(reservation.id, reservationId))
    .limit(1);

  if (!dossier) return null;
  if (dossier.locataireId !== compteId && dossier.proprietaireId !== compteId) {
    return null;
  }

  const [existant] = await db
    .select({ id: etatDesLieux.id })
    .from(etatDesLieux)
    .where(
      and(
        eq(etatDesLieux.reservationId, reservationId),
        eq(etatDesLieux.type, type),
      ),
    )
    .limit(1);

  const constatId =
    existant?.id ??
    (
      await db
        .insert(etatDesLieux)
        .values({ reservationId, type, controles: {} })
        .returning({ id: etatDesLieux.id })
    )[0].id;

  const pieces = await db
    .select({ id: etatDesLieuxPhoto.id })
    .from(etatDesLieuxPhoto)
    .where(eq(etatDesLieuxPhoto.etatDesLieuxId, constatId));

  return { id: constatId, deja: pieces.length };
}

/**
 * Dépose des pièces sur un constat.
 *
 * Les fichiers sont examinés un par un et refusés isolément : sur un parking,
 * une sélection de huit photos dont une est illisible ne doit pas faire perdre
 * les sept autres.
 */
export async function deposerMedias(donnees: FormData): Promise<BilanMedia> {
  const moi = await compteConnecte();
  if (!moi) return { deposes: 0, refus: ["type"] };

  const reservationId = String(donnees.get("reservation") ?? "");
  const type = String(donnees.get("type") ?? "") as "depart" | "retour";
  const angle = String(donnees.get("angle") ?? "libre");

  if (!reservationId || (type !== "depart" && type !== "retour")) {
    return { deposes: 0, refus: ["type"] };
  }

  const constat = await constatAccessible(reservationId, type, moi.id);
  if (!constat) return { deposes: 0, refus: ["type"] };

  const fichiers = donnees
    .getAll("medias")
    .filter((entree): entree is File => entree instanceof File && entree.size > 0);

  const refus: RefusMedia[] = [];
  let deposes = 0;
  let compte = constat.deja;

  for (const fichier of fichiers) {
    const verdict = verdictMedia(
      { typeMime: fichier.type, taille: fichier.size },
      compte,
    );

    if (!verdict.ok) {
      refus.push(verdict.motif);
      // Inutile de poursuivre si le constat est plein : les suivants
      // recevraient tous le même refus.
      if (verdict.motif === "trop") break;
      continue;
    }

    const octets = new Uint8Array(await fichier.arrayBuffer());

    // Les images sont reconnues à leurs premiers octets, comme partout
    // ailleurs : le type déclaré par le navigateur est fixé par la page qui
    // envoie. Les vidéos échappent à ce contrôle — leurs conteneurs sont trop
    // variés pour une signature courte — et c'est un compromis assumé : elles
    // ne sont servies qu'aux deux parties et à l'administration, jamais
    // publiquement, et jamais interprétées comme du code.
    let extension: string;
    if (verdict.type === "photo") {
      const reel = typeReel(octets);
      if (!reel) {
        refus.push("type");
        continue;
      }
      extension = reel;
    } else {
      extension = fichier.type === "video/quicktime" ? "mov" : "mp4";
    }

    const url = await deposerObjet(
      cheminObjet(`constats/${constat.id}`, extension),
      octets,
      fichier.type,
    );

    await db.insert(etatDesLieuxPhoto).values({
      etatDesLieuxId: constat.id,
      angle,
      media: verdict.type,
      typeMime: fichier.type,
      url,
      // L'horodatage de la prise de vue est celui du dépôt : le fichier porte
      // parfois une date d'appareil, souvent fausse, jamais vérifiable. Mieux
      // vaut une date dont on sait ce qu'elle vaut.
      priseLe: new Date(),
    });

    deposes += 1;
    compte += 1;
  }

  revalidatePath("/", "layout");
  return { deposes, refus };
}

/** Retire une pièce, et l'objet stocké avec elle. */
export async function retirerMedia(donnees: FormData): Promise<{ ok: boolean }> {
  const moi = await compteConnecte();
  if (!moi) return { ok: false };

  const mediaId = String(donnees.get("media") ?? "");
  if (!mediaId) return { ok: false };

  const [ligne] = await db
    .select({
      url: etatDesLieuxPhoto.url,
      finaliseLe: etatDesLieux.finaliseLe,
      locataireId: reservation.locataireId,
      proprietaireId: reservation.proprietaireId,
    })
    .from(etatDesLieuxPhoto)
    .innerJoin(etatDesLieux, eq(etatDesLieux.id, etatDesLieuxPhoto.etatDesLieuxId))
    .innerJoin(reservation, eq(reservation.id, etatDesLieux.reservationId))
    .where(eq(etatDesLieuxPhoto.id, mediaId))
    .limit(1);

  if (!ligne) return { ok: false };
  if (ligne.locataireId !== moi.id && ligne.proprietaireId !== moi.id) {
    return { ok: false };
  }

  // Un constat signé ne se modifie plus. C'est le principe même d'une pièce
  // contradictoire : retirer une photo après signature reviendrait à changer
  // ce que l'autre a accepté.
  if (ligne.finaliseLe) return { ok: false };

  await db.delete(etatDesLieuxPhoto).where(eq(etatDesLieuxPhoto.id, mediaId));
  await retirerObjet(ligne.url);

  revalidatePath("/", "layout");
  return { ok: true };
}
