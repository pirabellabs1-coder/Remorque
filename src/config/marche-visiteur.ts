import {
  DEFAULT_MARKET,
  MARKETS,
  marchePourPays,
  type Market,
} from "./markets";

/**
 * Sur quel marché envoyer un visiteur qui arrive sans préfixe.
 *
 * Le catalogue est cloisonné par pays (règle 7) : une remorque belge n'est
 * visible que sur le marché belge. Un visiteur de Bruxelles qui atterrit à la
 * racine voit donc le catalogue français, c'est-à-dire des remorques à six
 * cents kilomètres de chez lui, et conclut que la plateforme est vide.
 *
 * **Le piège est le référencement.** Rediriger selon l'adresse IP paraît
 * évident et se paie très cher : le robot de Google explore depuis les
 * États-Unis. Redirigé comme un visiteur, il ne verrait jamais qu'un seul
 * marché, et les autres sortiraient de l'index — soit 60 à 80 % du trafic
 * visé (section 4.1 du cadrage). Les robots ne sont donc jamais redirigés, et
 * toutes les adresses restent atteignables directement.
 *
 * Le choix explicite prime sur la géolocalisation : quelqu'un qui est allé sur
 * `/be` a dit ce qu'il voulait, et une adresse IP ne doit pas le contredire au
 * rechargement suivant. C'est aussi ce qui rattrape les cas que l'IP décrit
 * mal — voyageur, réseau d'entreprise, tunnel.
 *
 * Fonction pure : elle ne lit ni requête ni en-tête, on les lui donne. C'est
 * ce qui permet de la vérifier sans monter de serveur.
 */

export type ContexteVisiteur = {
  /** Marché déduit du préfixe d'adresse, s'il y en a un. */
  marcheDeLAdresse?: Market;
  /** Marché mémorisé lors d'une visite précédente. */
  marcheMemorise?: string;
  /** Code pays ISO donné par l'hébergeur, en majuscules. */
  paysDetecte?: string;
  /** Le visiteur est-il un robot d'indexation ? */
  estRobot: boolean;
};

export type DecisionMarche =
  /** Servir l'adresse telle quelle, et mémoriser ce marché. */
  | { action: "servir"; marche: Market }
  /** Renvoyer vers le marché du visiteur, préfixe compris. */
  | { action: "rediriger"; marche: Market; prefixe: string };

export function deciderMarche(contexte: ContexteVisiteur): DecisionMarche {
  const { marcheDeLAdresse, marcheMemorise, paysDetecte, estRobot } = contexte;

  // L'adresse fait foi : elle est explicite, et c'est elle que partagent les
  // liens et qu'indexent les moteurs.
  if (marcheDeLAdresse) {
    return { action: "servir", marche: marcheDeLAdresse };
  }

  // Un robot voit toujours le marché de référence à la racine, jamais une
  // redirection. Voir ci-dessus : c'est la condition du référencement local.
  if (estRobot) return { action: "servir", marche: DEFAULT_MARKET };

  // Un choix déjà exprimé ne se rediscute pas à chaque visite.
  if (marcheMemorise) {
    const memorise = marcheMemorise as Market;
    if (memorise in MARKETS) return { action: "servir", marche: memorise };
  }

  const marche = paysDetecte ? marchePourPays(paysDetecte) : undefined;

  // Pays inconnu, marché fermé, ou déjà le marché de référence : rien à faire.
  if (!marche || marche === DEFAULT_MARKET) {
    return { action: "servir", marche: DEFAULT_MARKET };
  }

  const prefixe = MARKETS[marche].pathPrefix;
  if (!prefixe) return { action: "servir", marche: DEFAULT_MARKET };

  return { action: "rediriger", marche, prefixe };
}

/**
 * Reconnaît un robot d'indexation à sa signature.
 *
 * Volontairement large : le coût d'une erreur est asymétrique. Prendre un
 * humain pour un robot lui fait voir le marché de référence, qu'il peut
 * changer d'un clic ; prendre un robot pour un humain le fait sortir de
 * l'index.
 */
const SIGNATURES_ROBOTS =
  /bot|crawler|crawling|spider|slurp|mediapartners|facebookexternalhit|embedly|preview|lighthouse|pagespeed|headless|monitoring|pingdom|uptime/i;

export function estRobot(agentUtilisateur: string | null): boolean {
  return agentUtilisateur ? SIGNATURES_ROBOTS.test(agentUtilisateur) : true;
}
