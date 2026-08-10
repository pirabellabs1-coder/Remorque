import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";

import { deciderMarche, estRobot } from "@/config/marche-visiteur";
import { ENABLED_MARKETS, MARKETS, type Market } from "@/config/markets";
import { routing } from "@/i18n/routing";

/**
 * Convention Next.js 16 : l'ancien `middleware.ts` s'appelle désormais
 * `proxy.ts`. Le comportement est identique.
 *
 * Deux rôles, dans cet ordre :
 *
 *  1. **Envoyer le visiteur sur le marché de son pays.** Le catalogue est
 *     cloisonné par pays (règle 7) : quelqu'un à Bruxelles qui arrive à la
 *     racine voit le catalogue français, c'est-à-dire des remorques hors de
 *     portée, et en conclut que la plateforme est vide. La décision elle-même
 *     vit dans `config/marche-visiteur.ts`, où elle est vérifiée sans serveur.
 *  2. **Résoudre le marché à partir du préfixe** et réécrire vers le segment
 *     `[locale]` — c'est le travail de `next-intl`.
 *
 * Le proxy s'exécute sur le moteur périphérique, sans accès à la base : il ne
 * fait donc que de l'aiguillage. Les gardes d'accès restent dans les `layout`,
 * seuls capables de vérifier qu'une session existe réellement.
 */

const intl = createMiddleware(routing);

/**
 * Marché retenu de la visite précédente.
 *
 * Un an, et lisible par le JavaScript de la page : il ne protège rien, il se
 * souvient d'une préférence. C'est lui qui évite de contredire, au
 * rechargement suivant, quelqu'un qui a explicitement demandé un autre marché
 * que celui de son adresse IP.
 */
const COOKIE_MARCHE = "remorque_marche";
const DUREE_COOKIE = 60 * 60 * 24 * 365;

/** Le marché désigné par le préfixe de l'adresse, s'il y en a un. */
function marcheDuChemin(chemin: string): Market | undefined {
  return ENABLED_MARKETS.find((marche) => {
    const prefixe = MARKETS[marche].pathPrefix;
    return prefixe && (chemin === prefixe || chemin.startsWith(`${prefixe}/`));
  });
}

export default function proxy(requete: NextRequest) {
  const decision = deciderMarche({
    marcheDeLAdresse: marcheDuChemin(requete.nextUrl.pathname),
    marcheMemorise: requete.cookies.get(COOKIE_MARCHE)?.value,
    // En-tête posé par l'hébergeur. Absent en développement : aucune
    // redirection ne se déclenche alors, ce qui est le comportement voulu.
    paysDetecte: requete.headers.get("x-vercel-ip-country") ?? undefined,
    estRobot: estRobot(requete.headers.get("user-agent")),
  });

  if (decision.action === "rediriger") {
    const destination = new URL(requete.nextUrl);
    destination.pathname = `${decision.prefixe}${requete.nextUrl.pathname}`;

    // 307 et non 308 : le marché d'un visiteur peut changer — il voyage, il
    // change d'avis — et une redirection permanente resterait dans son cache
    // et dans celui des intermédiaires bien après.
    const reponse = NextResponse.redirect(destination, 307);
    reponse.cookies.set(COOKIE_MARCHE, decision.marche, {
      path: "/",
      maxAge: DUREE_COOKIE,
      sameSite: "lax",
    });
    return reponse;
  }

  const reponse = intl(requete);
  reponse.cookies.set(COOKIE_MARCHE, decision.marche, {
    path: "/",
    maxAge: DUREE_COOKIE,
    sameSite: "lax",
  });
  return reponse;
}

export const config = {
  matcher: [
    // Toutes les adresses sauf les fichiers statiques, les routes d'API
    // et les ressources internes de Next.js.
    "/((?!api|_next|_vercel|.*\\..*).*)",
  ],
};
