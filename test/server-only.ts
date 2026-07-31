// Remplace `server-only` sous Vitest : ce paquet lève une erreur hors du
// rendu serveur de Next.js, alors que les tests exécutent bien du code
// serveur. Le garde-fou reste actif à la compilation, seul le test le neutralise.
export {};
