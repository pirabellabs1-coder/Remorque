import "server-only";

import { and, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/server/db";
import { caution, reservation, reversement } from "@/server/db/schema";

/**
 * Gel et dégel des fonds d'une location — règle 6, côté écriture.
 *
 * Deux dossiers savent geler : le litige et le sinistre. Le gel s'écrit aux
 * trois endroits qui le portent — la réservation, la caution, le reversement —
 * parce que trois écrans différents le lisent ; les laisser diverger, c'est
 * promettre au propriétaire un virement que le dossier interdit.
 *
 * Le dégel, lui, n'appartient à personne : il se **constate**. Un litige qui
 * se clôt ne rend pas les fonds si un sinistre court encore, et inversement.
 * C'est pourquoi la levée vérifie elle-même, en base, qu'aucun dossier gelant
 * ne subsiste — l'appelant n'a pas à le savoir, et surtout pas à l'oublier.
 */

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Pose le gel sur les trois porteurs. Idempotent : reposer ne change rien. */
export async function poserGel(
  tx: Tx,
  reservationId: string,
  motif: string,
): Promise<void> {
  await tx
    .update(reservation)
    .set({ fondsGeles: true, modifieLe: new Date() })
    .where(eq(reservation.id, reservationId));

  await tx
    .update(caution)
    .set({ statut: "contestee", contesteeLe: new Date() })
    .where(
      and(
        eq(caution.reservationId, reservationId),
        inArray(caution.statut, ["constituee"]),
      ),
    );

  await tx
    .update(reversement)
    .set({ statut: "gele", geleMotif: motif })
    .where(
      and(
        eq(reversement.reservationId, reservationId),
        inArray(reversement.statut, ["planifie"]),
      ),
    );
}

/**
 * Lève le gel **si plus rien ne le justifie** : ni litige ni sinistre encore
 * ouvert sur la location. Rend `true` si la levée a eu lieu.
 *
 * La vérification est dans la requête, pas chez l'appelant : c'est la
 * transaction qui clôt le dernier dossier qui constate la levée, sans qu'un
 * module ait besoin de connaître les dossiers de l'autre.
 */
export async function leverGelSiPlusRienOuvert(
  tx: Tx,
  reservationId: string,
): Promise<boolean> {
  const [{ encoreGele }] = await tx
    .select({
      encoreGele: sql<boolean>`exists (
        select 1 from litige l
        where l.reservation_id = ${reservationId}
          and l.statut in ('ouvert', 'en_resolution_amiable', 'en_arbitrage')
      ) or exists (
        select 1 from sinistre s
        where s.reservation_id = ${reservationId}
          and s.statut in ('declare', 'transmis', 'en_cours')
      )`,
    })
    .from(reservation)
    .where(eq(reservation.id, reservationId));

  if (encoreGele) return false;

  await tx
    .update(reservation)
    .set({ fondsGeles: false, modifieLe: new Date() })
    .where(eq(reservation.id, reservationId));

  await tx
    .update(caution)
    .set({ statut: "constituee" })
    .where(
      and(
        eq(caution.reservationId, reservationId),
        inArray(caution.statut, ["contestee"]),
      ),
    );

  await tx
    .update(reversement)
    .set({ statut: "planifie", geleMotif: null })
    .where(
      and(
        eq(reversement.reservationId, reservationId),
        inArray(reversement.statut, ["gele"]),
      ),
    );

  return true;
}
