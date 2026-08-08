/**
 * Pose les rappels du jour dans la boîte d'envoi.
 *
 * À lancer une fois par jour par une tâche planifiée, avant `npm run
 * courriels` qui, lui, expédie. Séparer les deux est délibéré : on peut
 * regarder ce qui a été posé avant que cela ne parte, et rejouer l'expédition
 * sans reposer les rappels.
 */
import { poserRappels } from "@/server/notifications/rappels";

async function principal() {
  const bilan = await poserRappels();

  console.log("Rappels posés :");
  console.log(`  demandes qui expirent  ${bilan.demandesQuiExpirent}`);
  console.log(`  retraits de demain     ${bilan.retraits}`);
  console.log(`  avis à écrire          ${bilan.avis}`);
  console.log("");
  console.log("Expédier avec : npm run courriels");
}

principal().then(
  () => process.exit(0),
  (erreur) => {
    console.error(erreur);
    process.exit(1);
  },
);
