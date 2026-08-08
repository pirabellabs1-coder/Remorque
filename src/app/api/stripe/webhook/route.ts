import type Stripe from "stripe";
import { and, eq } from "drizzle-orm";

import { serverEnv } from "@/config/env-serveur";
import { db } from "@/server/db";
import { caution, paiement, reservation } from "@/server/db/schema";
import { stripe, webhookConfigure } from "@/server/paiements/stripe";
import { changerStatut } from "@/server/reservations/transitions";

/**
 * Événements de paiement.
 *
 * **C'est ici, et nulle part ailleurs, qu'une réservation devient payée.** Le
 * retour du navigateur sur la page de succès ne prouve rien : l'adresse se
 * recopie. Seul un événement signé par Stripe, vérifié contre le secret du
 * point d'entrée, fait foi.
 *
 * Stripe rejoue les événements qu'il croit perdus — plusieurs fois, parfois
 * des jours plus tard. Tout ce qui est écrit ici doit donc pouvoir l'être deux
 * fois sans dommage : le paiement déjà enregistré fait sortir tout de suite, et
 * la transition est de toute façon refusée par la machine si l'état a bougé.
 */

/** Le corps brut est nécessaire : la signature couvre les octets, pas l'objet. */
async function evenementVerifie(requete: Request): Promise<Stripe.Event | null> {
  const client = stripe();
  const secret = serverEnv.STRIPE_WEBHOOK_SECRET;
  if (!client || !secret) return null;

  const signature = requete.headers.get("stripe-signature");
  if (!signature) return null;

  try {
    return await client.webhooks.constructEventAsync(
      await requete.text(),
      signature,
      secret,
    );
  } catch {
    // Signature invalide : c'est soit une erreur de configuration, soit
    // quelqu'un qui essaie de déclarer un paiement qui n'a pas eu lieu.
    return null;
  }
}

async function encaisser(session: Stripe.Checkout.Session): Promise<void> {
  const reservationId = session.metadata?.reservationId ?? session.client_reference_id;
  if (!reservationId) return;

  const intention =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : (session.payment_intent?.id ?? null);

  if (!intention) return;

  // Déjà enregistré : Stripe rejoue, nous ne redébitons ni ne retransitionnons.
  const [connu] = await db
    .select({ id: paiement.id })
    .from(paiement)
    .where(eq(paiement.stripePaymentIntentId, intention))
    .limit(1);

  if (connu) return;

  const [dossier] = await db
    .select({
      id: reservation.id,
      devise: reservation.devise,
      totalLocataire: reservation.totalLocataire,
      caution: reservation.caution,
      fin: reservation.fin,
    })
    .from(reservation)
    .where(eq(reservation.id, reservationId))
    .limit(1);

  if (!dossier) return;

  // Le montant inscrit est celui que Stripe a réellement encaissé, non celui
  // qu'on croyait devoir encaisser : en cas d'écart, la comptabilité doit
  // porter le fait, et l'écart se verra au rapprochement.
  await db.insert(paiement).values({
    reservationId: dossier.id,
    statut: "capture",
    devise: (session.currency ?? dossier.devise).toUpperCase(),
    montant: session.amount_total ?? dossier.totalLocataire,
    stripePaymentIntentId: intention,
    moyenPaiement: session.payment_method_types?.[0] ?? null,
    autoriseLe: new Date(),
    captureLe: new Date(),
  });

  // La transition crée la caution et déclenche les notifications — un seul
  // chemin pour changer d'état, règle 4.
  await changerStatut({
    reservationId: dossier.id,
    evenement: "encaisser",
    acteur: "systeme",
    motif: `Paiement encaissé (${intention})`,
  });

  // Le moyen de paiement conservé porte l'empreinte de caution : sans lui, on
  // ne pourrait pas débiter en cas de dommage, et la garantie serait un mot.
  const client = stripe();
  if (!client) return;

  const intentionComplete = await client.paymentIntents.retrieve(intention);
  const moyen =
    typeof intentionComplete.payment_method === "string"
      ? intentionComplete.payment_method
      : (intentionComplete.payment_method?.id ?? null);

  if (!moyen) return;

  await db
    .update(caution)
    .set({ stripePaymentMethodId: moyen, stripePaymentIntentId: intention })
    .where(
      and(
        eq(caution.reservationId, dossier.id),
        eq(caution.statut, "constituee"),
      ),
    );
}

export async function POST(requete: Request) {
  if (!webhookConfigure()) {
    // Mieux vaut refuser que d'accepter en silence : un 503 se voit dans le
    // tableau de bord Stripe, un 200 muet ferait croire à un traitement.
    return new Response(null, { status: 503 });
  }

  const evenement = await evenementVerifie(requete);
  if (!evenement) return new Response(null, { status: 400 });

  if (evenement.type === "checkout.session.completed") {
    await encaisser(evenement.data.object);
  }

  // Tout le reste est acquitté sans traitement : renvoyer une erreur ferait
  // rejouer indéfiniment un événement qui ne nous concerne pas.
  return new Response(null, { status: 200 });
}
