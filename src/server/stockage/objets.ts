import "server-only";

import { randomUUID } from "node:crypto";

import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { eq } from "drizzle-orm";

import { serverEnv } from "@/config/env-serveur";
import { db } from "@/server/db";
import { fichier } from "@/server/db/schema";

/**
 * Dépôt d'objets — photos d'annonces, et demain pièces des états des lieux.
 *
 * Trois dos, une seule interface, dans cet ordre :
 *
 *  1. **Vercel Blob** dès que `BLOB_READ_WRITE_TOKEN` est présent. C'est la
 *     voie de référence ici, et pour une raison prosaïque : le jeton est posé
 *     par Vercel quand un magasin est rattaché au projet, sans qu'aucune clé
 *     soit à obtenir, à recopier ni à faire tourner. Le site est déjà hébergé
 *     là ; les octets voyagent sur le même réseau que les pages.
 *  2. **Un service compatible S3** si ses quatre valeurs sont renseignées.
 *     Elle reste, et passe après : quiconque a pris la peine de configurer S3
 *     l'a fait pour une raison, mais le jeton Blob arrive tout seul et
 *     l'emporterait par accident sur un choix délibéré — d'où l'ordre inverse
 *     de ce que la commodité suggérerait.
 *  3. **La base elle-même**, sinon. Les octets vont dans la table `fichier` et
 *     sont servis par `/api/fichiers/[id]` avec un cache immuable.
 *
 * Pourquoi une voie de repli plutôt qu'une porte fermée, comme pour Stripe et
 * Resend ? Parce que la comparaison ne tient pas. Un paiement sans clé Stripe
 * ne peut pas *exister* — il n'y a rien à faire à la place. Une photo, si :
 * les octets sont là, la base est là, et refuser de les écrire ne protège
 * personne. Une caution prélevée sans passer par la banque serait un mensonge ;
 * une photo rangée ailleurs qu'au meilleur endroit reste une photo.
 *
 * Le passage de l'un à l'autre ne demande aucun changement de code : les
 * adresses déjà enregistrées continuent de fonctionner, les nouvelles photos
 * partent chez l'hébergeur objet.
 */

/** Un magasin Vercel Blob est-il rattaché au projet ? */
export function blobConfigure(): boolean {
  return Boolean(serverEnv.BLOB_READ_WRITE_TOKEN);
}

/** Le stockage objet est-il configuré ? Les quatre valeurs vont ensemble. */
export function stockageObjetConfigure(): boolean {
  return Boolean(
    serverEnv.S3_ENDPOINT &&
      serverEnv.S3_BUCKET &&
      serverEnv.S3_ACCESS_KEY_ID &&
      serverEnv.S3_SECRET_ACCESS_KEY,
  );
}

let clientMemorise: S3Client | undefined;

function client(): S3Client {
  clientMemorise ??= new S3Client({
    endpoint: serverEnv.S3_ENDPOINT,
    region: serverEnv.S3_REGION,
    credentials: {
      accessKeyId: serverEnv.S3_ACCESS_KEY_ID as string,
      secretAccessKey: serverEnv.S3_SECRET_ACCESS_KEY as string,
    },
    // Les services compatibles S3 servent le compartiment dans le chemin et
    // non en sous-domaine ; sans cette option, chaque requête part vers un
    // hôte qui n'existe pas.
    forcePathStyle: true,
  });

  return clientMemorise;
}

/**
 * Adresse publique d'un objet déposé sur le stockage objet.
 *
 * Sur Supabase, l'adresse S3 est `…/storage/v1/s3` et la lecture publique
 * `…/storage/v1/object/public/<compartiment>/<chemin>`. La seconde se déduit
 * donc de la première, ce qui évite une variable d'environnement de plus à
 * tenir en cohérence. `S3_URL_PUBLIQUE` reste là pour les hébergeurs dont la
 * convention diffère.
 */
export function urlPublique(chemin: string): string {
  const racine =
    serverEnv.S3_URL_PUBLIQUE ??
    `${(serverEnv.S3_ENDPOINT as string).replace(/\/s3\/?$/, "")}/object/public/${serverEnv.S3_BUCKET}`;

  return `${racine.replace(/\/$/, "")}/${chemin}`;
}

/**
 * Un nom de fichier tiré au hasard, sous un préfixe donné.
 *
 * Le nom d'origine n'est jamais repris : il peut contenir n'importe quoi, il
 * révèle parfois le nom de son auteur, et deux téléphones produisent
 * couramment le même `IMG_0001.jpg`.
 */
export function cheminObjet(prefixe: string, extension: string): string {
  return `${prefixe}/${randomUUID()}.${extension}`;
}

/**
 * Dépose des octets et rend l'adresse à laquelle ils seront lus.
 *
 * **`prive` n'est pas une option de confort.** Sans lui, tout ce qui passe ici
 * atterrit sur un magasin public : lisible par quiconque connaît l'adresse,
 * sans session, indéfiniment. C'est ce qu'il faut pour la photo d'une remorque
 * et jamais pour un état des lieux — lequel montre l'allée de quelqu'un, son
 * matériel, et parfois le permis du conducteur qu'on demande de photographier.
 * Les signatures manuscrites sont dans le même cas.
 *
 * Un objet privé rend une référence `blob:<chemin>` et non une adresse : il
 * n'y a rien à mettre dans une balise `img`, ce qui est le but. Sa lecture
 * passe par une route qui vérifie la session.
 */
