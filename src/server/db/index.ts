import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { serverEnv } from "@/config/env-serveur";

import * as schema from "./schema";

/**
 * Connexion à PostgreSQL.
 *
 * **Ouverte au premier usage, jamais à l'importation.** La différence n'est pas
 * théorique : `catalogue.ts` importe ce module, et tout ce qui importe le
 * catalogue exigeait alors une adresse de base valide *pour se charger*. Cinq
 * fichiers de tests unitaires — dont ceux du domaine, qui ne touchent aucune
 * base par construction — sont tombés d'un coup sur « variables
 * d'environnement serveur invalides ».
 *
 * Un test de tarification n'a pas à disposer d'une base pour vérifier qu'une
 * remise de 10 % fait bien 10 %. La validation des secrets est donc reportée à
 * la première requête réelle, exactement comme le fait déjà `serverEnv`.
 *
 * Effet second, utile : une page publique purement éditoriale se construit
 * sans jamais ouvrir de connexion.
 *
 * En développement, Next.js recharge les modules à chaque modification : sans
 * mise en cache sur `globalThis`, chaque rechargement ouvrirait un pool de
 * plus et épuiserait les connexions.
 */
const global_ = globalThis as unknown as {
  __remorqueSql?: ReturnType<typeof postgres>;
  __remorqueDb?: ReturnType<typeof drizzle<typeof schema>>;
};

function connexion() {
  if (!global_.__remorqueSql) {
    global_.__remorqueSql = postgres(serverEnv.DATABASE_URL, {
      // Le pool est **par instance**, et une plateforme sans serveur en
      // multiplie autant que le trafic l'exige. Dix connexions par instance,
      // multipliées par cinquante instances un samedi matin, épuisent le
      // gestionnaire de connexions bien avant la base : les requêtes se
      // mettent alors à attendre un créneau, et l'application paraît lente
      // sans qu'aucune requête ne soit lente. Trois suffisent — le
      // gestionnaire travaille en mode transaction et rend la connexion à
      // chaque fin de requête.
      max: 3,
      // Le gestionnaire de connexions de Supabase travaille en mode
      // transaction : il ne conserve pas les instructions préparées d'une
      // requête à l'autre, et les activer ferait échouer une requête sur deux.
      prepare: false,
    });
  }
  return global_.__remorqueSql;
}

function instance() {
  global_.__remorqueDb ??= drizzle(connexion(), { schema });
  return global_.__remorqueDb;
}

/**
 * Mandataire : `db.select(...)` déclenche l'ouverture, `import { db }` ne la
 * déclenche pas.
 */
export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get(_cible, propriete: string | symbol) {
    const reel = instance() as unknown as Record<string | symbol, unknown>;
    const valeur = reel[propriete];
    return typeof valeur === "function" ? valeur.bind(reel) : valeur;
  },
});

/** Connexion brute, pour les requêtes que Drizzle n'exprime pas. */
export const sql = new Proxy({} as ReturnType<typeof postgres>, {
  get(_cible, propriete: string | symbol) {
    const reel = connexion() as unknown as Record<string | symbol, unknown>;
    const valeur = reel[propriete];
    return typeof valeur === "function" ? valeur.bind(reel) : valeur;
  },
  apply(_cible, _ceci, arguments_: unknown[]) {
    return (connexion() as unknown as (...a: unknown[]) => unknown)(...arguments_);
  },
});

export { schema };
export type Db = typeof db;
