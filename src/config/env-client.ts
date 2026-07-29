import { z } from "zod";

import { analyser } from "./env-commun";

/**
 * Variables exposées au navigateur.
 *
 * Ce module est volontairement séparé de `env-serveur` : un composant qui n'a
 * besoin que de l'adresse du site ne doit pas déclencher la validation des
 * secrets serveur, sans quoi la moindre page publique refuserait de se
 * construire sur un poste où la base n'est pas encore configurée.
 */
const schemaClient = z.object({
  // Valeur de repli pour que `npm run dev` et `npm run build` fonctionnent sur
  // un poste vierge. À définir explicitement en préproduction et en production :
  // c'est elle qui construit les adresses canoniques.
  NEXT_PUBLIC_SITE_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_MAP_STYLE_URL: z.string().url().optional(),
});

export const clientEnv = analyser(
  schemaClient,
  {
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_MAP_STYLE_URL: process.env.NEXT_PUBLIC_MAP_STYLE_URL,
  },
  "client",
);