export async function deposerObjet(
  chemin: string,
  corps: Uint8Array,
  typeMime: string,
  options: { prive?: boolean } = {},
): Promise<string> {
  // Le stockage privé n'existe que chez Vercel Blob dans cette base de code :
  // le compartiment S3 configuré est public par nature, et y déposer une pièce
  // privée reviendrait à la publier. On refuse plutôt que de le supposer.
  if (options.prive) {
    if (!blobConfigure()) {
      throw new Error(
        "Stockage privé demandé sans Vercel Blob configuré : refus de déposer en clair.",
      );
    }

    const { put } = await import("@vercel/blob");
    const depose = await put(
      chemin,
      Buffer.from(corps.buffer, corps.byteOffset, corps.byteLength),
      { access: "private", contentType: typeMime, addRandomSuffix: false },
    );

    return `blob:${depose.pathname}`;
  }

  if (stockageObjetConfigure()) {
    // S3 d'abord : voir l'ordre de préséance en tête de fichier.
    await client().send(
      new PutObjectCommand({
        Bucket: serverEnv.S3_BUCKET,
        Key: chemin,
        Body: corps,
        ContentType: typeMime,
        // Les photos sont immuables : leur nom est tiré au hasard à chaque
        // dépôt, une modification produit un nouvel objet. Un an de cache est
        // donc sûr, et c'est ce qui rend la recherche rapide en mobilité.
        CacheControl: "public, max-age=31536000, immutable",
      }),
    );

    return urlPublique(chemin);
  }

  if (blobConfigure()) {
    const { put } = await import("@vercel/blob");

    // `put` n'accepte pas un `Uint8Array` nu : on l'enveloppe sans copier les
    // octets, la vue portant sur la même mémoire.
    const depose = await put(chemin, Buffer.from(corps.buffer, corps.byteOffset, corps.byteLength), {
      access: "public",
      contentType: typeMime,
      // Le chemin porte déjà un identifiant tiré au hasard : laisser Vercel en
      // ajouter un second rendrait l'adresse imprévisible, donc impossible à
      // reconstruire pour supprimer l'objet plus tard.
      addRandomSuffix: false,
      // Immuable pour un an, comme les autres dos : une photo ne change jamais
      // d'adresse, une modification produit une nouvelle adresse.
      cacheControlMaxAge: 31_536_000,
    });

    return depose.url;
  }

  const [ligne] = await db
    .insert(fichier)
    .values({
      chemin,
      typeMime,
      taille: corps.byteLength,
      contenu: corps,
    })
    .returning({ id: fichier.id });

  return `/api/fichiers/${ligne.id}`;
}

/**
 * Retire un objet.
 *
 * L'échec du stockage objet est absorbé volontairement : la ligne en base a
 * déjà disparu, et un objet orphelin coûte quelques kilo-octets, là où une
 * exception ici ferait échouer une suppression que l'usager croit faite.
 */
export async function retirerObjet(chemin: string): Promise<void> {
  if (chemin.startsWith("fichier:")) {
    await db.delete(fichier).where(eq(fichier.id, chemin.slice(8)));
    return;
  }

  if (chemin.startsWith("blob:")) {
    try {
      const { del } = await import("@vercel/blob");
      await del(chemin.slice(5));
    } catch {
      // Sans conséquence pour l'usager : voir ci-dessus.
    }
    return;
  }

  if (!stockageObjetConfigure()) return;

  try {
    await client().send(
      new DeleteObjectCommand({ Bucket: serverEnv.S3_BUCKET, Key: chemin }),
    );
  } catch {
    // Sans conséquence pour l'usager : voir ci-dessus.
  }
}

/**
 * Retrouve de quoi supprimer un objet à partir de son adresse publique.
 *
 * Les photos sont enregistrées par leur adresse — c'est elle que lit
 * l'affichage. Pour supprimer, il faut refaire le chemin inverse, et les deux
 * stockages n'écrivent pas la même forme d'adresse :
 *
 *  - `/api/fichiers/<uuid>` → `fichier:<uuid>`, une ligne de la table ;
 *  - `https://….blob.vercel-storage.com/<chemin>` → `blob:<adresse entière>`,
 *    car Vercel supprime par adresse et non par chemin ;
 *  - `https://…/object/public/<compartiment>/<chemin>` → le chemin de l'objet.
 *
 * Rend `null` pour une adresse qui ne vient d'aucun des deux : les annonces de
 * démonstration portent des chemins locaux (`/images/…`), qu'il n'y a rien à
 * supprimer.
 */
export function cheminDepuisUrl(url: string): string | null {
  const prefixeBase = "/api/fichiers/";
  if (url.startsWith(prefixeBase)) {
    return `fichier:${url.slice(prefixeBase.length)}`;
  }

  // Reconnue à son domaine plutôt qu'au jeton : une photo déposée du temps où
  // le magasin était configuré doit rester supprimable après son retrait.
  if (url.includes(".blob.vercel-storage.com/")) return `blob:${url}`;

  if (!serverEnv.S3_ENDPOINT) return null;

  const racine = urlPublique("");
  return url.startsWith(racine) ? url.slice(racine.length) : null;
}
