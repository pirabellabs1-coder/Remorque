"use server";

import { and, eq, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  evaluerSupport,
  PRIORITES_SUPPORT,
  type ActeurSupport,
  type EvenementSupport,
  type StatutSupport,
} from "@/domain/support/machine";
import { compteConnecte } from "@/server/authentification/session";
import { db } from "@/server/db";
import {
  journalAudit,
  reservation,
  ticketMessage,
  ticketSupport,
} from "@/server/db/schema";
import { enfilerNotificationTicket } from "@/server/notifications/file";

/**
 * Ouverture et instruction des demandes d'assistance.
 *
 * Le support ne porte pas d'argent : rien n'y est gelé, rien n'y est arbitré.
 * Ce qu'il porte, c'est une promesse de répondre — et c'est elle que ce module
 * rend vérifiable, en datant la première réponse au moment où elle part et non
 * au moment où quelqu'un déclare avoir traité le dossier.
 *
 * La page de contact publique reste sans formulaire, délibérément : on écrit
 * au support depuis son compte, où l'on a une identité, un historique et une
 * location à rattacher. C'est la différence entre une demande instruisable et
 * un message anonyme.
 */

export type Reponse = { ok: true; id?: string } | { ok: false; cle: string };

const ouverture = z.object({
  sujet: z.string().trim().min(5).max(200),
  message: z.string().trim().min(20).max(4000),
  priorite: z.enum(PRIORITES_SUPPORT),
  // Rattacher est facultatif : on écrit avant d'avoir réservé.
  reservationId: z.string().uuid().optional(),
});

/**
 * Référence lisible, communiquée au demandeur : `AS-2026-0042`.
 *
 * Le rang se lit en base au moment d'écrire, et **le rang le plus haut, pas
 * le nombre de lignes** : compter reviendrait à réattribuer une référence
 * déjà communiquée le jour où un dossier disparaît.
 *
 * La lecture ne protège pas des ouvertures simultanées — en lecture validée,
 * deux transactions concurrentes voient le même maximum et calculent la même
 * référence, la seconde butant alors sur l'index unique. C'est pourquoi
 * l'appelant réessaie : la course est rare, la collision détectée par la base,
 * et un second tour suffit. Verrouiller la table pour cela coûterait plus cher
 * que le rare conflit qu'on évite.
 */
async function prochaineReference(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  annee: number,
): Promise<string> {
  const [ligne] = await tx
    .select({
      rang: sql<number>`coalesce(max(substring(${ticketSupport.reference} from 9)::int), 0)`,
    })
    .from(ticketSupport)
    .where(sql`${ticketSupport.reference} ~ ${`^AS-${annee}-[0-9]+$`}`);

  return `AS-${annee}-${String(Number(ligne?.rang ?? 0) + 1).padStart(4, "0")}`;
}

/** L'erreur vient-elle de l'index unique de la référence ? */
function collisionDeReference(erreur: unknown): boolean {
  return (
    typeof erreur === "object" &&
    erreur !== null &&
    "code" in erreur &&
    (erreur as { code?: string }).code === "23505"
  );
}

export async function ouvrirDemande(donnees: FormData): Promise<Reponse> {
  const moi = await compteConnecte();
  if (!moi) return { ok: false, cle: "connexionRequise" };

  const brut = donnees.get("reservationId");
  const analyse = ouverture.safeParse({
    sujet: donnees.get("sujet"),
    message: donnees.get("message"),
    priorite: donnees.get("priorite"),
    reservationId: brut && brut !== "" ? brut : undefined,
  });

  if (!analyse.success) return { ok: false, cle: "invalide" };
  const { sujet, message, priorite, reservationId } = analyse.data;

  // On ne rattache pas la location d'autrui : la référence citée sortirait
  // un dossier qui ne regarde pas le demandeur.
  if (reservationId) {
    const [dossier] = await db
      .select({ id: reservation.id })
      .from(reservation)
      .where(
        and(
          eq(reservation.id, reservationId),
          sql`(${reservation.locataireId} = ${moi.id} or ${reservation.proprietaireId} = ${moi.id})`,
        ),
      )
      .limit(1);

    if (!dossier) return { ok: false, cle: "locationInconnue" };
  }

  const annee = new Date().getFullYear();

  // Deux tours suffisent : la collision suppose deux ouvertures dans la même
  // fenêtre de transaction, et le second tour lit un maximum désormais validé.
  let cree: { id: string } | null = null;
  for (let essai = 0; essai < 3 && cree === null; essai += 1) {
    try {
      cree = await db.transaction(async (tx) => {
        const reference = await prochaineReference(tx, annee);

        const [ligne] = await tx
          .insert(ticketSupport)
          .values({
            reference,
            demandeurId: moi.id,
            demandeurEmail: moi.email,
            reservationId: reservationId ?? null,
            sujet,
            message,
            canal: "formulaire",
            priorite,
            statut: "ouvert",
          })
          .returning({ id: ticketSupport.id });

        // Le message d'ouverture entre aussi dans le fil : sans lui, l'écran
        // de l'assistance montrerait un échange qui commence par une réponse.
        await tx.insert(ticketMessage).values({
          ticketId: ligne.id,
          auteurId: moi.id,
          auteurRole: "demandeur",
          corps: message,
        });

        await enfilerNotificationTicket(tx, ligne.id, "ouverte");
        return ligne;
      });
    } catch (erreur) {
      // Toute autre panne remonte : masquer une erreur de base derrière un
      // « réessayez » ferait perdre la demande sans que personne le sache.
      if (!collisionDeReference(erreur)) throw erreur;
    }
  }

  if (!cree) return { ok: false, cle: "reessayer" };

  revalidatePath("/[locale]/(espaces)", "layout");
  return { ok: true, id: cree.id };
}

