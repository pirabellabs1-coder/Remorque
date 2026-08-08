"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { compteConnecte } from "@/server/authentification/session";
import { db } from "@/server/db";
import { avis, reservation } from "@/server/db/schema";
import { FENETRE_AVIS_JOURS, joursEntre } from "@/server/donnees-demo";

/**
 * Dépôt d'un avis par le locataire.
 *
 * L'avis alimente la note publique de l'annonce — c'est une pièce du
 * référencement et de la confiance, pas un livre d'or. D'où les gardes :
 * seulement sur sa propre location, seulement close, seulement dans la
 * fenêtre de dépôt, et une seule fois. La contrainte d'unicité en base
 * double la vérification applicative — deux onglets ne feront pas deux avis.
 *
 * Publication immédiate : la modération est a posteriori (`signale`,
 * `masque`), comme partout sur la plateforme. Retenir les avis en file
 * d'attente ferait douter l'auteur que son texte ait été pris.
 */

export type Reponse = { ok: true } | { ok: false; cle: string };

const schema = z.object({
  reservationId: z.string().uuid(),
  note: z.coerce.number().int().min(1).max(5),
  // Vingt caractères au minimum : « ok » n'aide ni le prochain locataire ni
  // le loueur, et une note seule dit déjà cela.
  commentaire: z.string().trim().min(20).max(2000),
});

export async function deposerAvis(donnees: FormData): Promise<Reponse> {
  const moi = await compteConnecte();
  if (!moi) return { ok: false, cle: "connexionRequise" };

  const analyse = schema.safeParse({
    reservationId: donnees.get("reservationId"),
    note: donnees.get("note"),
    commentaire: donnees.get("commentaire"),
  });

  if (!analyse.success) return { ok: false, cle: "invalide" };
  const { reservationId, note, commentaire } = analyse.data;

  const [dossier] = await db
    .select({
      statut: reservation.statut,
      fin: reservation.fin,
      annonceId: reservation.annonceId,
      proprietaireId: reservation.proprietaireId,
    })
    .from(reservation)
    .where(
      and(eq(reservation.id, reservationId), eq(reservation.locataireId, moi.id)),
    )
    .limit(1);

  if (!dossier) return { ok: false, cle: "interdit" };
  if (dossier.statut !== "cloturee") return { ok: false, cle: "nonCloturee" };

  // La fenêtre fermée est un refus, pas une tolérance : un avis déposé six
  // mois après la location note un souvenir, plus une prestation.
  if (joursEntre(dossier.fin, new Date()) > FENETRE_AVIS_JOURS) {
    return { ok: false, cle: "fenetreFermee" };
  }

  const [existant] = await db
    .select({ id: avis.id })
    .from(avis)
    .where(and(eq(avis.reservationId, reservationId), eq(avis.auteurId, moi.id)))
    .limit(1);

  if (existant) return { ok: false, cle: "dejaDepose" };

  await db.insert(avis).values({
    reservationId,
    auteurId: moi.id,
    destinataireId: dossier.proprietaireId,
    annonceId: dossier.annonceId,
    note,
    commentaire,
    publieLe: new Date(),
  });

  // L'espace du locataire change, celui du loueur aussi, et la note moyenne
  // publique de l'annonce avec eux.
  revalidatePath("/[locale]/(espaces)/compte", "layout");
  revalidatePath("/[locale]/(espaces)/proprietaire", "layout");
  revalidatePath("/", "layout");

  return { ok: true };
}
