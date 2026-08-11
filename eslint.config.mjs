import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Fichiers servis tels quels, dont le fil d'exécution cartographique
    // recopié depuis `node_modules` à chaque compilation. Ce n'est pas notre
    // code : le passer au crible produit un millier d'avertissements sur du
    // JavaScript minifié que personne ne corrigera.
    "public/**",
  ]),
]);

export default eslintConfig;
