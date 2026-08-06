import "server-only";

import {
  createHash,
  randomBytes,
  scrypt as scryptRappel,
  type ScryptOptions,
  timingSafeEqual,
} from "node:crypto";

import { and, eq, gt, isNull } from "drizzle-orm";
import { cookies } from "next/headers";
import { cache } from "react";

import { db } from "@/server/db";
import { identifiant, session, utilisateur } from "@/server/db/schema";

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

const NOM_COOKIE = "remorque_session";

/** Durée d'une session : trente jours, glissante à chaque connexion. */
const DUREE_JOURS = 30;

/**
 * Le jeton est haché avant d'être stocké.
 *
 * Le navigateur détient la valeur en clair ; la base n'en garde que
 * l'empreinte. Une fuite de la table `session` ne permet donc pas d'usurper
 * les sessions en cours — c'est le même raisonnement que pour les mots de
 * passe, appliqué à ce qui en tient lieu une fois connecté.
 *
 * SHA-256 suffit ici, et scrypt serait un contresens : un jeton de 256 bits
 * tiré au hasard n'est pas devinable, il n'y a donc rien à ralentir.
 */
function empreinteDe(jeton: string): string {
  return createHash("sha256").update(jeton).digest("hex");
}

export async function ouvrirSession(
  utilisateurId: string,
  contexte?: { adresseIp?: string; agentUtilisateur?: string },
): Promise<void> {
  const jeton = randomBytes(32).toString("base64url");
  const expireLe = new Date(Date.now() + DUREE_JOURS * 86_400_000);

  await db.insert(session).values({
    utilisateurId,
    empreinteJeton: empreinteDe(jeton),
    expireLe,
    adresseIp: contexte?.adresseIp,
    agentUtilisateur: contexte?.agentUtilisateur,
  });

  const boite = await cookies();
  boite.set(NOM_COOKIE, jeton, {
    // Inaccessible au JavaScript de la page : même une faille d'injection ne
    // permet pas de lire le jeton.
    httpOnly: true,
    // `lax` et non `strict` : `strict` empêcherait la session d'être reconnue
    // quand on arrive depuis un lien externe, ce qui déconnecterait en
    // apparence tout visiteur venant d'un courriel ou d'un moteur de recherche.
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expireLe,
  });
}

export async function fermerSession(): Promise<void> {
  const boite = await cookies();
  const jeton = boite.get(NOM_COOKIE)?.value;

  if (jeton) {
    // Révoquée plutôt que supprimée : l'usager doit pouvoir constater qu'une
    // session a été fermée, et depuis quel appareil.
    await db
      .update(session)
      .set({ revoqueeLe: new Date() })
      .where(eq(session.empreinteJeton, empreinteDe(jeton)));
  }

  boite.delete(NOM_COOKIE);
}

export type CompteConnecte = {
  id: string;
  email: string;
  prenom: string | null;
  nom: string | null;
  profilLocataire: boolean;
  profilProprietaire: boolean;
  role: string | null;
};

/**
 * Le compte connecté, ou `null`.
 *
 * Mémorisée par requête : la coquille d'espace, la navigation et l'écran
 * appellent tous cette fonction. Sans déduplication, une seule page ouvrirait
 * trois fois la même lecture de session.
 */
export const compteConnecte = cache(async (): Promise<CompteConnecte | null> => {
  const boite = await cookies();
  const jeton = boite.get(NOM_COOKIE)?.value;
  if (!jeton) return null;

  const [ligne] = await db
    .select({
      id: utilisateur.id,
      email: utilisateur.email,
      prenom: utilisateur.prenom,
      nom: utilisateur.nom,
      profilLocataire: utilisateur.profilLocataire,
      profilProprietaire: utilisateur.profilProprietaire,
      role: utilisateur.role,
    })
    .from(session)
    .innerJoin(utilisateur, eq(utilisateur.id, session.utilisateurId))
    .where(
      and(
        eq(session.empreinteJeton, empreinteDe(jeton)),
        // L'expiration et la révocation sont vérifiées en base, pas en
        // JavaScript : une session expirée ne doit jamais remonter jusqu'ici,
        // fût-ce pour être écartée ensuite par un `if` qu'on oublierait.
        gt(session.expireLe, new Date()),
        isNull(session.revoqueeLe),
        isNull(utilisateur.suspenduLe),
      ),
    )
    .limit(1);

  return ligne ?? null;
});

/* -------------------------------------------------------------------------- */
/*  Identifiants                                                              */
/* -------------------------------------------------------------------------- */

/** Retrouve le compte correspondant à une adresse et un mot de passe. */
export async function authentifier(
  email: string,
  motDePasse: string,
): Promise<string | null> {
  const [ligne] = await db
    .select({
      utilisateurId: identifiant.utilisateurId,
      empreinte: identifiant.empreinte,
    })
    .from(identifiant)
    .where(
      and(
        eq(identifiant.fournisseur, "mot_de_passe"),
        eq(identifiant.identifiantExterne, email.trim().toLowerCase()),
      ),
    )
    .limit(1);

  // Le calcul est fait même sans compte correspondant, sur une empreinte
  // factice : sans cela, la durée de la réponse dirait si l'adresse existe, ce
  // qui permet d'énumérer les comptes d'une plateforme.
  const empreinte =
    ligne?.empreinte ??
    "scrypt$32768$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==";

  const valide = await verifierMotDePasse(motDePasse, empreinte);
  return valide && ligne ? ligne.utilisateurId : null;
}
