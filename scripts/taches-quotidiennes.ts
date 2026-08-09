/**
 * Tâches quotidiennes : expirations, libérations de caution, rappels.
 *
 * À lancer une fois par jour par une tâche planifiée, avant `npm run
 * courriels` — les tâches enfilent, l'expéditeur expédie.
 */
import { executerTachesQuotidiennes } from "@/server/taches/quotidiennes";

async function principal() {
  const bilan = await executerTachesQuotidiennes();

  console.log("Tâches du jour :");
  console.log(`  demandes expirées       ${bilan.demandesExpirees}`);
  if (bilan.expirationsRefusees > 0) {
    console.log(`  expirations refusées    ${bilan.expirationsRefusees} — à examiner`);
  }
  console.log(`  cautions libérées       ${bilan.cautionsLiberees}`);
  console.log(`  rappels — expirations   ${bilan.rappels.demandesQuiExpirent}`);
  console.log(`  rappels — retraits      ${bilan.rappels.retraits}`);
  console.log(`  rappels — avis          ${bilan.rappels.avis}`);
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
