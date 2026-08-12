import { z } from "zod";

/**
 * Une variable vide est une variable absente.
 *
 * Distinction qui paraît byzantine et qui coûte une demi-journée quand on la
 * découvre : `z.string().url().optional()` accepte `undefined` et rejette
 * `""`. Or `RESEND_API_KEY=` — la clé écrite sans valeur — produit une chaîne
 * vide, pas une absence. Le schéma refusait donc de démarrer sur des variables
 * qu'il déclarait facultatives.
 *
 * Ce n'est pas un cas de laboratoire : `vercel env pull` écrit exactement cette
 * forme pour toute variable marquée sensible, dont il ne peut pas rendre la
 * valeur. Un simple tirage des variables suffisait à casser toute la suite de
 * tests, avec un message qui accusait Stripe et Resend — jamais configurés — au
 * lieu de dire que le fichier avait été réécrit.
 */
function sansValeursVides(source: unknown): unknown {
  if (typeof source !== "object" || source === null) return source;

  return Object.fromEntries(
    Object.entries(source as Record<string, unknown>).filter(
      ([, valeur]) => valeur !== "",
    ),
  );
}

/**
 * Valide un jeu de variables d'environnement et échoue au démarrage plutôt que
 * de laisser une valeur manquante produire une erreur obscure en production.
 */
export function analyser<T extends z.ZodType>(
  schema: T,
  source: unknown,
  portee: string,
): z.infer<T> {
  const resultat = schema.safeParse(sansValeursVides(source));

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
