import createMiddleware from "next-intl/middleware";

import { routing } from "@/i18n/routing";

/**
 * Convention Next.js 16 : l'ancien `middleware.ts` s'appelle désormais
 * `proxy.ts`. Le comportement est identique.
 *
 * Résout le marché à partir du préfixe d'adresse et réécrit vers le segment
 * `[locale]`.
 */
export default createMiddleware(routing);

export const config = {
  matcher: [
    // Toutes les adresses sauf les fichiers statiques, les routes d'API
    // et les ressources internes de Next.js.
    "/((?!api|_next|_vercel|.*\\..*).*)",
  ],
};
