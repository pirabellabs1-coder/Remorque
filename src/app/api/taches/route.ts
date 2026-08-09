import { serverEnv } from "@/config/env-serveur";
import { executerTachesQuotidiennes } from "@/server/taches/quotidiennes";

/**
 * Tâches quotidiennes, déclenchées par la planification de l'hébergeur.
 *
 * Le même travail que `npm run taches`, derrière une porte HTTP : une
 * plateforme sans serveur n'a pas de crontab, elle appelle une adresse. La
 * logique reste dans `src/server/taches/`, appelée par les deux chemins — un
 * script qui divergerait de sa route finirait par ne plus faire la même chose
 * en production qu'en local.
 *
 * **La porte est fermée à clé.** Ces tâches expirent des demandes et libèrent
 * des cautions : laissées ouvertes, n'importe qui pourrait les déclencher en
 * boucle. Le secret est partagé avec la planification, qui le présente en
 * jeton porteur.
 */
export const dynamic = "force-dynamic";
/** Le tour complet interroge plusieurs tables et enfile des courriels. */
export const maxDuration = 60;

export async function GET(requete: Request): Promise<Response> {
  const attendu = serverEnv.CRON_SECRET;

  // Sans secret configuré, la route se tait plutôt que de s'ouvrir : une
  // configuration incomplète ne doit jamais élargir l'accès.
  if (!attendu) {
    return Response.json({ erreur: "planification non configurée" }, { status: 503 });
  }

  if (requete.headers.get("authorization") !== `Bearer ${attendu}`) {
    return Response.json({ erreur: "interdit" }, { status: 401 });
  }

  const bilan = await executerTachesQuotidiennes();
  return Response.json(bilan);
}
