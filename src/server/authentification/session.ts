import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { and, eq, gt, isNull } from "drizzle-orm";
import { cookies } from "next/headers";
import { cache } from "react";

import { db } from "@/server/db";
import { identifiant, session, utilisateur } from "@/server/db/schema";

import { verifierMotDePasse } from "./mots-de-passe";

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
