/**
 * Installe les extensions PostgreSQL requises par le schéma.
 *
 * À exécuter une fois, avant la première migration : `npm run db:prepare`.
 * Passe par la connexion directe — le gestionnaire de connexions ne sait pas
 * exécuter d'instruction de définition de schéma.
 *
 * Fonctionne aussi bien sur Supabase que sur une base locale ou conteneurisée.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";

import postgres from "postgres";

const url = process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL;

if (!url) {
  console.error(
    "DATABASE_URL_DIRECT ou DATABASE_URL doit être défini. Voir .env.example.",
  );
  process.exit(1);
}

const sql = postgres(url, { max: 1 });

async function preparer() {
  const chemin = path.join(process.cwd(), "scripts", "init-db.sql");
  const instructions = await readFile(chemin, "utf8");

  await sql.unsafe(instructions);

  const [{ version }] = await sql<{ version: string }[]>`
    SELECT postgis_lib_version() AS version
  `;
  console.log(`Extensions installées. PostGIS ${version}.`);
}

preparer()
  .catch((erreur) => {
    console.error("Échec de la préparation de la base :", erreur);
    process.exitCode = 1;
  })
  .finally(() => sql.end());
