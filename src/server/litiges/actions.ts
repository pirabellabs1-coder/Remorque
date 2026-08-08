"use server";

import { and, eq, inArray } from "drizzle-orm";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  evaluerLitige,
  gelActif,
  MOTIFS_LITIGE,
  type ActeurLitige,
  type EvenementLitige,
  type StatutLitige,
} from "@/domain/litige/machine";
import { compteConnecte } from "@/server/authentification/session";
import { db } from "@/server/db";
import {
  caution,
  journalAudit,
  litige,
  reservation,
  reversement,
} from "@/server/db/schema";
import { enfilerNotificationsLitige } from "@/server/notifications/file";

/**
 * Ouverture et instruction des litiges.
 *
 * Le litige porte de l'argent : son ouverture gèle le transfert au
 * propriétaire et la libération de la caution — règle 6 — et sa résolution
 * décide qui touche quoi. Les effets financiers sont donc appliqués **dans la
 * transaction de la transition**, jamais après : un litige résolu dont les
 * fonds resteraient gelés, ou un gel sans litige, sont les deux incohérences
 * que ce montage rend impossibles.
 *
 * La décision revient à la plateforme seule. C'est le domaine qui le dit, et
 * ce module ne fait que lui obéir.
 */

export type Reponse = { ok: true; id?: string } | { ok: false; cle: string };

const ouverture = z.object({
  reservationId: z.string().uuid(),
  motif: z.enum(MOTIFS_LITIGE),
  description: z.string().trim().min(20).max(4000),
  // Un litige sans montant réclamé n'est pas instruisable : l'arbitre ne
  // saurait pas sur quoi trancher.
  montantReclame: z.coerce.number().int().positive(),
});

/** Le rôle du compte connecté **sur cette réservation précise**. */
async function roleSurDossier(
  reservationId: string,
  compteId: string,
  estAdmin: boolean,
): Promise<{ role: ActeurLitige; devise: string; caution: number } | null> {
  const [dossier] = await db
    .select({
      locataireId: reservation.locataireId,
      proprietaireId: reservation.proprietaireId,
      devise: reservation.devise,
      caution: reservation.caution,
      statut: reservation.statut,
    })
    .from(reservation)
    .where(eq(reservation.id, reservationId))
    .limit(1);

  if (!dossier) return null;

  if (dossier.locataireId === compteId) {
    return { role: "locataire", devise: dossier.devise, caution: dossier.caution };
  }
  if (dossier.proprietaireId === compteId) {
    return { role: "proprietaire", devise: dossier.devise, caution: dossier.caution };
  }
  if (estAdmin) {
    return { role: "administrateur", devise: dossier.devise, caution: dossier.caution };
  }

  return null;
}

export async function ouvrirLitige(donnees: FormData): Promise<Reponse> {
  const moi = await compteConnecte();
  if (!moi) return { ok: false, cle: "connexionRequise" };

  const analyse = ouverture.safeParse({
    reservationId: donnees.get("reservationId"),
    motif: donnees.get("motif"),
    description: donnees.get("description"),
    montantReclame: donnees.get("montantReclame"),
  });

  if (!analyse.success) return { ok: false, cle: "invalide" };
  const { reservationId, motif, description, montantReclame } = analyse.data;

  const partie = await roleSurDossier(reservationId, moi.id, Boolean(moi.role));
  if (!partie) return { ok: false, cle: "interdit" };

  // Réclamer plus que la caution n'a pas de sens : c'est tout ce que la
  // plateforme peut retenir. Au-delà, le recours est judiciaire, pas ici.
  if (montantReclame > partie.caution) return { ok: false, cle: "montantExcessif" };

  const [existant] = await db
    .select({ id: litige.id, statut: litige.statut })
    .from(litige)
    .where(eq(litige.reservationId, reservationId))
    .limit(1);

  // Un seul litige à la fois par location : deux dossiers ouverts sur les
  // mêmes faits produiraient deux décisions, éventuellement contraires.
  if (existant && gelActif(existant.statut as StatutLitige)) {
    return { ok: false, cle: "dejaOuvert" };
  }

  const cree = await db.transaction(async (tx) => {
    const [ligne] = await tx
      .insert(litige)
      .values({
        reservationId,
        ouvertParId: moi.id,
        statut: "ouvert",
        motif,
        description,
        devise: partie.devise,
        montantReclame,
      })
      .returning({ id: litige.id });

    await appliquerGel(tx, reservationId, true, "Litige ouvert sur cette location");
    await enfilerNotificationsLitige(tx, reservationId, "ouvert");
    return ligne;
  });

  revalidatePath("/[locale]/(espaces)", "layout");
  return { ok: true, id: cree.id };
}

/**
 * Pose ou lève le gel des fonds sur une location.
 *
 * Écrit aux trois endroits qui le portent — la réservation, la caution, le
 * reversement — parce que trois écrans différents le lisent. Les laisser
 * diverger, c'est promettre au propriétaire un virement que le litige interdit.
 */