const instruction = z.object({
  ticketId: z.string().uuid(),
  evenement: z.enum(["prendre", "repondre", "resoudre", "renoncer"]),
  message: z.string().trim().max(4000).optional(),
  interne: z.coerce.boolean().optional(),
});

/**
 * Fait franchir une étape à une demande.
 *
 * Le domaine décide ; ce module lit l'état, établit la qualité de l'appelant
 * **sur ce dossier précis**, applique et trace. La qualité de demandeur prime
 * le rôle interne : un agent qui a écrit pour son propre compte n'instruit pas
 * sa propre demande — même politique que le litige et le sinistre.
 */
export async function instruireDemande(donnees: FormData): Promise<Reponse> {
  const moi = await compteConnecte();
  if (!moi) return { ok: false, cle: "connexionRequise" };

  const analyse = instruction.safeParse({
    ticketId: donnees.get("ticketId"),
    evenement: donnees.get("evenement"),
    message: donnees.get("message") ?? undefined,
    interne: donnees.get("interne") ?? undefined,
  });

  if (!analyse.success) return { ok: false, cle: "invalide" };
  const { ticketId, evenement, message, interne } = analyse.data;

  const [dossier] = await db
    .select({
      id: ticketSupport.id,
      statut: ticketSupport.statut,
      demandeurId: ticketSupport.demandeurId,
      premiereReponseLe: ticketSupport.premiereReponseLe,
    })
    .from(ticketSupport)
    .where(eq(ticketSupport.id, ticketId))
    .limit(1);

  if (!dossier) return { ok: false, cle: "introuvable" };

  const estDemandeur = dossier.demandeurId === moi.id;
  const acteur: ActeurSupport = estDemandeur
    ? "demandeur"
    : moi.role
      ? "assistance"
      : "demandeur";

  // Un compte sans rôle qui n'est pas l'auteur n'a rien à faire ici : le
  // domaine le refuserait, mais l'écarter tout de suite évite de lui apprendre
  // qu'un dossier existe sous cet identifiant.
  if (!estDemandeur && !moi.role) return { ok: false, cle: "interdit" };

  const verdict = evaluerSupport(evenement as EvenementSupport, {
    statut: dossier.statut as StatutSupport,
    acteur,
    message,
    dejaRepondu: dossier.premiereReponseLe !== null,
  });

  if (!verdict.autorise) return { ok: false, cle: verdict.motif };

  const suivant = verdict.statutSuivant;
  // La note interne ne compte pas comme réponse : elle ne part pas, personne
  // ne la lit hors de l'assistance, et la dater serait un mensonge d'indicateur.
  const estReponseAuDemandeur =
    evenement === "repondre" && acteur === "assistance" && !interne;
  const enTetes = await headers();

  await db.transaction(async (tx) => {
    if (message?.trim()) {
      await tx.insert(ticketMessage).values({
        ticketId,
        auteurId: moi.id,
        auteurRole: acteur,
        corps: message.trim(),
        interne: Boolean(interne) && acteur === "assistance",
      });
    }

    await tx
      .update(ticketSupport)
      .set({
        statut: suivant,
        // Prendre en charge nomme quelqu'un ; répondre aussi, faute de quoi le
        // dossier resterait sans propriétaire jusqu'à un geste de plus.
        ...(acteur === "assistance" && (evenement === "prendre" || evenement === "repondre")
          ? { assigneAId: moi.id }
          : {}),
        ...(estReponseAuDemandeur && dossier.premiereReponseLe === null
          ? { premiereReponseLe: new Date() }
          : {}),
        ...(suivant === "resolu" ? { resoluLe: new Date() } : {}),
        modifieLe: new Date(),
      })
      .where(eq(ticketSupport.id, ticketId));

    // Le demandeur est prévenu de ce qui le concerne : une réponse qui lui est
    // destinée, ou la clôture. Ni la prise en charge ni la note interne — la
    // première ne lui apprend rien, la seconde ne lui appartient pas.
    if (estReponseAuDemandeur) {
      await enfilerNotificationTicket(tx, ticketId, "reponse");
    } else if (suivant === "resolu" && acteur === "assistance") {
      await enfilerNotificationTicket(tx, ticketId, "resolue");
    }

    // Règle 5 : toute action de l'assistance sur un dossier laisse sa trace.
    // Le geste du demandeur sur sa propre demande n'en est pas une.
    if (acteur === "assistance") {
      await tx.insert(journalAudit).values({
        auteurId: moi.id,
        auteurEmail: moi.email,
        action: `Support — ${evenement}`,
        entite: "ticket_support",
        entiteId: ticketId,
        motif: `Passage à « ${suivant} »`,
        avant: { statut: dossier.statut },
        apres: {
          statut: suivant,
          ...(interne ? { note: "interne" } : {}),
        },
        adresseIp: enTetes.get("x-forwarded-for")?.split(",")[0]?.trim(),
      });
    }
  });

  revalidatePath("/[locale]/(espaces)", "layout");
  return { ok: true };
}
