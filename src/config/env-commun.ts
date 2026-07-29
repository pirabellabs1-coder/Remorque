import { z } from "zod";

/**
 * Valide un jeu de variables d'environnement et échoue au démarrage plutôt que
 * de laisser une valeur manquante produire une erreur obscure en production.
 */
export function analyser<T extends z.ZodType>(
  schema: T,
  source: unknown,
  portee: string,
): z.infer<T> {
  const resultat = schema.safeParse(source);

  if (!resultat.success) {
    const details = resultat.error.issues
      .map((probleme) => `  - ${probleme.path.join(".")} : ${probleme.message}`)
      .join("\n");

    throw new Error(
      `Variables d'environnement ${portee} invalides :\n${details}\n` +
        "Voir .env.example pour la liste attendue.",
    );
  }

  return resultat.data;
}
