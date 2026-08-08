"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { compteConnecte } from "@/server/authentification/session";
import { db } from "@/server/db";
import { favori, tarif } from "@/server/db/schema";

/**
 * Favoris — ajout et retrait.
 *
 * Le bouton cœur vit sur des pages publiques pré-générées, qui ne peuvent pas
 * connaître la session au rendu : l'état initial est donc demandé par le
 * navigateur après coup (`estFavori`), et la bascule est une action. C'est le
 * seul endroit de l'espace public où l'état dépend du compte, et il ne doit
 * coûter ni le rendu statique ni le référencement (règle 8).
 */

export type ReponseFavori =
  | { ok: true; favori: boolean }
  | { ok: false; cle: "connexionRequise" | "invalide" };

/** L'annonce est-elle dans les favoris du compte connecté ? */
export async function estFavori(annonceId: string): Promise<boolean> {
  const moi = await compteConnecte();
  if (!moi) return false;

  const [ligne] = await db
    .select({ id: favori.id })
    .from(favori)
    .where(and(eq(favori.utilisateurId, moi.id), eq(favori.annonceId, annonceId)))
    .limit(1);

  return ligne !== undefined;
}

export async function basculerFavori(annonceId: string): Promise<ReponseFavori> {
  const moi = await compteConnecte();
  if (!moi) return { ok: false, cle: "connexionRequise" };
  if (!/^[0-9a-f-]{36}$/.test(annonceId)) return { ok: false, cle: "invalide" };

  const [existant] = await db
    .select({ id: favori.id })
    .from(favori)
    .where(and(eq(favori.utilisateurId, moi.id), eq(favori.annonceId, annonceId)))
    .limit(1);

  if (existant) {
    await db.delete(favori).where(eq(favori.id, existant.id));
  } else {
    // Le prix est photographié à l'ajout : c'est lui qui permettra d'afficher
    // « le prix a baissé depuis » sur la liste.
    const [grille] = await db
      .select({ prixJour: tarif.prixJour })
      .from(tarif)
      .where(eq(tarif.annonceId, annonceId))
      .limit(1);

    if (!grille) return { ok: false, cle: "invalide" };

    await db
      .insert(favori)
      .values({
        utilisateurId: moi.id,
        annonceId,
        prixJourAjout: grille.prixJour,
      })
      // Deux onglets, deux clics : le second ne doit pas lever pour autant.
      .onConflictDoNothing();
  }

  revalidatePath("/[locale]/(espaces)/compte/favoris", "page");
  return { ok: true, favori: !existant };
}
