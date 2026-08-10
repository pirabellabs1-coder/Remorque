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
 * Deux dos, une seule interface :
 *
 *  1. **Un service compatible S3** dès que `S3_ENDPOINT` et ses clés sont
 *     renseignés. C'est le mode de référence : il tient la charge, sert par un
 *     réseau de diffusion et n'alourdit pas les sauvegardes de la base.
 *  2. **La base elle-même**, sinon. Les octets vont dans la table `fichier` et
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

/** Dépose des octets et rend l'adresse à laquelle ils seront lus. */
export async function deposerObjet(
  chemin: string,
  corps: Uint8Array,
  typeMime: string,
): Promise<string> {
  if (stockageObjetConfigure()) {
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

  if (!serverEnv.S3_ENDPOINT) return null;

  const racine = urlPublique("");
  return url.startsWith(racine) ? url.slice(racine.length) : null;
}
