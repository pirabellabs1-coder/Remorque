import "server-only";

import { stripe } from "./stripe";

/**
 * Exécution bancaire d'un remboursement d'annulation.
 *
 * Le fait comptable — `paiement.montant_rembourse` — est écrit dans la
 * transaction de la transition ; le geste bancaire vient après, hors
 * transaction, comme pour la décision de litige : un appel réseau n'a rien à
 * faire au milieu d'un verrou, et un refus du prestataire n'invalide pas
 * l'annulation — l'écart se verra au rapprochement Stripe, qui compare ce que
 * la comptabilité annonce à ce que la banque a fait.
 *
 * Sans clé Stripe, le remboursement reste un fait comptable : c'est le régime
 * de la plateforme de démonstration, et la recette le documente.
 */
export async function executerRemboursementStripe(entree: {
  reservationId: string;
  /** PaymentIntent du paiement d'origine — sans lui, rien à rembourser. */
  intention: string | null;
  montant: number;
  motif: string;
}): Promise<void> {
  if (!entree.intention || entree.montant <= 0) return;

  const client = stripe();
  if (!client) return;

  try {
    await client.refunds.create(
      {
        payment_intent: entree.intention,
        amount: entree.montant,
        metadata: { reservationId: entree.reservationId, motif: entree.motif },
      },
      // Un double clic ne rembourse pas deux fois ; la clé porte le montant,
      // si bien qu'un remboursement complémentaire — décidé plus tard, d'un
      // autre montant — reste possible.
      { idempotencyKey: `annulation-${entree.reservationId}-${entree.montant}` },
    );
  } catch {
    // Carte expirée, litige bancaire en cours : le remboursement se règlera
    // autrement. Le fait comptable demeure, et le rapprochement verra l'écart.
  }
}
