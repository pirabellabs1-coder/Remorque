import "server-only";

import {
  randomBytes,
  scrypt as scryptRappel,
  type ScryptOptions,
  timingSafeEqual,
} from "node:crypto";

/**
 * Hachage et vérification des mots de passe.
 *
 * Séparé de la gestion de session parce que c'est du calcul pur : aucun
 * cookie, aucune requête, aucune base. La conséquence pratique est qu'on peut
 * l'exercer directement, là où tout ce qui touche à `cookies()` exige une
 * requête HTTP — c'est ce qui rend ces fonctions testables sans banc d'essai.
 */

/**
 * `promisify` perd la surcharge à options de scrypt et n'en garde que la forme
 * à trois arguments. On enveloppe donc à la main, ce qui a l'avantage de rendre
 * le type de retour explicite.
 */
function scrypt(
  motDePasse: string,
  sel: Buffer,
  longueur: number,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resoudre, rejeter) => {
    scryptRappel(motDePasse, sel, longueur, options, (erreur, derive) => {
      if (erreur) rejeter(erreur);
      else resoudre(derive);
    });
  });
}

/**
 * Authentification par mot de passe et session en base.
 *
 * Écrite ici plutôt que déléguée à une bibliothèque, pour une raison précise :
 * la table `utilisateur` existe déjà, avec ses profils, sa vérification
 * d'identité et ses rattachements à `annonce` et `reservation`. Toute
 * bibliothèque d'authentification impose son propre schéma de comptes ; il
 * aurait fallu soit dupliquer l'identité sur deux tables, soit réécrire les
 * clés étrangères de la moitié du modèle.
 *
 * Ce qui suit tient en trois primitives — hacher, comparer, ouvrir une session
 * — et n'invente aucun algorithme : scrypt pour les mots de passe, jetons
 * aléatoires de 256 bits pour les sessions.
 */

/* -------------------------------------------------------------------------- */
/*  Mots de passe                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Paramètres de scrypt.
 *
 * `N = 2^15` demande environ 32 Mio de mémoire par calcul. C'est ce qui rend
 * une attaque par force brute coûteuse même sur des cartes graphiques, là où un
 * simple SHA-256 se calcule par milliards par seconde. Le coût est assumé : une
 * connexion prend quelques dizaines de millisecondes.
 */
const SCRYPT = {
  N: 32_768,
  r: 8,
  p: 1,
  longueur: 64,
  /**
   * Plafond mémoire, à déclarer explicitement.
   *
   * scrypt consomme environ `128 × N × r` octets, soit 32 Mio ici — juste
   * au-dessus des 32 Mio que Node autorise par défaut. Sans ce plafond relevé,
   * l'appel échoue sur `ERR_CRYPTO_INVALID_SCRYPT_PARAMS`, et il échoue à la
   * première inscription réelle, pas à la compilation.
   */
  maxmem: 64 * 1024 * 1024,
} as const;

export async function hacherMotDePasse(motDePasse: string): Promise<string> {
  // Sel aléatoire par mot de passe : sans lui, deux personnes ayant choisi le
  // même mot de passe auraient la même empreinte, et une table précalculée les
  // casserait toutes les deux d'un coup.
  const sel = randomBytes(16);
  const derive = await scrypt(motDePasse.normalize("NFKC"), sel, SCRYPT.longueur, {
    N: SCRYPT.N,
    r: SCRYPT.r,
    p: SCRYPT.p,
    maxmem: SCRYPT.maxmem,
  });

  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${sel.toString("base64")}$${derive.toString("base64")}`;
}

export async function verifierMotDePasse(
  motDePasse: string,
  empreinte: string,
): Promise<boolean> {
  const [algorithme, n, r, p, sel, attendu] = empreinte.split("$");
  if (algorithme !== "scrypt") return false;

  const derive = await scrypt(
    motDePasse.normalize("NFKC"),
    Buffer.from(sel, "base64"),
    Buffer.from(attendu, "base64").length,
    { N: Number(n), r: Number(r), p: Number(p), maxmem: SCRYPT.maxmem },
  );

  const reference = Buffer.from(attendu, "base64");
  if (reference.length !== derive.length) return false;

  // Comparaison à temps constant : une comparaison ordinaire s'arrête au
  // premier octet différent, et la durée de la réponse révèle alors combien
  // d'octets étaient corrects.
  return timingSafeEqual(reference, derive);
}

/* -------------------------------------------------------------------------- */
/*  Sessions                                                                  */
/* -------------------------------------------------------------------------- */
