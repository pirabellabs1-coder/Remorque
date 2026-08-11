import { deciderMarche, estRobot } from "@/config/marche-visiteur";

/**
 * Diagnostic temporaire de la détection de marché.
 *
 * Elle ne fonctionne pas pour un visiteur belge, et l'on ne peut pas
 * l'éprouver depuis un autre pays sans y être. Cette route rend donc ce que le
 * serveur voit réellement de la requête : l'en-tête de pays posé par
 * l'hébergeur, la signature du navigateur, et la décision qui en découle.
 *
 * Elle n'expose que ce que l'appelant a lui-même envoyé, et rien de la
 * plateforme. À retirer une fois la cause trouvée.
 */
export const dynamic = "force-dynamic";

export async function GET(requete: Request): Promise<Response> {
  const pays = requete.headers.get("x-vercel-ip-country");
  const agent = requete.headers.get("user-agent");

  const enTetesGeo = Object.fromEntries(
    [...requete.headers.entries()].filter(([nom]) =>
      nom.startsWith("x-vercel-ip"),
    ),
  );

  return Response.json({
    paysDetecte: pays,
    enTetesGeo,
    agentUtilisateur: agent?.slice(0, 120) ?? null,
    reconnuCommeRobot: estRobot(agent),
    decision: deciderMarche({
      paysDetecte: pays ?? undefined,
      estRobot: estRobot(agent),
    }),
  });
}
