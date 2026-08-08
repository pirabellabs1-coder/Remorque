import "server-only";

import { inArray } from "drizzle-orm";

import { db } from "@/server/db";
import { utilisateur } from "@/server/db/schema";

/**
 * Préférences de notification.
 *
 * Trois familles, et une seule est désactivable.
 *
 * Les courriels **transactionnels** — acceptation, paiement, confirmation,
 * litige — ne se coupent pas : ils portent des faits qui engagent de l'argent
 * ou des obligations, et quelqu'un qui ne les recevrait pas découvrirait une
 * retenue sur caution sans jamais avoir été prévenu. Ce n'est pas de la
 * publicité qu'on subit, c'est le fil du contrat.
 *
 * Les **rappels** et les **messages**, eux, se coupent : ils rendent service
 * sans rien décider. Refuser un rappel de retrait est un choix légitime.
 *
 * Le stockage se fait dans la colonne `preferences`, en JSON : ces réglages
 * s'ajoutent et disparaissent au fil des fonctionnalités, et chacun vaudrait
 * une migration. Aucun ne conditionne un calcul métier — c'est le critère qui
 * autorise le document plutôt que le schéma.
 */

/**
 * Familles de gabarits désactivables, et la préférence qui les gouverne.
 *
 * Les clés sont celles de l'écran de réglage qui existait déjà : le brancher
 * valait mieux que d'en ajouter un second, où l'usager aurait coupé un
 * courriel dans l'un pour le voir arriver quand même, réglé par l'autre.
 */
const PREFERENCE_PAR_FAMILLE: Record<string, string> = {
  rappel: "rappels-courriel",
  messagerie: "messagesNotif-courriel",
};

/**
 * Filtre une liste de destinataires selon leurs préférences.
 *
 * Appelé au moment d'enfiler, non au moment d'expédier : une notification
 * qu'on n'enverra jamais n'a rien à faire dans la file, où elle donnerait le
 * change en attendant.
 */
export async function destinatairesAcceptant(
  destinataires: readonly string[],
  gabarit: string,
): Promise<string[]> {
  const preference = PREFERENCE_PAR_FAMILLE[gabarit.split(".")[0]];

  // Tout ce qui n'est pas explicitement optionnel est transactionnel : le
  // défaut penche vers l'envoi, jamais vers le silence.
  if (!preference) return [...destinataires];
  if (destinataires.length === 0) return [];

  const lignes = await db
    .select({ id: utilisateur.id, preferences: utilisateur.preferences })
    .from(utilisateur)
    .where(inArray(utilisateur.id, [...destinataires]));

  return lignes
    .filter((ligne) => {
      const stockees = (ligne.preferences ?? {}) as Record<string, unknown>;
      // Absente vaut acceptée : on se désabonne, on ne s'abonne pas.
      return stockees[preference] !== false;
    })
    .map((ligne) => ligne.id);
}
