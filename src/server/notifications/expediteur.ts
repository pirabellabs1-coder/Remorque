import "server-only";

import { asc, eq } from "drizzle-orm";
// `use-intl/core` plutôt que `next-intl` : le point d'entrée principal tire
// React avec lui, ce qui fait échouer le script d'expédition — lequel tourne
// dans Node nu, hors de tout rendu.
import { createTranslator } from "use-intl/core";

import { DEFAULT_MARKET, type Market } from "@/config/markets";
import { serverEnv } from "@/config/env-serveur";
import { chargerToutesLesTraductions } from "@/i18n/messages";
import { db } from "@/server/db";
import { notification, utilisateur } from "@/server/db/schema";

/**
 * Expédition des courriels — moitié « lecture » de la boîte d'envoi.
 *
 * Le texte est rendu ici, au moment de l'envoi, jamais à l'enfilage : les
 * gabarits vivent dans `next-intl` (règle 3) et une tournure corrigée
 * s'applique à toute la file, y compris aux courriels d'hier.
 *
 * Sans clé d'expédition configurée, la file reste en attente et le dit.
 * Une notification n'est **jamais** marquée envoyée sans l'avoir été —
 * un statut qui ment est pire qu'une file qui déborde, car il ne se
 * détecte qu'au moment où un usager jure n'avoir rien reçu.
 */

export type Rendu = { sujet: string; corps: string };

export async function rendreCourriel(
  gabarit: string,
  donnees: Record<string, string>,
  locale: Market = DEFAULT_MARKET,
): Promise<Rendu> {
  const messages = await chargerToutesLesTraductions(locale);
  // Le nom du gabarit vient de la base : l'appel est nécessairement dynamique,
  // et le typage statique des clés de `next-intl` ne peut pas le connaître.
  const t = createTranslator({ locale, messages, namespace: "courriels" }) as (
    cle: string,
    valeurs?: Record<string, string>,
  ) => string;

  return {
    sujet: t(`${gabarit}.sujet`, donnees),
    corps: t(`${gabarit}.corps`, donnees),
  };
}

async function envoyerParResend(
  destinataire: string,
  rendu: Rendu,
): Promise<{ ok: true } | { ok: false; erreur: string }> {
  const reponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serverEnv.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: serverEnv.COURRIEL_EXPEDITEUR,
      to: destinataire,
      subject: rendu.sujet,
      text: rendu.corps,
    }),
  });

  if (reponse.ok) return { ok: true };
  return { ok: false, erreur: `${reponse.status} ${await reponse.text()}` };
}

export type BilanExpedition = {
  expediees: number;
  echecs: number;
  enAttente: number;
  fournisseurConfigure: boolean;
};

/** Expédie la file en attente, du plus ancien au plus récent. */
export async function expedierEnAttente(limite = 50): Promise<BilanExpedition> {
  const file = await db
    .select({
      id: notification.id,
      gabarit: notification.gabarit,
      donnees: notification.donnees,
      email: utilisateur.email,
    })
    .from(notification)
    .innerJoin(utilisateur, eq(utilisateur.id, notification.destinataireId))
    .where(eq(notification.statut, "en_attente"))
    .orderBy(asc(notification.creeLe))
    .limit(limite);

  const configure = Boolean(serverEnv.RESEND_API_KEY && serverEnv.COURRIEL_EXPEDITEUR);

  if (!configure) {
    return {
      expediees: 0,
      echecs: 0,
      enAttente: file.length,
      fournisseurConfigure: false,
    };
  }

  let expediees = 0;
  let echecs = 0;

  for (const entree of file) {
    const rendu = await rendreCourriel(entree.gabarit, entree.donnees);
    const resultat = await envoyerParResend(entree.email, rendu);

    await db
      .update(notification)
      .set(
        resultat.ok
          ? { statut: "envoyee", envoyeLe: new Date(), erreur: null }
          : { statut: "echec", erreur: resultat.erreur },
      )
      .where(eq(notification.id, entree.id));

    if (resultat.ok) expediees += 1;
    else echecs += 1;
  }

  return {
    expediees,
    echecs,
    enAttente: file.length - expediees - echecs,
    fournisseurConfigure: true,
  };
}
