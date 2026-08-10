import { customType, index, integer, pgTable, text } from "drizzle-orm/pg-core";

import { id, timestamps } from "./_helpers";

/**
 * Octets d'un fichier déposé, quand aucun stockage objet n'est configuré.
 *
 * Le stockage de référence reste le service compatible S3 déclaré dans
 * `S3_ENDPOINT` — c'est lui qui tient la charge, sert par un réseau de
 * diffusion et n'alourdit pas les sauvegardes. Cette table est la voie de
 * repli : elle permet à la plateforme de fonctionner **entièrement** avec la
 * seule base, sans compte chez un tiers ni clé à obtenir.
 *
 * Le compromis est assumé et borné :
 *
 *  - Les photos sont réduites sur l'appareil avant l'envoi (environ 300 ko),
 *    et plafonnées par `TAILLE_MAXIMUM` côté serveur.
 *  - Elles sont servies par `/api/fichiers/[id]` avec un cache immuable d'un
 *    an : sur Vercel, chaque photo n'est donc lue en base qu'une fois par
 *    région, puis servie depuis la périphérie. Ce n'est pas la base qui répond
 *    à chaque affichage.
 *  - Le jour où les clés S3 arrivent, `deposerObjet` bascule sans changement
 *    de code : les anciennes adresses continuent de fonctionner, les nouvelles
 *    photos partent chez l'hébergeur objet.
 *
 * Ce qu'il ne faut pas en attendre : un entrepôt. Au-delà de quelques milliers
 * d'annonces, la taille des sauvegardes devient le facteur limitant, et c'est
 * le signal qu'il est temps de configurer le stockage objet.
 */

/**
 * `bytea` n'a pas d'équivalent dans le noyau de Drizzle : on le déclare, avec
 * la conversion vers `Uint8Array` qui va avec.
 */
const octets = customType<{ data: Uint8Array; driverData: Buffer }>({
  dataType: () => "bytea",
  toDriver: (valeur) => Buffer.from(valeur),
  fromDriver: (valeur) => new Uint8Array(valeur),
});

export const fichier = pgTable(
  "fichier",
  {
    id: id(),
    /**
     * Chemin logique, identique à celui qu'aurait l'objet dans un
     * compartiment : `annonces/<annonce>/<aléa>.webp`. Il rend les deux
     * stockages interchangeables et permet de migrer les fichiers plus tard
     * sans réécrire les adresses.
     */
    chemin: text("chemin").notNull(),
    typeMime: text("type_mime").notNull(),
    taille: integer("taille").notNull(),
    contenu: octets("contenu").notNull(),
    ...timestamps,
  },
  (table) => [index("fichier_chemin_idx").on(table.chemin)],
);
