/**
 * Amorçage de la base : pays de lancement et catalogue des catégories.
 *
 * Idempotent — le script peut être relancé sans dupliquer les données.
 * Exécution : `npm run db:seed`.
 *
 * La connexion est ouverte ici plutôt qu'importée de `./index.ts`. Ce dernier
 * dépend de `env-serveur.ts`, marqué `server-only` : un garde-fou qui fait
 * échouer la compilation si un secret est importé depuis un composant client.
 * Le garde-fou est juste, mais il ne distingue pas un composant client d'un
 * script d'administration lancé par `tsx` — les deux sont « hors serveur
 * Next.js ». Ouvrir la connexion sur place évite d'affaiblir la protection
 * pour la commodité d'un script, ce qui serait le mauvais côté de l'arbitrage.
 *
 * C'est déjà le parti pris de `scripts/preparer-base.ts`.
 */
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { BAREME_PAR_DEFAUT } from "@/config/baremes";
import { CATEGORIES } from "@/config/categories";
import { chargerEnv } from "@/config/charger-env";

import { categorie, pays } from "./schema";

chargerEnv();

// L'amorçage écrit : il passe par la connexion directe, en mode session, comme
// les migrations.
const url = process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL;

if (!url) {
  console.error(
    "DATABASE_URL_DIRECT ou DATABASE_URL doit être défini. Voir « .env.example ».",
  );
  process.exit(1);
}

const sql = postgres(url, { max: 1, prepare: false });
const db = drizzle(sql);

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
