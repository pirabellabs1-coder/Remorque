import { serverEnv } from "@/config/env-serveur";
import { expedierEnAttente } from "@/server/notifications/expediteur";

/**
 * Vidage de la boîte d'envoi, déclenché par la planification de l'hébergeur.
 *
 * À appeler **après** les tâches quotidiennes : celles-ci enfilent, celui-ci
 * expédie. Sans fournisseur configuré, l'expéditeur laisse tout en file et le
 * dit — rien n'est jamais marqué envoyé sans l'avoir été.
 *
 * Fermée à clé pour la même raison que les tâches : une file d'envoi qu'un
 * inconnu peut vider à volonté est une machine à courriels en double.
 */
export const dynamic = "force-dynamic";
/** L'expédition part par lots ; le fournisseur répond parfois lentement. */
export const maxDuration = 60;

export async function GET(requete: Request): Promise<Response> {
  const attendu = serverEnv.CRON_SECRET;

  if (!attendu) {
    return Response.json({ erreur: "planification non configurée" }, { status: 503 });
  }

  if (requete.headers.get("authorization") !== `Bearer ${attendu}`) {
    return Response.json({ erreur: "interdit" }, { status: 401 });
  }

  const bilan = await expedierEnAttente();
  return Response.json(bilan);
}
