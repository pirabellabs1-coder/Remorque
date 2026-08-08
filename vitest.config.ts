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
      // ⚠ L'ordre compte : Vite applique le premier alias qui correspond.
      // Placé après « @ », celui-ci ne serait jamais atteint, puisque
      // « @/server/authentification/session » commence par « @ ».
      // Les dépôts sont restreints au compte connecté et appellent donc
      // `cookies()`, qui lève hors d'une requête HTTP. On substitue le module
      // de session, et lui seul : le code de production reste strict — hors
      // session, aucune donnée — tandis que les tests s'exécutent au nom d'un
      // compte réel, celui de la démonstration, qui porte les deux profils.
      //
      // L'alternative aurait été de faire tolérer l'absence de requête à
      // `compteConnecte`. Les tests seraient devenus verts et vides : chaque
      // dépôt aurait rendu une liste sans rien, et les vérifications de
      // cohérence n'auraient plus rien comparé.
      "@/server/authentification/session": fileURLToPath(
        new URL("./test/session.ts", import.meta.url),
      ),
      // Même raison, autre module : le catalogue est borné au pays du marché
      // servi, et le marché se lit dans la requête en cours. Hors requête, il
      // n'y en a pas — on substitue celui de la démonstration.
      "@/server/annonces/marche": fileURLToPath(
        new URL("./test/marche.ts", import.meta.url),
      ),
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
    /**
     * Les crochets ont le même besoin que les tests, et gardaient le défaut de
     * dix secondes. Un `beforeAll` qui pose l'état d'une réservation enchaîne
     * cinq écritures jusqu'à Stockholm : il tombait sur le seul délai, en
     * signalant un échec de suite entière là où rien n'était en cause.
     */
    hookTimeout: 30_000,
    /**
     * Un seul fichier à la fois.
     *
     * Les tests d'intégration partagent **une** base, et plusieurs d'entre eux
     * affirment des totaux exacts — cent quarante réservations, deux cent vingt
     * locataires. En parallèle, un fichier qui crée une réservation d'essai
     * fait échouer celui qui compte, et le nettoyage du premier arrive après la
     * lecture du second. Trois tests tombaient ainsi sans qu'aucun code soit en
     * cause.
     *
     * Le parallélisme reste possible à l'intérieur d'un fichier : c'est entre
     * fichiers que l'isolement manque.
     */
    fileParallelism: false,
  },
});
