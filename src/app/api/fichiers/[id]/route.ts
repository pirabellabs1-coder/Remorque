import { eq } from "drizzle-orm";

import { db } from "@/server/db";
import { fichier } from "@/server/db/schema";

/**
 * Sert un fichier rangé en base.
 *
 * Utilisée seulement quand aucun stockage objet n'est configuré — voir
 * `src/server/stockage/objets.ts`. Les adresses produites par le stockage
 * objet pointent directement chez l'hébergeur et ne passent jamais ici.
 *
 * **Le cache fait tout le travail.** Le nom de chaque fichier est un
 * identifiant tiré au hasard : un contenu ne change jamais d'adresse, une
 * modification produit une nouvelle adresse. Le contenu est donc déclaré
 * immuable pour un an, et la périphérie de l'hébergeur le sert sans jamais
 * revenir à la base. Sans cet en-tête, chaque affichage de vignette dans la
 * recherche produirait une lecture de `bytea` — c'est exactement ce qui donne
 * à cette solution sa mauvaise réputation, et c'est évitable en une ligne.
 *
 * Aucune garde d'accès : ces fichiers sont les photos publiques des annonces,
 * visibles de tout visiteur. Le jour où des pièces privées passeront par ici —
 * carte grise, constat, pièce d'identité —, il leur faudra leur propre route,
 * avec vérification de session et sans cache partagé.
 */
export async function GET(
  _requete: Request,
  contexte: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await contexte.params;

  // Un identifiant mal formé ne doit pas atteindre la base : PostgreSQL
  // répondrait par une erreur de conversion, donc un 500 là où un 404 est la
  // réponse juste.
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return new Response(null, { status: 404 });
  }

  const [ligne] = await db
    .select({
      contenu: fichier.contenu,
      typeMime: fichier.typeMime,
      taille: fichier.taille,
    })
    .from(fichier)
    .where(eq(fichier.id, id))
    .limit(1);

  if (!ligne) return new Response(null, { status: 404 });

  return new Response(new Uint8Array(ligne.contenu), {
    headers: {
      "Content-Type": ligne.typeMime,
      "Content-Length": String(ligne.taille),
      "Cache-Control": "public, max-age=31536000, immutable",
      // La photo est déjà une image traitée : rien à interpréter d'autre.
      "X-Content-Type-Options": "nosniff",
    },
  });
}
