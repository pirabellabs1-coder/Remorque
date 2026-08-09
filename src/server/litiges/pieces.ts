"use server";

import { and, eq, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { gelActif, type StatutLitige } from "@/domain/litige/machine";
import { compteConnecte } from "@/server/authentification/session";
import { db } from "@/server/db";
import { litige, litigePiece, reservation, utilisateur } from "@/server/db/schema";

/**
 * Pièces du dossier de litige.
 *
 * Une pièce est une déclaration versée au dossier : un témoignage, la
 * référence d'un devis, la description d'une photographie. Elle est datée,
 * signée de son auteur, et **jamais modifiable ni supprimable** — un dossier
 * dont les pièces bougent après coup n'est plus un dossier, c'est un
 * brouillon. Se tromper se corrige en versant une pièce de plus.
 *
 * Les fichiers eux-mêmes — photographies, devis PDF — attendent le stockage
 * objet (`S3_*` dans la configuration). D'ici là, seule la déclaration écrite
 * est possible, et le formulaire le dit plutôt que d'afficher un champ de
 * téléversement qui échouerait.
 */

export type Reponse = { ok: true } | { ok: false; cle: string };

const schema = z.object({
  litigeId: z.string().uuid(),
  commentaire: z.string().trim().min(10).max(2000),
});

export async function verserPiece(donnees: FormData): Promise<Reponse> {
  const moi = await compteConnecte();
  if (!moi) return { ok: false, cle: "connexionRequise" };

  const analyse = schema.safeParse({
    litigeId: donnees.get("litigeId"),
    commentaire: donnees.get("commentaire"),
  });

  if (!analyse.success) return { ok: false, cle: "invalide" };

  // Partie au dossier, ou arbitre : la clause le vérifie, le dossier d'autrui
  // n'est pas même rapporté.
  const [dossier] = await db
    .select({ id: litige.id, statut: litige.statut })
    .from(litige)
    .innerJoin(reservation, eq(reservation.id, litige.reservationId))
    .where(
      and(
        eq(litige.id, analyse.data.litigeId),
        moi.role
          ? undefined
          : or(
              eq(reservation.locataireId, moi.id),
              eq(reservation.proprietaireId, moi.id),
            ),
      ),
    )
    .limit(1);

  if (!dossier) return { ok: false, cle: "interdit" };

  // Un dossier clos n'accepte plus rien : la décision est rendue sur les
  // pièces qui existaient, et en verser après coup ne la changerait pas —
  // cela ferait seulement croire le contraire.
  if (!gelActif(dossier.statut as StatutLitige)) {
    return { ok: false, cle: "dossierClos" };
  }

  await db.insert(litigePiece).values({
    litigeId: dossier.id,
    deposeParId: moi.id,
    type: "message",
    commentaire: analyse.data.commentaire,
  });

  revalidatePath("/[locale]/(espaces)", "layout");
  return { ok: true };
}

export type Piece = {
  id: string;
  auteur: string;
  auteurEstMoi: boolean;
  commentaire: string | null;
  date: Date;
};

/** Les pièces d'un litige, dans l'ordre où elles ont été versées. */
export async function piecesDuLitige(litigeId: string): Promise<Piece[]> {
  const moi = await compteConnecte();
  if (!moi) return [];

  const lignes = await db
    .select({
      id: litigePiece.id,
      deposeParId: litigePiece.deposeParId,
      commentaire: litigePiece.commentaire,
      date: litigePiece.creeLe,
      prenom: utilisateur.prenom,
    })
    .from(litigePiece)
    .innerJoin(utilisateur, eq(utilisateur.id, litigePiece.deposeParId))
    .innerJoin(litige, eq(litige.id, litigePiece.litigeId))
    .innerJoin(reservation, eq(reservation.id, litige.reservationId))
    .where(
      and(
        eq(litigePiece.litigeId, litigeId),
        moi.role
          ? undefined
          : or(
              eq(reservation.locataireId, moi.id),
              eq(reservation.proprietaireId, moi.id),
            ),
      ),
    )
    .orderBy(litigePiece.creeLe);

  return lignes.map((ligne) => ({
    id: ligne.id,
    auteur: ligne.prenom ?? "",
    auteurEstMoi: ligne.deposeParId === moi.id,
    commentaire: ligne.commentaire,
    date: ligne.date,
  }));
}
