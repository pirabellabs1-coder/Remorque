"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { CATEGORIES } from "@/config/categories";
import { VILLES } from "@/config/villes";

import { ajouterAnnonce, supprimerAnnonce } from "./depot";

/**
 * Actions de l'espace loueur.
 *
 * La validation est refaite ici, côté serveur, même si le formulaire la fait
 * déjà : le navigateur n'est pas une source de confiance, et `required` en
 * HTML se contourne en trois secondes.
 *
 * Les montants arrivent en euros depuis le formulaire — c'est ce que saisit un
 * humain — et sont convertis en centimes ici, à la frontière. Aucun euro
 * flottant ne franchit cette limite.
 */

const schema = z.object({
  titre: z.string().trim().min(5).max(80),
  categorie: z.enum(
    CATEGORIES.map((entree) => entree.slug) as [string, ...string[]],
  ),
  villeSlug: z.enum(VILLES.map((ville) => ville.slug) as [string, ...string[]]),
  description: z.string().trim().min(20).max(2000),
  prixJourEuros: z.coerce.number().min(1).max(2000),
  cautionEuros: z.coerce.number().min(0).max(5000),
  ptacKg: z.coerce.number().int().min(100).max(3500),
  poidsVideKg: z.coerce.number().int().min(20).max(3000),
  longueurUtileMm: z.coerce.number().int().min(500).max(10000),
  largeurUtileMm: z.coerce.number().int().min(500).max(3000),
  freinee: z.coerce.boolean(),
  reservationInstantanee: z.coerce.boolean(),
  equipements: z.string().optional(),
  politiqueAnnulation: z.enum(["souple", "moderee", "stricte"]),
});

export type EtatPublication =
  | { statut: "inactif" }
  | { statut: "erreur"; message: string }
  | { statut: "publiee"; villeSlug: string; slug: string; titre: string };

export async function publierAnnonce(
  _precedent: EtatPublication,
  donnees: FormData,
): Promise<EtatPublication> {
  const brut = Object.fromEntries(donnees.entries());
  const analyse = schema.safeParse({
    ...brut,
    freinee: brut.freinee === "on",
    reservationInstantanee: brut.reservationInstantanee === "on",
  });

  if (!analyse.success) {
    const premier = analyse.error.issues[0];
    return {
      statut: "erreur",
      message: `${premier.path.join(".")} : ${premier.message}`,
    };
  }

  const valeurs = analyse.data;

  // Le poids à vide ne peut pas dépasser le poids total autorisé : la charge
  // utile deviendrait négative, et l'annonce afficherait une aberration.
  if (valeurs.poidsVideKg >= valeurs.ptacKg) {
    return { statut: "erreur", message: "poidsVideKg" };
  }

  const annonce = ajouterAnnonce({
    titre: valeurs.titre,
    categorie: valeurs.categorie as never,
    villeSlug: valeurs.villeSlug,
    description: valeurs.description,
    prixJour: Math.round(valeurs.prixJourEuros * 100),
    caution: Math.round(valeurs.cautionEuros * 100),
    ptacKg: valeurs.ptacKg,
    poidsVideKg: valeurs.poidsVideKg,
    longueurUtileMm: valeurs.longueurUtileMm,
    largeurUtileMm: valeurs.largeurUtileMm,
    freinee: valeurs.freinee,
    reservationInstantanee: valeurs.reservationInstantanee,
    equipements: (valeurs.equipements ?? "")
      .split(",")
      .map((element) => element.trim())
      .filter(Boolean),
    politiqueAnnulation: valeurs.politiqueAnnulation,
  });

  // L'annonce doit apparaître immédiatement partout où le catalogue est lu :
  // accueil, recherche, page de la ville, fiche. Sans cette invalidation, les
  // pages pré-générées continueraient de servir l'ancien catalogue.
  revalidatePath("/", "layout");

  return {
    statut: "publiee",
    villeSlug: annonce.villeSlug,
    slug: annonce.slug,
    titre: annonce.titre,
  };
}

export async function retirerAnnonce(id: string): Promise<void> {
  supprimerAnnonce(id);
  revalidatePath("/", "layout");
}
