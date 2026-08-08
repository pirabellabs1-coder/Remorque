import "server-only";

import Stripe from "stripe";

import { serverEnv } from "@/config/env-serveur";

/**
 * Accès au prestataire de paiement.
 *
 * La clé est facultative dans la configuration, et c'est délibéré : le projet
 * doit se lancer, se tester et se démontrer sans compte Stripe. Ce module rend
 * donc `null` plutôt que de lever, et **chaque appelant doit dire la vérité à
 * l'usager** — un bouton « Payer » qui échoue en silence vaut moins qu'un
 * bouton qui annonce que le paiement n'est pas encore ouvert.
 *
 * La version d'API est épinglée. Sans épinglage, Stripe sert la plus récente au
 * compte : le comportement changerait un matin, sans qu'aucune ligne de ce
 * dépôt n'ait bougé.
 */

const VERSION_API = "2026-06-24.dahlia" as const;

let client: Stripe | null | undefined;

export function stripe(): Stripe | null {
  if (client !== undefined) return client;

  const cle = serverEnv.STRIPE_SECRET_KEY;
  client = cle ? new Stripe(cle, { apiVersion: VERSION_API }) : null;
  return client;
}

/** Le paiement est-il ouvert ? Lu par les écrans avant de proposer de régler. */
export function paiementConfigure(): boolean {
  return Boolean(serverEnv.STRIPE_SECRET_KEY);
}

/** La vérification de signature des événements est-elle possible ? */
export function webhookConfigure(): boolean {
  return Boolean(serverEnv.STRIPE_SECRET_KEY && serverEnv.STRIPE_WEBHOOK_SECRET);
}
