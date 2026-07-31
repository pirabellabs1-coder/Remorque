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
  },
});
