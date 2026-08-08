"use server";

import { and, eq, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { compteConnecte } from "@/server/authentification/session";
import { db } from "@/server/db";
import { conversation, message, reservation } from "@/server/db/schema";
import { enfilerNotificationNouveauMessage } from "@/server/notifications/file";

/**
 * Envoi d'un message.
 *
 * La conversation est créée à la volée si elle n'existe pas : demander à
 * l'usager de « créer une conversation » avant d'écrire est une étape que rien
 * ne justifie — il veut poser une question, pas ouvrir un dossier.
 */

export type Reponse = { ok: true } | { ok: false; cle: string };

const schema = z.object({
  reservationId: z.string().uuid(),
  contenu: z.string().trim().min(1).max(4000),
});

/**
 * Masque les coordonnées directes.
 *
 * Le contournement de la plateforme prive le locataire de l'assurance et de la
 * garantie de caution, et le propriétaire de tout recours — c'est le
 * manquement le plus fréquent et le plus dommageable des conditions
 * d'utilisation.
 *
 * Le message d'origine est conservé à part : la modération doit pouvoir
 * constater ce qui a été écrit, et un masquage sans trace empêcherait
 * d'instruire un signalement.
 */
function masquerCoordonnees(texte: string): { visible: string; masque: boolean } {
  const original = texte;

  const visible = texte
    // Numéros de téléphone, avec ou sans séparateurs.
    .replace(/(?:\+\d{1,3}[\s.-]?)?(?:\d[\s.-]?){9,13}\d/g, "[numéro masqué]")
    // Adresses électroniques.
    .replace(/[\w.+-]+@[\w-]+\.[\w.]{2,}/g, "[adresse masquée]");

  return { visible, masque: visible !== original };
}

export async function envoyerMessage(donnees: FormData): Promise<Reponse> {
  const moi = await compteConnecte();
  if (!moi) return { ok: false, cle: "connexionRequise" };

  const analyse = schema.safeParse({
    reservationId: donnees.get("reservationId"),
    contenu: donnees.get("contenu"),
  });

  if (!analyse.success) return { ok: false, cle: "invalide" };

  // On n'écrit que sur une réservation dont on est partie. Sans ce contrôle, un
  // identifiant recopié suffirait à s'inviter dans la conversation d'autrui.
  const [dossier] = await db
    .select({
      id: reservation.id,
      annonceId: reservation.annonceId,
      locataireId: reservation.locataireId,
      proprietaireId: reservation.proprietaireId,
    })
    .from(reservation)
    .where(
      and(
        eq(reservation.id, analyse.data.reservationId),
        or(
          eq(reservation.locataireId, moi.id),
          eq(reservation.proprietaireId, moi.id),
        ),
      ),
    )
    .limit(1);

  if (!dossier) return { ok: false, cle: "interdit" };

  const { visible, masque } = masquerCoordonnees(analyse.data.contenu);

  await db.transaction(async (tx) => {
    const [existante] = await tx
      .select({ id: conversation.id })
      .from(conversation)
      .where(eq(conversation.reservationId, dossier.id))
      .limit(1);

    const fil =
      existante ??
      (
        await tx
          .insert(conversation)
          .values({
            annonceId: dossier.annonceId,
            reservationId: dossier.id,
            locataireId: dossier.locataireId,
            proprietaireId: dossier.proprietaireId,
          })
          .returning({ id: conversation.id })
      )[0];

    await tx.insert(message).values({
      conversationId: fil.id,
      auteurId: moi.id,
      contenu: visible,
      // L'original n'est conservé que s'il diffère : stocker deux fois le même
      // texte n'apprend rien et double le volume.
      contenuOriginal: masque ? analyse.data.contenu : null,
      coordonneesMasquees: masque,
    });

    // La date du dernier message ordonne la liste des fils : sans elle, une
    // conversation active retomberait au fond dès le rechargement.
    await tx
      .update(conversation)
      .set({ dernierMessageLe: new Date(), modifieLe: new Date() })
      .where(eq(conversation.id, fil.id));

    // L'autre partie est prévenue par courriel — dans la transaction, comme
    // toute notification : un courriel sans message serait un fantôme.
    await enfilerNotificationNouveauMessage(tx, dossier.id, moi.id);
  });

  revalidatePath("/[locale]/(espaces)", "layout");
  return { ok: true };
}
