import { copyFile, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

/**
 * Copie le fil d'exécution de MapLibre parmi les fichiers servis tels quels.
 *
 * Pourquoi ne pas laisser le bundler s'en charger ? Parce qu'il n'y arrive
 * pas. MapLibre 6 se découpe en trois modules — le principal, un module
 * partagé, et le fil d'exécution — et les deux derniers s'appellent par un
 * chemin **relatif** (`./maplibre-gl-shared.mjs`). Le fil d'exécution est
 * instancié depuis une adresse, hors du graphe de modules : sa résolution
 * échouait en production, le navigateur recevait la page d'erreur HTML à la
 * place du script, et la carte affichait un aplat sans jamais dessiner une
 * route. Le seul indice était, dans la console, « un module attendu en
 * JavaScript est arrivé en HTML ».
 *
 * Les deux fichiers sont donc copiés côte à côte dans `public/`, où le chemin
 * relatif qui les lie reste vrai et où ils sont servis avec le bon type. Le
 * composant de carte pointe le fil d'exécution avec `setWorkerUrl`.
 *
 * La copie est refaite à chaque compilation plutôt qu'archivée dans le dépôt :
 * une version figée finirait par diverger de celle installée, et le décalage
 * ne se verrait qu'à l'exécution, sur un écran vide.
 */

const require = createRequire(import.meta.url);
const source = dirname(require.resolve("maplibre-gl/dist/maplibre-gl.mjs"));
const destination = join(process.cwd(), "public", "cartographie");

const FICHIERS = ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"];

await mkdir(destination, { recursive: true });

for (const fichier of FICHIERS) {
  await copyFile(join(source, fichier), join(destination, fichier));
}

console.log(
  `Fil d'exécution cartographique copié dans public/cartographie (${FICHIERS.length} fichiers).`,
);
