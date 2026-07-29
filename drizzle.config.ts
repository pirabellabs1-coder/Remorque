import { defineConfig } from "drizzle-kit";

import { chargerEnv } from "./src/config/charger-env";

chargerEnv();

/**
 * Les migrations passent par la connexion directe, jamais par le gestionnaire
 * de connexions : ce dernier travaille en mode transaction et ne sait pas
 * exécuter les instructions de définition de schéma.
 */
const url = process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL;

if (!url) {
  throw new Error(
    "DATABASE_URL_DIRECT ou DATABASE_URL doit être défini pour exécuter drizzle-kit.",
  );
}

export default defineConfig({
  schema: "./src/server/db/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url },
  // `postgis` installe ses propres tables système : sans ces filtres,
  // drizzle-kit proposerait de les supprimer à chaque migration.
  schemaFilter: ["public"],
  extensionsFilters: ["postgis"],
  verbose: true,
  strict: true,
});
