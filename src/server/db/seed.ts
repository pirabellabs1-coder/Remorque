/**
 * Amorçage de la base : pays de lancement et catalogue des catégories.
 *
 * Idempotent — le script peut être relancé sans dupliquer les données.
 * Exécution : `npm run db:seed`.
 */
import { BAREME_PAR_DEFAUT } from "@/config/baremes";
import { CATEGORIES } from "@/config/categories";

import { db, sql } from "./index";
import { categorie, pays } from "./schema";

const PAYS_DE_LANCEMENT = {
  code: "FR",
  nom: "France",
  marche: "fr-FR",
  langue: "fr",
  devise: "EUR",
  actif: true,
  ...BAREME_PAR_DEFAUT,
} as const;

async function seed() {
  await db
    .insert(pays)
    .values(PAYS_DE_LANCEMENT)
    .onConflictDoNothing({ target: pays.code });

  await db
    .insert(categorie)
    .values(
      // `usages` est un texte éditorial destiné aux pages publiques : il n'a
      // pas sa place dans la table du catalogue.
      CATEGORIES.map(({ slug, nom, releveKilometrique }, index) => ({
        slug,
        nom,
        releveKilometrique,
        ordre: index,
      })),
    )
    .onConflictDoNothing({ target: categorie.slug });

  console.log(
    `Amorçage terminé : 1 pays, ${CATEGORIES.length} catégories.`,
  );
}

seed()
  .catch((erreur) => {
    console.error("Échec de l'amorçage :", erreur);
    process.exitCode = 1;
  })
  .finally(() => sql.end());
