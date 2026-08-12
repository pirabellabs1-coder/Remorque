import { eq } from "drizzle-orm";

import { compteConnecte } from "@/server/authentification/session";
import { db } from "@/server/db";
import { fichier } from "@/server/db/schema";
import { pieceLisiblePar } from "@/server/verification/dossier";

/**
 * Sert une pièce d'un dossier de vérification.
 *
 * Route distincte de `/api/fichiers`, et pour deux raisons que ce fichier-là
 * annonçait lui-même : celle-ci vérifie la session, et elle interdit tout
 * cache partagé. Une carte d'identité derrière un en-tête « public, immutable,
 * un an » se retrouverait dans la mémoire de chaque relais entre le serveur et
 * l'écran du contrôleur, et y resterait bien après la suppression du compte.
 *
 * Deux lecteurs autorisés, et deux seulement : le déposant et un contrôleur.
 * La vérification du droit est faite en base, dans la même requête que la
 * lecture de la ligne — `pieceLisiblePar` rend `null` plutôt que de rendre un
 * objet qu'un `if` oublié laisserait passer.
 */
export async function GET(
  _requete: Request,
  contexte: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await contexte.params;

  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return new Response(null, { status: 404 });
  }

  const moi = await compteConnecte();
  if (!moi) return new Response(null, { status: 404 });

  const autorisee = await pieceLisiblePar(id, moi);
  // 404 plutôt que 403 : répondre « interdit » confirmerait l'existence de la
  // pièce, donc du dossier, à qui n'a rien à en savoir.
  if (!autorisee) return new Response(null, { status: 404 });

  const identifiantFichier = autorisee.chemin.replace(/^fichier:/, "");
  if (identifiantFichier === autorisee.chemin) {
    // Une pièce dont le chemin ne désigne pas la table `fichier` n'a rien à
    // faire ici : elle serait ailleurs, hors de portée de cette garde.
    return new Response(null, { status: 404 });
  }

  const [ligne] = await db
    .select({
      contenu: fichier.contenu,
      typeMime: fichier.typeMime,
      taille: fichier.taille,
    })
    .from(fichier)
    .where(eq(fichier.id, identifiantFichier))
    .limit(1);

  if (!ligne) return new Response(null, { status: 404 });

  return new Response(new Uint8Array(ligne.contenu), {
    headers: {
      "Content-Type": ligne.typeMime,
      "Content-Length": String(ligne.taille),
      // « private » écarte les caches intermédiaires ; « no-store » écarte
      // aussi celui du navigateur, qui laisserait la pièce sur le disque d'un
      // poste partagé.
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
      // Une pièce ne s'affiche pas dans une page tierce.
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
