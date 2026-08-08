/**
 * Expédie la boîte d'envoi des notifications.
 *
 * À lancer par une tâche planifiée en production (`npm run courriels`), ou à
 * la main pour vider la file. Sans clé `RESEND_API_KEY`, le script rend les
 * courriels en attente sur la sortie standard — on voit exactement ce qui
 * partirait — et les laisse en file : rien n'est marqué envoyé sans l'être.
 */
import { asc, eq } from "drizzle-orm";

import { db } from "@/server/db";
import { notification, utilisateur } from "@/server/db/schema";
import { expedierEnAttente, rendreCourriel } from "@/server/notifications/expediteur";

async function principal() {
  const bilan = await expedierEnAttente();

  if (!bilan.fournisseurConfigure) {
    console.log(
      `Aucun fournisseur configuré (RESEND_API_KEY, COURRIEL_EXPEDITEUR) : ` +
        `${bilan.enAttente} courriel(s) restent en file.\n`,
    );

    const file = await db
      .select({
        gabarit: notification.gabarit,
        donnees: notification.donnees,
        email: utilisateur.email,
      })
      .from(notification)
      .innerJoin(utilisateur, eq(utilisateur.id, notification.destinataireId))
      .where(eq(notification.statut, "en_attente"))
      .orderBy(asc(notification.creeLe))
      .limit(10);

    for (const entree of file) {
      const rendu = await rendreCourriel(entree.gabarit, entree.donnees);
      console.log("────────────────────────────────────────");
      console.log(`À      : ${entree.email}`);
      console.log(`Sujet  : ${rendu.sujet}`);
      console.log(`\n${rendu.corps}\n`);
    }
  } else {
    console.log(
      `Expédiées : ${bilan.expediees} · échecs : ${bilan.echecs} · ` +
        `restent en file : ${bilan.enAttente}`,
    );
  }
}

principal().then(
  () => process.exit(0),
  (erreur) => {
    console.error(erreur);
    process.exit(1);
  },
);
