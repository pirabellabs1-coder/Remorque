import "server-only";

import { z } from "zod";

import { analyser } from "./env-commun";

/**
 * Variables serveur.
 *
 * `server-only` garantit qu'une importation depuis un composant client échoue
 * à la compilation plutôt que de laisser fuir un secret dans le paquet envoyé
 * au navigateur.
 */
const schemaServeur = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  /**
   * Connexion applicative. Sur Supabase, c'est l'adresse du gestionnaire de
   * connexions (Supavisor, port 6543) : indispensable dès qu'on déploie sur
   * une plateforme sans serveur, où chaque requête peut ouvrir sa propre
   * connexion.
   */
  DATABASE_URL: z.string().url(),
  /**
   * Connexion directe (port 5432), réservée aux migrations et aux scripts
   * d'administration. Le gestionnaire de connexions travaille en mode
   * transaction et ne sait pas exécuter les instructions de définition de
   * schéma ni les instructions préparées dont a besoin drizzle-kit.
   */
  DATABASE_URL_DIRECT: z.string().url().optional(),
  REDIS_URL: z.string().url().optional(),

  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.string().url(),

  /**
   * Secret partagé avec la planification de l'hébergeur.
   *
   * Les routes `/api/taches` et `/api/courriels` expirent des demandes,
   * libèrent des cautions et vident la file d'envoi : sans ce secret elles se
   * ferment, plutôt que de s'ouvrir à qui connaît l'adresse. Facultatif, donc,
   * mais son absence désarme la planification.
   */
  CRON_SECRET: z.string().min(16).optional(),

  STRIPE_SECRET_KEY: z.string().startsWith("sk_").optional(),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith("whsec_").optional(),

  /**
   * Expédition des courriels. Sans clé, les notifications restent en file
   * d'attente — elles ne sont jamais marquées envoyées sans l'avoir été.
   */
  RESEND_API_KEY: z.string().startsWith("re_").optional(),
  COURRIEL_EXPEDITEUR: z.string().email().optional(),

  S3_ENDPOINT: z.string().url().optional(),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
});

type EnvServeur = z.infer<typeof schemaServeur>;

let cache: EnvServeur | undefined;

/**
 * Validation différée : elle n'a lieu qu'au premier accès réel, c'est-à-dire à
 * la première requête qui touche la base ou le paiement. Une page publique
 * purement éditoriale se construit donc sans exiger de secrets.
 */
export const serverEnv = new Proxy({} as EnvServeur, {
  get(_cible, propriete: string) {
    cache ??= analyser(schemaServeur, process.env, "serveur");
    return cache[propriete as keyof EnvServeur];
  },
});
