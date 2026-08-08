"use server";

import { and, eq } from "drizzle-orm";

import { clientEnv } from "@/config/env-client";
import { composerReglement } from "@/domain/paiement/montants";
import { compteConnecte } from "@/server/authentification/session";
import { db } from "@/server/db";
import { annonce, reservation } from "@/server/db/schema";

import { paiementConfigure, stripe } from "./stripe";

/**
 * Ouverture d'une session de règlement.
 *
 * Le locataire règle une fois la demande acceptée : c'est ce que dit la
 * machine à états — « acceptée » puis « payée » — et c'est ce qu'annonce le
 * courriel d'acceptation.
 *
 * Deux choses se font au même moment, et c'est voulu : le débit du loyer, et
 * l'enregistrement du moyen de paiement pour la caution. La caution est une
 * empreinte, non une préautorisation (M07) : une préautorisation expire au bout
 * de sept jours, ce qui ne couvrirait ni une location de deux semaines ni le
 * délai de constatation d'un dommage. On garde donc la carte, et on ne la
 * débite qu'en cas de dommage constaté.
 *
 * **Aucune transition ici.** Le retour du navigateur sur la page de succès ne
 * prouve rien — il se falsifie en recopiant une adresse. C'est l'événement
 * signé par Stripe qui fait passer la réservation à « payée ».
 */

export type Reponse =
  | { ok: true; url: string }
  | { ok: false; cle: string };

export async function ouvrirPaiement(reservationId: string): Promise<Reponse> {
  const moi = await compteConnecte();
  if (!moi) return { ok: false, cle: "connexionRequise" };

  const client = stripe();
  if (!client || !paiementConfigure()) {
    return { ok: false, cle: "paiementIndisponible" };
  }

  const [dossier] = await db
    .select({
      id: reservation.id,
      numero: reservation.numero,
      statut: reservation.statut,
      devise: reservation.devise,
      loyer: reservation.loyer,
      fraisService: reservation.fraisService,
      primeAssurance: reservation.primeAssurance,
      fraisLivraison: reservation.fraisLivraison,
      remise: reservation.remise,
      totalLocataire: reservation.totalLocataire,
      annonceTitre: annonce.titre,
    })
    .from(reservation)
    .innerJoin(annonce, eq(annonce.id, reservation.annonceId))
    .where(
      and(
        eq(reservation.id, reservationId),
        // On ne règle que sa propre location : la garde est dans la clause,
        // le dossier d'autrui n'est pas même rapporté.
        eq(reservation.locataireId, moi.id),
      ),
    )
    .limit(1);

  if (!dossier) return { ok: false, cle: "interdit" };
  if (dossier.statut !== "acceptee") return { ok: false, cle: "statutIncompatible" };

  // Le montant vient du domaine, qui refuse si les lignes ne s'additionnent
  // pas au total figé. Mieux vaut ne rien encaisser qu'encaisser un écart.
  const reglement = composerReglement(dossier);
  if (!reglement.ok) return { ok: false, cle: reglement.motif };

  const racine = clientEnv.NEXT_PUBLIC_SITE_URL;

  try {
    const session = await client.checkout.sessions.create(
      {
        mode: "payment",
        // Le montant est celui figé à la réservation, en centimes, tel quel.
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: reglement.devise.toLowerCase(),
              unit_amount: reglement.total,
              product_data: {
                name: dossier.annonceTitre,
                description: dossier.numero,
              },
            },
          },
        ],
        payment_intent_data: {
          // La carte est conservée pour la caution, débitée seulement en cas
          // de dommage constaté.
          setup_future_usage: "off_session",
          metadata: { reservationId: dossier.id, numero: dossier.numero },
        },
        // Répétées sur la session : c'est ce que porte l'événement reçu au
        // webhook, et c'est par là qu'on retrouve la réservation.
        metadata: { reservationId: dossier.id, numero: dossier.numero },
        client_reference_id: dossier.id,
        customer_email: moi.email,
        success_url: `${racine}/compte/reservations?paiement=succes`,
        cancel_url: `${racine}/compte/reservations?paiement=abandon`,
      },
      {
        // Clé d'idempotence : un double clic, ou un rechargement, ne doit pas
        // ouvrir deux sessions de paiement sur la même réservation.
        idempotencyKey: `reglement-${dossier.id}`,
      },
    );

    if (!session.url) return { ok: false, cle: "echec" };
    return { ok: true, url: session.url };
  } catch {
    // Le détail de l'erreur reste au journal du serveur : il peut nommer un
    // compte ou une clé, et n'apprendrait rien d'utile au locataire.
    return { ok: false, cle: "echec" };
  }
}
