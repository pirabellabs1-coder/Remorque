import "server-only";

import { eq } from "drizzle-orm";

import type { EffetsDecision } from "@/domain/litige/decision";
import { db } from "@/server/db";
import { caution, journalAudit, paiement, reservation } from "@/server/db/schema";
import { stripe } from "@/server/paiements/stripe";

/**
 * Exécution bancaire d'une décision d'arbitrage.
 *
 * La décision est un fait comptable, écrit dans la transaction qui la rend ;
 * l'exécution est un fait bancaire, qui vient après. Les séparer est voulu :
 * un appel réseau au milieu d'une transaction la tiendrait ouverte au gré du
 * prestataire, et un refus de carte n'invalide pas un arbitrage — la dette
 * demeure, elle se recouvre autrement.
 *
 * Deux gestes possibles, calqués sur ceux qui existent déjà :
 *
 *  - **La retenue** débite hors session le moyen de paiement conservé, comme
 *    `debiterCaution` — même plafond implicite (le domaine a déjà borné),
 *    même clé d'idempotence portant le montant.
 *  - **Le remboursement** rend au locataire, sur sa carte, ce que la
 *    réduction a retranché au propriétaire : un remboursement Stripe du
 *    paiement d'origine.
 *
 * Chaque geste, réussi ou refusé, s'inscrit au journal d'audit — règle 5. Le
 * silence n'est permis qu'en l'absence de clé Stripe : la plateforme de
 * démonstration n'a rien à exécuter, et la recette le documente.
 */
export async function executerEffetsStripe(entree: {
  reservationId: string;
  litigeId: string;
  effets: EffetsDecision;
  motif: string;
  auteur: { id: string; email: string };
}): Promise<void> {
  const { effets } = entree;
  if (effets.retenueCaution <= 0 && effets.remboursementLocataire <= 0) return;

  const client = stripe();
  if (!client) return;

  const resultats: Record<string, string> = {};

  if (effets.retenueCaution > 0) {
    const [garantie] = await db
      .select({
        moyen: caution.stripePaymentMethodId,
        devise: caution.devise,
        reference: reservation.numero,
      })
      .from(caution)
      .innerJoin(reservation, eq(reservation.id, caution.reservationId))
      .where(eq(caution.reservationId, entree.reservationId))
      .limit(1);

    if (!garantie?.moyen) {
      resultats.retenue = "moyen absent";
    } else {
      try {
        const moyenPaiement = await client.paymentMethods.retrieve(garantie.moyen);
        const clientId =
          typeof moyenPaiement.customer === "string"
            ? moyenPaiement.customer
            : (moyenPaiement.customer?.id ?? undefined);

        const intention = await client.paymentIntents.create(
          {
            amount: effets.retenueCaution,
            currency: garantie.devise.toLowerCase(),
            customer: clientId,
            payment_method: garantie.moyen,
            off_session: true,
            confirm: true,
            description: `Retenue sur caution — ${garantie.reference}`,
            metadata: { reservationId: entree.reservationId, motif: entree.motif },
          },
          { idempotencyKey: `litige-${entree.litigeId}-caution-${effets.retenueCaution}` },
        );
        resultats.retenue = intention.id;
      } catch {
        resultats.retenue = "refuse";
      }
    }
  }

  if (effets.remboursementLocataire > 0) {
    const [reglement] = await db
      .select({ intention: paiement.stripePaymentIntentId })
      .from(paiement)
      .where(eq(paiement.reservationId, entree.reservationId))
      .limit(1);

    if (!reglement?.intention) {
      resultats.remboursement = "paiement d'origine introuvable";
    } else {
      try {
        const remboursement = await client.refunds.create(
          {
            payment_intent: reglement.intention,
            amount: effets.remboursementLocataire,
            metadata: { reservationId: entree.reservationId, motif: entree.motif },
          },
          {
            idempotencyKey: `litige-${entree.litigeId}-remboursement-${effets.remboursementLocataire}`,
          },
        );
        resultats.remboursement = remboursement.id;
      } catch {
        resultats.remboursement = "refuse";
      }
    }
  }

  await db.insert(journalAudit).values({
    auteurId: entree.auteur.id,
    auteurEmail: entree.auteur.email,
    action: "Litige — exécution bancaire",
    entite: "litige",
    entiteId: entree.litigeId,
    motif: entree.motif || "Exécution de la décision d'arbitrage",
    avant: {
      retenueCaution: String(effets.retenueCaution),
      remboursementLocataire: String(effets.remboursementLocataire),
    },
    apres: resultats,
  });
}
