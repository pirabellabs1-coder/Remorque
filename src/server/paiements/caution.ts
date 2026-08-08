"use server";

import { and, eq, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { compteConnecte } from "@/server/authentification/session";
import { db } from "@/server/db";
import { caution, journalAudit, reservation } from "@/server/db/schema";

import { stripe } from "./stripe";

/**
 * Débit d'une caution après dommage constaté.
 *
 * C'est le geste le plus lourd de la plateforme : de l'argent est prélevé sur
 * la carte de quelqu'un qui n'est plus devant son écran. Les garde-fous sont
 * donc nombreux et volontairement redondants.
 *
 *  - **Réservé à l'administration.** Ni le propriétaire ni un algorithme ne
 *    décident d'une retenue : elle suppose un constat, souvent un litige, et
 *    toujours quelqu'un qui en répond.
 *  - **Plafonné au montant de la caution.** Une empreinte ne couvre pas
 *    au-delà d'elle-même ; prélever plus reviendrait à ouvrir un crédit que
 *    personne n'a consenti.
 *  - **Motif obligatoire.** Il figure au journal d'audit et sera opposé au
 *    locataire s'il conteste. Une retenue sans motif est indéfendable.
 *  - **Trace systématique** — règle 5 : auteur, motif, état avant et après.
 *
 * Le débit se fait hors session, sur le moyen de paiement conservé au
 * règlement. Sans lui, il n'y a rien à débiter et la garantie n'est qu'un mot :
 * c'est pourquoi la recette du paiement vérifie sa présence.
 */

export type Reponse = { ok: true } | { ok: false; cle: string };

const schema = z.object({
  reservationId: z.string().uuid(),
  montant: z.coerce.number().int().positive(),
  motif: z.string().trim().min(10).max(1000),
});

export async function debiterCaution(donnees: FormData): Promise<Reponse> {
  const moi = await compteConnecte();
  if (!moi?.role) return { ok: false, cle: "interdit" };

  const analyse = schema.safeParse({
    reservationId: donnees.get("reservationId"),
    montant: donnees.get("montant"),
    motif: donnees.get("motif"),
  });

  if (!analyse.success) return { ok: false, cle: "invalide" };
  const { reservationId, montant, motif } = analyse.data;

  const [ligne] = await db
    .select({
      id: caution.id,
      statut: caution.statut,
      montantCaution: caution.montant,
      montantDebite: caution.montantDebite,
      devise: caution.devise,
      moyen: caution.stripePaymentMethodId,
      reference: reservation.numero,
      locataireId: reservation.locataireId,
    })
    .from(caution)
    .innerJoin(reservation, eq(reservation.id, caution.reservationId))
    .where(eq(caution.reservationId, reservationId))
    .limit(1);

  if (!ligne) return { ok: false, cle: "introuvable" };

  // Une caution déjà libérée n'a plus d'empreinte : les fonds sont rendus, et
  // rien ne peut plus être prélevé dessus.
  if (ligne.statut === "liberee") return { ok: false, cle: "dejaLiberee" };

  const restant = ligne.montantCaution - ligne.montantDebite;
  if (montant > restant) return { ok: false, cle: "plafondDepasse" };

  if (!ligne.moyen) return { ok: false, cle: "moyenAbsent" };

  const client = stripe();
  if (!client) return { ok: false, cle: "paiementIndisponible" };

  // Le client Stripe est retrouvé depuis le moyen de paiement conservé : un
  // prélèvement hors session en a besoin.
  let intention: string;
  try {
    const moyenPaiement = await client.paymentMethods.retrieve(ligne.moyen);
    const clientId =
      typeof moyenPaiement.customer === "string"
        ? moyenPaiement.customer
        : (moyenPaiement.customer?.id ?? undefined);

    const paiement = await client.paymentIntents.create(
      {
        amount: montant,
        currency: ligne.devise.toLowerCase(),
        customer: clientId,
        payment_method: ligne.moyen,
        // Le locataire n'est pas devant son écran : s'il faut une
        // authentification, le prélèvement échoue plutôt que d'attendre.
        off_session: true,
        confirm: true,
        description: `Retenue sur caution — ${ligne.reference}`,
        metadata: { reservationId, motif },
      },
      // Un double clic ne doit pas prélever deux fois. La clé porte le montant :
      // une seconde retenue, d'un montant différent, reste possible.
      { idempotencyKey: `caution-${ligne.id}-${montant}` },
    );

    intention = paiement.id;
  } catch {
    // Carte expirée, plafond atteint, authentification exigée : autant de cas
    // où la retenue devra se régler autrement. Rien n'est écrit.
    return { ok: false, cle: "debitRefuse" };
  }

  const debiteTotal = ligne.montantDebite + montant;

  await db.transaction(async (tx) => {
    await tx
      .update(caution)
      .set({
        montantDebite: debiteTotal,
        statut: debiteTotal >= ligne.montantCaution ? "retenue" : "debitee_partiellement",
        debitMotif: motif,
        modifieLe: new Date(),
      })
      .where(eq(caution.id, ligne.id));

    const enTetes = await headers();

    await tx.insert(journalAudit).values({
      auteurId: moi.id,
      auteurEmail: moi.email,
      action: "Retenue sur caution",
      entite: "caution",
      entiteId: ligne.id,
      motif,
      avant: { montantDebite: String(ligne.montantDebite), statut: ligne.statut },
      apres: { montantDebite: String(debiteTotal), intention },
      adresseIp: enTetes.get("x-forwarded-for")?.split(",")[0]?.trim(),
    });
  });

  revalidatePath("/[locale]/(espaces)/admin", "layout");
  revalidatePath("/[locale]/(espaces)/compte", "layout");
  return { ok: true };
}

/**
 * Libération d'une caution.
 *
 * Le gel prime — règle 6 : un litige ou un sinistre ouvert interdit la
 * libération, et la vérification est faite en base plutôt que passée en
 * paramètre. L'appelant pourrait l'oublier, et l'oubli signifierait rendre les
 * fonds au milieu d'un dossier en cours.
 */
export async function libererCaution(reservationId: string): Promise<Reponse> {
  const moi = await compteConnecte();
  if (!moi?.role) return { ok: false, cle: "interdit" };

  const [ligne] = await db
    .select({
      id: caution.id,
      statut: caution.statut,
      gele: sql<boolean>`exists (
        select 1 from litige l
        where l.reservation_id = ${reservationId}
          and l.statut not in ('resolu', 'clos_sans_suite')
      ) or exists (
        select 1 from sinistre s
        where s.reservation_id = ${reservationId}
          and s.statut in ('declare', 'transmis', 'en_cours')
      )`,
    })
    .from(caution)
    .where(eq(caution.reservationId, reservationId))
    .limit(1);

  if (!ligne) return { ok: false, cle: "introuvable" };
  if (ligne.gele) return { ok: false, cle: "fondsGeles" };
  if (ligne.statut === "liberee") return { ok: true };

  await db.transaction(async (tx) => {
    await tx
      .update(caution)
      .set({ statut: "liberee", libereeLe: new Date() })
      .where(and(eq(caution.id, ligne.id)));

    await tx.insert(journalAudit).values({
      auteurId: moi.id,
      auteurEmail: moi.email,
      action: "Caution libérée",
      entite: "caution",
      entiteId: ligne.id,
      motif: "Libération manuelle depuis l'administration",
      avant: { statut: ligne.statut },
      apres: { statut: "liberee" },
    });
  });

  revalidatePath("/[locale]/(espaces)/admin", "layout");
  revalidatePath("/[locale]/(espaces)/compte", "layout");
  return { ok: true };
}
