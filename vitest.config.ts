import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

/**
 * Configuration Vitest.
 *
 * Jusqu'ici les tests ne couvraient que `src/domain/`, qui n'importe rien —
 * aucun alias n'était donc nécessaire. Dès que les tests touchent `src/server/`,
 * il faut résoudre `@/` comme le fait TypeScript, sans quoi tout import
 * absolu échoue à l'exécution alors que le typage passe.
 */
/**
 * Les tests d'intégration ont besoin des mêmes secrets que l'application.
 *
 * Vitest ne lit pas « .env.local » de lui-même, contrairement à Next.js. Sans
 * ce chargement, les tests du dépôt se déclaraient ignorés faute de
 * `DATABASE_URL` — et six vérifications passaient silencieusement à la trappe
 * sur une machine où la base était pourtant disponible.
 *
 * Le fichier reste facultatif : sur une machine sans base, les tests
 * d'intégration s'ignorent en le disant, et les tests unitaires tournent.
 */
for (const fichier of [".env.local", ".env"]) {
  if (existsSync(fichier)) process.loadEnvFile(fichier);
}

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // `server-only` lève une erreur dès qu'il est importé hors du rendu
      // serveur de Next.js. Les tests exécutent pourtant bien du code serveur :
      // on le remplace par un module vide. Le garde-fou reste entier à la
      // compilation, seul le banc d'essai le neutralise.
      "server-only": fileURLToPath(new URL("./test/server-only.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Les tests unitaires tiennent en quelques millisecondes ; les tests
    // d'intégration font plusieurs aller-retours jusqu'à la base, hébergée à
    // Stockholm. Cinq secondes — le défaut — suffisent aux premiers et jamais
    // aux seconds : trois tests échouaient sur le seul délai, sans qu'aucune
    // assertion soit en cause.
    testTimeout: 30_000,
  },
});
