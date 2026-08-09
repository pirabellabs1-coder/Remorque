"use server";

import { and, eq, inArray } from "drizzle-orm";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  evaluerSinistre,
  gelActifSinistre,
  STATUTS_GELANTS_SINISTRE,
  type ActeurSinistre,
  type EvenementSinistre,
  type StatutSinistre,
} from "@/domain/sinistre/machine";
import { compteConnecte } from "@/server/authentification/session";
import { db } from "@/server/db";
import { journalAudit, reservation, sinistre } from "@/server/db/schema";
import { leverGelSiPlusRienOuvert, poserGel } from "@/server/finances/gel";
import { enfilerNotificationsSinistre } from "@/server/notifications/file";

/**
 * Déclaration et instruction des sinistres.
 *
 * Le sinistre porte de l'argent sans que la plateforme en décide : elle
 * transmet au courtier, enregistre ce que l'assureur conclut, et tient les
 * fonds immobilisés entre les deux — règle 6. Les effets du dossier sont donc
 * appliqués **dans la transaction de la transition**, comme pour le litige :
 * un sinistre clos dont les fonds resteraient gelés, ou un gel sans dossier,
 * sont les deux incohérences que ce montage rend impossibles.
 *
 * L'instruction revient à l'administration seule. C'est le domaine qui le
 * dit, et ce module ne fait que lui obéir.
 */

export type Reponse = { ok: true; id?: string } | { ok: false; cle: string };

/** Les états d'une location où un dommage a pu se produire. */
const STATUTS_DECLARABLES = ["en_cours", "restituee", "cloturee"] as const;

const declaration = z.object({
  reservationId: z.string().uuid(),
  description: z.string().trim().min(20).max(4000),
  // L'estimation chiffre ce que le gel immobilise et ce que l'assureur
  // recevra ; une déclaration sans ordre de grandeur n'est pas transmissible.
  montantEstime: z.coerce.number().int().positive(),
});

export async function declarerSinistre(donnees: FormData): Promise<Reponse> {
  const moi = await compteConnecte();
  if (!moi) return { ok: false, cle: "connexionRequise" };

  const analyse = declaration.safeParse({
    reservationId: donnees.get("reservationId"),
    description: donnees.get("description"),
    montantEstime: donnees.get("montantEstime"),
  });

  if (!analyse.success) return { ok: false, cle: "invalide" };
  const { reservationId, description, montantEstime } = analyse.data;

  const [dossier] = await db
    .select({
      locataireId: reservation.locataireId,
      proprietaireId: reservation.proprietaireId,
      devise: reservation.devise,
      statut: reservation.statut,
    })
    .from(reservation)
    .where(eq(reservation.id, reservationId))
    .limit(1);

  if (!dossier) return { ok: false, cle: "interdit" };

  // Seules les parties déclarent — pas l'administration, qui transmet et
  // n'a rien constaté elle-même sur le terrain.
  const estPartie =
    dossier.locataireId === moi.id || dossier.proprietaireId === moi.id;
  if (!estPartie) return { ok: false, cle: "interdit" };

  // Un dommage suppose que le matériel soit parti : ni demande ni location
  // jamais commencée ne peuvent porter un sinistre.
  if (!(STATUTS_DECLARABLES as readonly string[]).includes(dossier.statut)) {
    return { ok: false, cle: "statutInadapte" };
  }

  // Un seul dossier vivant à la fois : deux déclarations sur les mêmes faits
  // produiraient deux instructions, éventuellement contraires. La requête
  // cherche **un dossier vivant**, pas le premier venu : une location qui
  // porte un sinistre refusé puis un sinistre ouvert doit refuser la
  // troisième déclaration, quel que soit l'ordre où la base rend ses lignes.
  const [vivant] = await db
    .select({ id: sinistre.id })
    .from(sinistre)
    .where(
      and(
        eq(sinistre.reservationId, reservationId),
        inArray(sinistre.statut, [...STATUTS_GELANTS_SINISTRE]),
      ),
    )
    .limit(1);

  if (vivant) return { ok: false, cle: "dejaDeclare" };

  const cree = await db.transaction(async (tx) => {
    const [ligne] = await tx
      .insert(sinistre)
      .values({
        reservationId,
        declareParId: moi.id,
        statut: "declare",
        description,
        devise: dossier.devise,
        montantEstime,
      })
      .returning({ id: sinistre.id });

    await poserGel(tx, reservationId, "Sinistre déclaré sur cette location");
    await enfilerNotificationsSinistre(tx, reservationId, "declare");
    return ligne;
  });

  revalidatePath("/[locale]/(espaces)", "layout");
  return { ok: true, id: cree.id };
}

