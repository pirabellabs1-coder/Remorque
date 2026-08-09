"use server";

import { and, eq, sql } from "drizzle-orm";

import { clientEnv } from "@/config/env-client";
import { compteConnecte } from "@/server/authentification/session";
import { db } from "@/server/db";
import { reversement, utilisateur } from "@/server/db/schema";

import { stripe } from "./stripe";

/**
 * Reversement au propriétaire — Stripe Connect.
 *
 * La plateforme encaisse d'abord et reverse ensuite. Ce n'est pas un détail
 * technique : c'est ce qui rend possibles le remboursement d'un locataire et
 * l'arbitrage d'un litige. Payer directement le propriétaire supprimerait tout
 * levier le jour où le matériel n'est pas conforme.
 *
 * Deux moments distincts :
 *  - l'ouverture du compte, faite une fois par le propriétaire lui-même ;
 *  - le virement, déclenché à la clôture de la location.
 *
 * **Le gel prime — règle 6.** Un litige ou un sinistre ouvert interdit le
 * transfert, et la vérification se fait en base au moment du virement, non au
 * moment où le reversement a été planifié : un dossier peut s'ouvrir entre les
 * deux.
 */

export type Reponse =
  | { ok: true; url?: string }
  | { ok: false; cle: string };

/**
 * Ouvre — ou reprend — l'inscription du propriétaire chez le prestataire.
 *
 * Aucune coordonnée bancaire ne transite par nos pages : le propriétaire les
 * saisit chez Stripe. C'est ce qui nous dispense de les détenir, et donc de
 * répondre de leur fuite.
 */
export async function ouvrirCompteReversement(): Promise<Reponse> {
  const moi = await compteConnecte();
  if (!moi) return { ok: false, cle: "connexionRequise" };

  const client = stripe();
  if (!client) return { ok: false, cle: "paiementIndisponible" };

  const [compte] = await db
    .select({ stripeCompteId: utilisateur.stripeCompteId, email: utilisateur.email })
    .from(utilisateur)
    .where(eq(utilisateur.id, moi.id))
    .limit(1);

  if (!compte) return { ok: false, cle: "interdit" };

  try {
    let identifiant = compte.stripeCompteId;

    if (!identifiant) {
      const cree = await client.accounts.create({
        type: "express",
        email: compte.email,
        capabilities: { transfers: { requested: true } },
        metadata: { utilisateurId: moi.id },
      });

      identifiant = cree.id;
      await db
        .update(utilisateur)
        .set({ stripeCompteId: identifiant })
        .where(eq(utilisateur.id, moi.id));
    }

    // Le lien est à usage unique et de courte durée : c'est Stripe qui le veut
    // ainsi, et c'est heureux — une adresse d'inscription qui traîne dans un
    // historique de navigation ouvrirait le compte d'un autre.
    const lien = await client.accountLinks.create({
      account: identifiant,
      type: "account_onboarding",
      refresh_url: `${clientEnv.NEXT_PUBLIC_SITE_URL}/proprietaire/revenus?connect=reprise`,
      return_url: `${clientEnv.NEXT_PUBLIC_SITE_URL}/proprietaire/revenus?connect=retour`,
    });

    return { ok: true, url: lien.url };
  } catch {
    return { ok: false, cle: "echec" };
  }
}

/** L'état du compte de reversement, tel qu'affiché au propriétaire. */
export async function etatCompteReversement(): Promise<
  "absent" | "incomplet" | "actif" | "indisponible"
> {
  const moi = await compteConnecte();
  if (!moi) return "absent";

  const client = stripe();
  if (!client) return "indisponible";

  const [compte] = await db
    .select({
      stripeCompteId: utilisateur.stripeCompteId,
      actif: utilisateur.stripeCompteActif,
    })
    .from(utilisateur)
    .where(eq(utilisateur.id, moi.id))
    .limit(1);

  if (!compte?.stripeCompteId) return "absent";
  if (compte.actif) return "actif";

  // L'état vient de Stripe, non de notre colonne : l'inscription se termine
  // chez eux, et rien ne nous prévient. On rafraîchit au moment de regarder.
  try {
    const distant = await client.accounts.retrieve(compte.stripeCompteId);
    const actif = Boolean(distant.payouts_enabled);

    if (actif) {
      await db
        .update(utilisateur)
        .set({ stripeCompteActif: true })
        .where(eq(utilisateur.id, moi.id));
    }

    return actif ? "actif" : "incomplet";
  } catch {
    return "incomplet";
  }
}

/**
 * Envoie les reversements dus à la clôture d'une location.
 *
 * Appelée par l'administration ou par une tâche planifiée. Idempotente : seuls
 * les reversements encore « planifiés » sont traités, et l'identifiant du
 * virement est inscrit avant tout changement de statut.
 */
export async function envoyerReversement(reservationId: string): Promise<Reponse> {
  const moi = await compteConnecte();
  if (!moi?.role) return { ok: false, cle: "interdit" };

  const client = stripe();
  if (!client) return { ok: false, cle: "paiementIndisponible" };

  const [ligne] = await db
    .select({
      id: reversement.id,
      statut: reversement.statut,
      montant: reversement.montant,
      devise: reversement.devise,
      beneficiaireId: reversement.beneficiaireId,
      compte: utilisateur.stripeCompteId,
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
    .from(reversement)
    .innerJoin(utilisateur, eq(utilisateur.id, reversement.beneficiaireId))
    .where(
      and(
        eq(reversement.reservationId, reservationId),
        eq(reversement.statut, "planifie"),
      ),
    )
    .limit(1);

  // Rien à envoyer : soit c'est déjà fait, soit rien n'était planifié. Dans les
  // deux cas, réessayer ne doit pas produire d'erreur.
  if (!ligne) return { ok: true };

  // Un reversement ramené à zéro — annulation entièrement remboursée — n'a
  // rien à virer : il se solde sur place. Le marquer « payé » sans virement
  // est exact, puisque tout ce qui était dû (rien) l'a été.
  if (ligne.montant <= 0) {
    await db
      .update(reversement)
      .set({ statut: "paye", envoyeLe: new Date() })
      .where(eq(reversement.id, ligne.id));
    return { ok: true };
  }

  if (ligne.gele) {
    await db
      .update(reversement)
      .set({ statut: "gele", geleMotif: "Dossier ouvert sur cette location" })
      .where(eq(reversement.id, ligne.id));
    return { ok: false, cle: "fondsGeles" };
  }

  if (!ligne.compte) return { ok: false, cle: "compteAbsent" };

  try {
    const virement = await client.transfers.create(
      {
        amount: ligne.montant,
        currency: ligne.devise.toLowerCase(),
        destination: ligne.compte,
        metadata: { reservationId, reversementId: ligne.id },
      },
      { idempotencyKey: `reversement-${ligne.id}` },
    );

    await db
      .update(reversement)
      .set({
        statut: "envoye",
        stripeTransferId: virement.id,
        envoyeLe: new Date(),
      })
      .where(eq(reversement.id, ligne.id));

    return { ok: true };
  } catch {
    // Le statut « échoué » est écrit : un reversement muet se cherche pendant
    // des semaines, un reversement en échec se voit et se relance.
    await db
      .update(reversement)
      .set({ statut: "echoue" })
      .where(eq(reversement.id, ligne.id));

    return { ok: false, cle: "echec" };
  }
}
