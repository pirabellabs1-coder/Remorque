"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { compteConnecte } from "@/server/authentification/session";
import { db } from "@/server/db";
import { avis } from "@/server/db/schema";

/**
 * Réponse du loueur à un avis reçu.
 *
 * Le droit de réponse est ce qui rend une note publique supportable : un avis
 * sévère sans contexte condamne, le même avis suivi d'une explication informe.
 *
 * Une seule réponse, et définitive. Pouvoir la réécrire indéfiniment
 * permettrait d'adoucir après coup un échange que le locataire a lu — la
 * réponse est publique au même titre que l'avis, elle en suit le régime.
 */

export type Reponse = { ok: true } | { ok: false; cle: string };

const schema = z.object({
  avisId: z.string().uuid(),
  reponse: z.string().trim().min(10).max(1000),
});

export async function repondreAvis(donnees: FormData): Promise<Reponse> {
  const moi = await compteConnecte();
  if (!moi) return { ok: false, cle: "connexionRequise" };

  const analyse = schema.safeParse({
    avisId: donnees.get("avisId"),
    reponse: donnees.get("reponse"),
  });

  if (!analyse.success) return { ok: false, cle: "invalide" };

  // On ne répond qu'à un avis qu'on a reçu, et qui n'a pas déjà sa réponse.
  // Les trois conditions dans la clause plutôt qu'en trois lectures : deux
  // onglets ouverts ne produiront pas deux réponses.
  const misesAjour = await db
    .update(avis)
    .set({ reponse: analyse.data.reponse, reponseLe: new Date() })
    .where(
      and(
        eq(avis.id, analyse.data.avisId),
        eq(avis.destinataireId, moi.id),
        isNull(avis.reponse),
      ),
    )
    .returning({ id: avis.id });

  if (misesAjour.length === 0) return { ok: false, cle: "impossible" };

  revalidatePath("/[locale]/(espaces)/proprietaire", "layout");
  revalidatePath("/[locale]/(espaces)/compte", "layout");
  // La réponse s'affiche sous l'avis sur la fiche publique de l'annonce.
  revalidatePath("/", "layout");

  return { ok: true };
}