const instruction = z.object({
  sinistreId: z.string().uuid(),
  evenement: z.enum(["transmettre", "instruire", "indemniser", "refuser"]),
  referenceAssureur: z.string().trim().max(120).optional(),
  montant: z.coerce.number().int().min(0).optional(),
  motif: z.string().trim().max(2000).optional(),
});

/**
 * Fait franchir une étape au sinistre.
 *
 * Le domaine décide ; ce module lit l'état, vérifie la qualité de l'acteur,
 * applique et trace — règle 5. Aucune écriture directe sur `sinistre.statut`
 * ailleurs que par ici.
 */
export async function instruireSinistre(donnees: FormData): Promise<Reponse> {
  const moi = await compteConnecte();
  if (!moi) return { ok: false, cle: "connexionRequise" };

  const analyse = instruction.safeParse({
    sinistreId: donnees.get("sinistreId"),
    evenement: donnees.get("evenement"),
    referenceAssureur: donnees.get("referenceAssureur") ?? undefined,
    montant: donnees.get("montant") ?? undefined,
    motif: donnees.get("motif") ?? undefined,
  });

  if (!analyse.success) return { ok: false, cle: "invalide" };
  const { sinistreId, evenement, referenceAssureur, montant, motif } = analyse.data;

  const [dossier] = await db
    .select({
      id: sinistre.id,
      statut: sinistre.statut,
      reservationId: sinistre.reservationId,
      locataireId: reservation.locataireId,
      proprietaireId: reservation.proprietaireId,
    })
    .from(sinistre)
    .innerJoin(reservation, eq(reservation.id, sinistre.reservationId))
    .where(eq(sinistre.id, sinistreId))
    .limit(1);

  if (!dossier) return { ok: false, cle: "introuvable" };

  // La qualité de partie prime le rôle interne — même politique que le
  // litige : un agent de la plateforme qui est aussi locataire ou loueur de
  // cette location est traité en partie, et la machine lui refusera donc
  // toute instruction. Personne n'enterre ni ne solde son propre dossier.
  const acteur: ActeurSinistre =
    dossier.locataireId === moi.id
      ? "locataire"
      : dossier.proprietaireId === moi.id
        ? "proprietaire"
        : moi.role
          ? "administrateur"
          : "locataire";

  const verdict = evaluerSinistre(evenement as EvenementSinistre, {
    statut: dossier.statut as StatutSinistre,
    acteur,
    referenceAssureur,
    montantIndemnise: montant,
    motifRefus: motif,
  });

  if (!verdict.autorise) return { ok: false, cle: verdict.motif };

  const suivant = verdict.statutSuivant;
  const clos = !gelActifSinistre(suivant);
  const enTetes = await headers();

  await db.transaction(async (tx) => {
    await tx
      .update(sinistre)
      .set({
        statut: suivant,
        ...(evenement === "transmettre"
          ? { referenceAssureur: referenceAssureur ?? null, transmisLe: new Date() }
          : {}),
        ...(evenement === "indemniser" ? { montantIndemnise: montant ?? 0 } : {}),
        ...(evenement === "refuser" ? { refusMotif: motif ?? null } : {}),
        ...(clos ? { clotureLe: new Date() } : {}),
        modifieLe: new Date(),
      })
      .where(eq(sinistre.id, sinistreId));

    // Le dossier clos rend les fonds à leur cours normal — sauf si un litige
    // court encore sur la même location : la levée se constate, elle ne se
    // décrète pas.
    if (clos) {
      await leverGelSiPlusRienOuvert(tx, dossier.reservationId);
    }

    const gabarit =
      suivant === "transmis"
        ? "transmis"
        : suivant === "en_cours"
          ? "instruction"
          : suivant === "indemnise"
            ? "indemnise"
            : "refuse";

    await enfilerNotificationsSinistre(tx, dossier.reservationId, gabarit);

    await tx.insert(journalAudit).values({
      auteurId: moi.id,
      auteurEmail: moi.email,
      action: `Sinistre — ${evenement}`,
      entite: "sinistre",
      entiteId: sinistreId,
      motif: motif ?? `Passage à « ${suivant} »`,
      avant: { statut: dossier.statut },
      apres: {
        statut: suivant,
        ...(referenceAssureur ? { referenceAssureur } : {}),
        ...(montant !== undefined && evenement === "indemniser"
          ? { montantIndemnise: String(montant) }
          : {}),
      },
      adresseIp: enTetes.get("x-forwarded-for")?.split(",")[0]?.trim(),
    });
  });

  revalidatePath("/[locale]/(espaces)", "layout");
  return { ok: true };
}
