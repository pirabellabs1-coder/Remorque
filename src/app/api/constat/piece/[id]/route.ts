import { eq } from "drizzle-orm";

import { compteConnecte } from "@/server/authentification/session";
import { db } from "@/server/db";
import {
  etatDesLieux,
  etatDesLieuxPhoto,
  fichier as fichierTable,
  reservation,
} from "@/server/db/schema";

/**
 * Sert une pièce d'un état des lieux — photographie ou vidéo.
 *
 * Ces pièces partaient sur un magasin public : lisibles par quiconque
 * connaissait l'adresse, sans session, indéfiniment. Le défaut n'est pas
 * théorique — l'écran demande explicitement de photographier le permis du
 * conducteur et de l'ajouter ici, et un état des lieux montre par ailleurs
 * l'allée de quelqu'un et son matériel. Les adresses fuient : dans un
 * en-tête de provenance, dans une capture d'écran partagée, dans l'historique
 * d'un navigateur prêté.
 *
 * Elles sont désormais déposées en privé, et cette route en est la seule
 * porte. Trois lecteurs autorisés : les deux parties à la réservation, et un
 * administrateur. Pas le support généraliste — un état des lieux n'est pas une
 * information de service client.
 */

const ROLES_AUTORISES = ["moderateur", "super_administrateur"];

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

  const [ligne] = await db
    .select({
      url: etatDesLieuxPhoto.url,
      typeMime: etatDesLieuxPhoto.typeMime,
      locataireId: reservation.locataireId,
      proprietaireId: reservation.proprietaireId,
    })
    .from(etatDesLieuxPhoto)
    .innerJoin(etatDesLieux, eq(etatDesLieux.id, etatDesLieuxPhoto.etatDesLieuxId))
    .innerJoin(reservation, eq(reservation.id, etatDesLieux.reservationId))
    .where(eq(etatDesLieuxPhoto.id, id))
    .limit(1);

  if (!ligne) return new Response(null, { status: 404 });

  const partie =
    ligne.locataireId === moi.id || ligne.proprietaireId === moi.id;
  const controleur = moi.role !== null && ROLES_AUTORISES.includes(moi.role);

  // 404 plutôt que 403 : répondre « interdit » confirmerait l'existence de la
  // pièce, donc de la location, à qui n'a rien à en savoir.
  if (!partie && !controleur) return new Response(null, { status: 404 });

  const octets = await lireOctets(ligne.url);
  if (!octets) return new Response(null, { status: 404 });

  return new Response(octets as BodyInit, {
    headers: {
      "Content-Type": ligne.typeMime ?? "application/octet-stream",
      // « private » écarte les caches intermédiaires ; « no-store » écarte
      // aussi celui du navigateur, qui laisserait la pièce sur le disque d'un
      // poste partagé.
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}

/**
 * Lit les octets d'une pièce, quelle que soit la forme de sa référence.
 *
 * Deux formes coexistent, et c'est voulu plutôt que subi : `fichier:<id>`
 * pour les dépôts privés d'aujourd'hui, une adresse complète pour ceux
 * d'avant le correctif. Les seconds restent lisibles — les effacer aurait vidé
 * des constats déjà signés, dont la valeur probante tient précisément à ce
 * qu'ils ne changent pas.
 */
async function lireOctets(reference: string): Promise<Uint8Array | null> {
  if (reference.startsWith("fichier:")) {
    const [ligne] = await db
      .select({ contenu: fichierTable.contenu })
      .from(fichierTable)
      .where(eq(fichierTable.id, reference.slice("fichier:".length)))
      .limit(1);

    return ligne ? new Uint8Array(ligne.contenu) : null;
  }

  const reponse = await fetch(reference);
  if (!reponse.ok) return null;
  return new Uint8Array(await reponse.arrayBuffer());
}
