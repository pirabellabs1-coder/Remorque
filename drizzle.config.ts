import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/server/db/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  // `postgis` et `topology` sont installées dans leurs propres schémas : sans
  // cette exclusion, drizzle-kit proposerait de supprimer leurs tables système
  // à chaque migration.
  schemaFilter: ["public"],
  extensionsFilters: ["postgis"],
  verbose: true,
  strict: true,
});
