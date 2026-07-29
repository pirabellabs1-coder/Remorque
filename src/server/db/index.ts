import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { serverEnv } from "@/config/env";

import * as schema from "./schema";

/**
 * Connexion partagée. En développement, Next.js recharge les modules à chaque
 * modification : sans mise en cache sur `globalThis`, chaque rechargement
 * ouvrirait un nouveau pool et épuiserait les connexions de PostgreSQL.
 */
const globalPool = globalThis as unknown as {
  __remorqueSql?: ReturnType<typeof postgres>;
};

const sql =
  globalPool.__remorqueSql ??
  postgres(serverEnv.DATABASE_URL, {
    max: serverEnv.NODE_ENV === "production" ? 10 : 3,
    prepare: false,
  });

if (serverEnv.NODE_ENV !== "production") {
  globalPool.__remorqueSql = sql;
}

export const db = drizzle(sql, { schema });
export { schema, sql };
export type Db = typeof db;
