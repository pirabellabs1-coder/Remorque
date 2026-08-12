/**
 * Session simulée pour les tests d'intégration.
 *
 * Depuis que les dépôts sont restreints au compte connecté, ils appellent
 * `cookies()` de Next — qui lève hors d'une requête HTTP. Quarante tests sont
 * tombés d'un coup, non parce qu'ils étaient faux, mais parce qu'ils
 * s'exécutent là où il n'y a pas de requête.
 *
 * Trois issues étaient possibles. Faire tolérer l'absence de requête à
 * `compteConnecte` en renvoyant `null` aurait rendu les tests verts et vides :
 * chaque dépôt aurait rendu une liste sans rien, et les assertions de
 * cohérence n'auraient plus rien comparé. Passer l'identifiant en paramètre à
 * chaque lecture aurait affaibli la garantie du module — le défaut serait
 * redevenu « on peut demander les données de quelqu'un d'autre ».
 *
 * On remplace donc le module de session au banc d'essai, et lui seul. Le code
 * de production reste strict : hors session, aucune donnée.
 *
 * Le compte simulé est celui de la démonstration, choisi parce qu'il porte les
 * deux profils — dix-huit locations prises, dix-huit reçues. Un compte purement
 * locataire aurait laissé les vérifications de l'espace loueur passer à vide.
 */
import { eq } from "drizzle-orm";

import { db } from "@/server/db";
import { utilisateur } from "@/server/db/schema";

export const COURRIEL_DEMO = "moi@demonstration.flexitrailer.eu";

export type CompteConnecte = {
  id: string;
  email: string;
  prenom: string | null;
  nom: string | null;
  profilLocataire: boolean;
  profilProprietaire: boolean;
  role: string | null;
  permisCategories: string[];
};

let cache: CompteConnecte | null | undefined;

export async function compteConnecte(): Promise<CompteConnecte | null> {
  if (cache !== undefined) return cache;

  const [ligne] = await db
    .select({
      id: utilisateur.id,
      email: utilisateur.email,
      prenom: utilisateur.prenom,
      nom: utilisateur.nom,
      profilLocataire: utilisateur.profilLocataire,
      profilProprietaire: utilisateur.profilProprietaire,
      role: utilisateur.role,
      permisCategories: utilisateur.permisCategories,
    })
    .from(utilisateur)
    .where(eq(utilisateur.email, COURRIEL_DEMO))
    .limit(1);

  cache = ligne ?? null;
  return cache;
}

/* Les autres exports du module réel, jamais sollicités par les tests. */
export async function ouvrirSession(): Promise<void> {}
export async function fermerSession(): Promise<void> {}
export async function authentifier(): Promise<string | null> {
  return null;
}
