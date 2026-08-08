"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { POINTS_CONTROLE } from "@/domain/location/constat";
import { compteConnecte } from "@/server/authentification/session";
import { db } from "@/server/db";
import { etatDesLieux, reservation } from "@/server/db/schema";
import { changerStatut } from "@/server/reservations/transitions";

/**
 * Enregistrement d'un état des lieux.
 *
 * Le constat est contradictoire : il n'est enregistré que signé des deux
 * parties, sur le même appareil, sur le terrain. Un brouillon signé d'un seul
 * côté n'aurait aucune valeur probante et donnerait l'illusion d'une pièce qui
 * n'existe pas — c'est tout ou rien.
 *
 * La machine à états le dit elle-même : « demarrer » suppose l'état des lieux
 * de départ signé, « restituer » celui de retour. Signer le constat **est**
 * l'événement ; la transition s'enchaîne donc ici, par le seul chemin permis
 * (règle 4), jamais par un `UPDATE` direct.
 */

export type Reponse = { ok: true } | { ok: false; cle: string };

const schema = z.object({
  reservationId: z.string().uuid(),
  type: z.enum(["depart", "retour"]),
  kilometrage: z.coerce.number().int().min(0).max(1_000_000).nullable(),
  commentaire: z.string().trim().max(2000),
  signatureLocataire: z.literal(true),
  signatureProprietaire: z.literal(true),
});

/** Statuts depuis lesquels chaque constat a un sens. */
const STATUTS_PERMIS = {
  // Le départ se constate au retrait ; on tolère la régularisation tardive
  // d'une location déjà partie, jamais d'une location close.
  depart: ["confirmee", "en_cours", "restituee"],
  retour: ["en_cours", "restituee"],
} as const;

export async function enregistrerConstat(donnees: FormData): Promise<Reponse> {
  const moi = await compteConnecte();
  if (!moi) return { ok: false, cle: "connexionRequise" };

  const analyse = schema.safeParse({
    reservationId: donnees.get("reservationId"),
    type: donnees.get("type"),
    kilometrage: String(donnees.get("kilometrage") ?? "") || null,
    commentaire: donnees.get("commentaire") ?? "",
    signatureLocataire: donnees.get("signatureLocataire") === "on",
    signatureProprietaire: donnees.get("signatureProprietaire") === "on",
  });

  if (!analyse.success) return { ok: false, cle: "invalide" };
  const { reservationId, type } = analyse.data;

  // Chaque point de contrôle doit avoir été examiné : une valeur absente n'est
  // pas un « conforme » par défaut, c'est un point qu'on n'a pas regardé.
  const controles: Record<string, boolean> = {};
  for (const point of POINTS_CONTROLE) {
    const valeur = donnees.get(`controle_${point}`);
    if (valeur !== "conforme" && valeur !== "defaut") {
      return { ok: false, cle: "invalide" };
    }
    controles[point] = valeur === "conforme";
  }

  // On ne constate que sur sa propre location, dans un état qui s'y prête.
  const [dossier] = await db
    .select({ statut: reservation.statut })
    .from(reservation)
    .where(
      and(
        eq(reservation.id, reservationId),
        eq(reservation.proprietaireId, moi.id),
      ),
    )
    .limit(1);

  if (!dossier) return { ok: false, cle: "interdit" };

  const statut = dossier.statut as string;
  if (!(STATUTS_PERMIS[type] as readonly string[]).includes(statut)) {
    return { ok: false, cle: "statutIncompatible" };
  }

  const existants = await db
    .select({ type: etatDesLieux.type })
    .from(etatDesLieux)
    .where(eq(etatDesLieux.reservationId, reservationId));

  // Un constat ne se refait pas : il est signé, il fait foi. Le corriger
  // relèvera d'un avenant, pas d'un écrasement silencieux.
  if (existants.some((constat) => constat.type === type)) {
    return { ok: false, cle: "dejaRealise" };
  }

  // Le départ d'abord : un retour sans point de comparaison ne prouve rien.
  if (type === "retour" && !existants.some((constat) => constat.type === "depart")) {
    return { ok: false, cle: "departManquant" };
  }

  const maintenant = new Date();

  await db.insert(etatDesLieux).values({
    reservationId,
    type,
    controles,
    kilometrage: analyse.data.kilometrage,
    commentaire: analyse.data.commentaire || null,
    signatureLocataireLe: maintenant,
    signatureProprietaireLe: maintenant,
    finaliseLe: maintenant,
  });

  // La transition s'enchaîne quand le constat est l'événement qui la fonde.
  // Si la machine la refuse, le constat reste acquis : la pièce signée existe,
  // et l'écran des réservations garde son bouton pour régulariser.
  if (type === "depart" && statut === "confirmee") {
    await changerStatut({
      reservationId,
      evenement: "demarrer",
      acteur: "proprietaire",
      acteurId: moi.id,
      motif: "État des lieux de départ signé des deux parties",
    });
  }

  if (type === "retour" && statut === "en_cours") {
    await changerStatut({
      reservationId,
      evenement: "restituer",
      acteur: "proprietaire",
      acteurId: moi.id,
      motif: "État des lieux de retour signé des deux parties",
    });
  }

  revalidatePath("/[locale]/(espaces)/proprietaire", "layout");
  revalidatePath("/[locale]/(espaces)/compte", "layout");
  return { ok: true };
}