async function appliquerGel(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  reservationId: string,
  gele: boolean,
  motif: string,
): Promise<void> {
  await tx
    .update(reservation)
    .set({ fondsGeles: gele, modifieLe: new Date() })
    .where(eq(reservation.id, reservationId));

  await tx
    .update(caution)
    .set(
      gele
        ? { statut: "contestee", contesteeLe: new Date() }
        : { statut: "constituee" },
    )
    .where(
      and(
        eq(caution.reservationId, reservationId),
        inArray(caution.statut, gele ? ["constituee"] : ["contestee"]),
      ),
    );

  await tx
    .update(reversement)
    .set(
      gele
        ? { statut: "gele", geleMotif: motif }
        : { statut: "planifie", geleMotif: null },
    )
    .where(
      and(
        eq(reversement.reservationId, reservationId),
        inArray(reversement.statut, gele ? ["planifie"] : ["gele"]),
      ),
    );
}

const instruction = z.object({
  litigeId: z.string().uuid(),
  evenement: z.enum(["proposer", "escalader", "trancher", "classer", "retirer"]),
  montant: z.coerce.number().int().min(0).optional(),
  decisionMotif: z.string().trim().max(2000).optional(),
});

/**
 * Fait franchir une étape au litige.
 *
 * Le domaine décide ; ce module lit l'état, vérifie la qualité de l'acteur sur
 * ce dossier précis, applique et trace. Aucune écriture directe sur
 * `litige.statut` ailleurs que par ici.
 */
export async function franchirLitige(donnees: FormData): Promise<Reponse> {
  const moi = await compteConnecte();
  if (!moi) return { ok: false, cle: "connexionRequise" };

  const analyse = instruction.safeParse({
    litigeId: donnees.get("litigeId"),
    evenement: donnees.get("evenement"),
    montant: donnees.get("montant") ?? undefined,
    decisionMotif: donnees.get("decisionMotif") ?? undefined,
  });

  if (!analyse.success) return { ok: false, cle: "invalide" };
  const { litigeId, evenement, montant, decisionMotif } = analyse.data;

  const [dossier] = await db
    .select({
      id: litige.id,
      statut: litige.statut,
      reservationId: litige.reservationId,
      ouvertParId: litige.ouvertParId,
      montantReclame: litige.montantReclame,
    })
    .from(litige)
    .where(eq(litige.id, litigeId))
    .limit(1);

  if (!dossier) return { ok: false, cle: "introuvable" };

  const partie = await roleSurDossier(
    dossier.reservationId,
    moi.id,
    Boolean(moi.role),
  );
  if (!partie) return { ok: false, cle: "interdit" };

  // Seul celui qui a ouvert peut retirer : l'autre partie n'a pas à faire
  // disparaître une réclamation qui la vise.
  if (evenement === "retirer" && dossier.ouvertParId !== moi.id) {
    return { ok: false, cle: "interdit" };
  }

  const verdict = evaluerLitige(evenement as EvenementLitige, {
    statut: dossier.statut as StatutLitige,
    acteur: partie.role,
    montantAccorde: montant,
    montantReclame: dossier.montantReclame ?? undefined,
    decisionMotif,
  });

  if (!verdict.autorise) return { ok: false, cle: verdict.motif };

  const suivant = verdict.statutSuivant;
  const enTetes = await headers();

  await db.transaction(async (tx) => {
    await tx
      .update(litige)
      .set({
        statut: suivant,
        ...(evenement === "proposer" ? { montantPropose: montant ?? null } : {}),
        ...(evenement === "trancher"
          ? {
              montantAccorde: montant ?? 0,
              decisionMotif: decisionMotif ?? null,
              arbitreId: moi.id,
              resoluLe: new Date(),
            }
          : {}),
        ...(suivant === "clos_sans_suite" ? { resoluLe: new Date() } : {}),
        modifieLe: new Date(),
      })
      .where(eq(litige.id, litigeId));

    // Le dossier clos rend les fonds à leur cours normal — c'est la seconde
    // moitié de la règle 6, celle qu'on oublie.
    if (!gelActif(suivant)) {
      await appliquerGel(tx, dossier.reservationId, false, "");
    }

    const gabarit =
      suivant === "resolu"
        ? "resolu"
        : suivant === "clos_sans_suite"
          ? "classe"
          : suivant === "en_arbitrage"
            ? "arbitrage"
            : "proposition";

    await enfilerNotificationsLitige(tx, dossier.reservationId, gabarit);

    await tx.insert(journalAudit).values({
      auteurId: moi.id,
      auteurEmail: moi.email,
      action: `Litige — ${evenement}`,
      entite: "litige",
      entiteId: litigeId,
      motif: decisionMotif ?? `Passage à « ${suivant} »`,
      avant: { statut: dossier.statut },
      apres: {
        statut: suivant,
        ...(montant !== undefined ? { montant: String(montant) } : {}),
      },
      adresseIp: enTetes.get("x-forwarded-for")?.split(",")[0]?.trim(),
    });
  });

  revalidatePath("/[locale]/(espaces)", "layout");
  return { ok: true };
}
