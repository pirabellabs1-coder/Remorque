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
 * **Le drapeau `prive` décide, pas la route.** Ce commentaire annonçait jadis
 * qu'aucune garde n'était nécessaire, les fichiers étant tous des photos
 * d'annonce. Puis les pièces d'identité ont été rangées dans la même table —
 * délibérément, pour ne pas partir chez un hébergeur objet public — et cette
 * route a continué de les servir à quiconque connaissait un identifiant. La
 * route gardée existait pourtant ; elle était contournable par ici.
 *
 * La leçon vaut au-delà du correctif : quand deux routes lisent la même table,
 * c'est la donnée qui doit porter sa nature, jamais la route qui la devine.
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
      prive: fichier.prive,
    })
    .from(fichier)
    .where(eq(fichier.id, id))
    .limit(1);

  if (!ligne) return new Response(null, { status: 404 });

  // Un fichier privé n'existe pas pour cette route.
  //
  // Les pièces d'identité sont rangées dans cette table à dessein — pour ne
  // pas partir chez un hébergeur objet public — et elles ont leur route
  // gardée. Mais celle-ci lisait la même table par identifiant, sans rien
  // demander : connaître l'identifiant suffisait à obtenir une carte
  // d'identité, et la garde d'à côté n'y changeait rien.
  //
  // 404 plutôt que 403 : répondre « interdit » confirmerait l'existence du
  // fichier à qui n'a rien à en savoir.
  if (ligne.prive) return new Response(null, { status: 404 });

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
