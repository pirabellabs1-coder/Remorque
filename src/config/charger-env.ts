import { existsSync } from "node:fs";

/**
 * Charge les variables d'environnement pour les scripts exécutés hors de
 * Next.js — migrations, amorçage, préparation de la base.
 *
 * Next.js lit `.env.local` de lui-même ; `tsx` et `drizzle-kit` non. On
 * s'appuie sur `process.loadEnvFile`, natif depuis Node 20, plutôt que
 * d'ajouter une dépendance.
 */
export function chargerEnv(): void {
  for (const fichier of [".env.local", ".env"]) {
    if (existsSync(fichier)) {
      process.loadEnvFile(fichier);
    }
  }
}
