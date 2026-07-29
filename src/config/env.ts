import { z } from "zod";

/**
 * Validation des variables d'environnement.
 * Toute variable manquante fait échouer le démarrage plutôt que de produire
 * une erreur silencieuse en production.
 */
const serverSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url().optional(),

  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.string().url(),

  STRIPE_SECRET_KEY: z.string().startsWith("sk_").optional(),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith("whsec_").optional(),

  S3_ENDPOINT: z.string().url().optional(),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
});

const clientSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.string().url(),
  NEXT_PUBLIC_MAP_STYLE_URL: z.string().url().optional(),
});

function parse<T extends z.ZodType>(schema: T, source: unknown, scope: string) {
  const result = schema.safeParse(source);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(
      `Variables d'environnement ${scope} invalides :\n${details}\n` +
        "Voir .env.example pour la liste attendue.",
    );
  }
  return result.data as z.infer<T>;
}

/** Variables serveur — ne jamais importer depuis un composant client. */
export const serverEnv = parse(serverSchema, process.env, "serveur");

/** Variables exposées au navigateur. */
export const clientEnv = parse(
  clientSchema,
  {
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_MAP_STYLE_URL: process.env.NEXT_PUBLIC_MAP_STYLE_URL,
  },
  "client",
);
