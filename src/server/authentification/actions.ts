"use server";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { z } from "zod";

import { espaceDaccueil, profilsDuRole, ROLES } from "@/domain/compte/roles";
import { db } from "@/server/db";
import { utilisateur } from "@/server/db/schema";

import { creerCompte } from "./comptes";
import {
  consignerTentative,
  reinitialiserTentatives,
  tentativeAutorisee,
} from "./limitation";
import { authentifier, fermerSession, ouvrirSession } from "./session";

/**
 * Actions d'inscription, de connexion et de déconnexion.
 *
 * Elles renvoient un résultat plutôt que de lever : un mot de passe refusé est
 * un cas ordinaire du parcours, pas une panne. Le message est identifié par une
 * clé, jamais rédigé ici — l'interface est traduite (règle 3), y compris ses
 * erreurs.
 */

export type Resultat =
  | { ok: true; redirection: string }
  | { ok: false; cle: string; secondes?: number };

const LONGUEUR_MINIMALE = 12;

const schemaInscription = z.object({
  email: z.string().email().transform((valeur) => valeur.trim().toLowerCase()),
  motDePasse: z.string().min(LONGUEUR_MINIMALE),
  prenom: z.string().trim().min(1).max(80),
  role: z.enum(ROLES),
  conditions: z.literal("on"),
});

export async function inscrire(donnees: FormData): Promise<Resultat> {
  const analyse = schemaInscription.safeParse({
    email: donnees.get("email"),
    motDePasse: donnees.get("motDePasse"),
    prenom: donnees.get("prenom"),
    role: donnees.get("role"),
    conditions: donnees.get("conditions"),
  });

  if (!analyse.success) return { ok: false, cle: "invalide" };

  const enTetes = await headers();
  const adresseIp =
    enTetes.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined;

  const resultat = await creerCompte({ ...analyse.data, adresseIp });
  if (!resultat.ok) return resultat;

  await ouvrirSession(resultat.id, {
    adresseIp,
    agentUtilisateur: enTetes.get("user-agent") ?? undefined,
  });

  // On atterrit dans l'espace correspondant au rôle choisi. C'est tout l'objet
  // de la question posée à l'inscription : un loueur qui arrive sur « mes
  // locations » vides croit que la plateforme n'a pas compris.
  return { ok: true, redirection: espaceDaccueil(profilsDuRole(analyse.data.role)) };
}

const schemaConnexion = z.object({
  email: z.string().email().transform((valeur) => valeur.trim().toLowerCase()),
  motDePasse: z.string().min(1),
});

export async function connecter(donnees: FormData): Promise<Resultat> {
  const analyse = schemaConnexion.safeParse({
    email: donnees.get("email"),
    motDePasse: donnees.get("motDePasse"),
  });

  if (!analyse.success) return { ok: false, cle: "invalide" };

  const enTetes = await headers();
  const adresseIp =
    enTetes.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined;

  // Le contrôle passe **avant** la vérification du mot de passe : le calcul
  // scrypt est précisément ce qu'il ne faut pas offrir à un attaquant, puisqu'il
  // coûte autant au serveur qu'à lui.
  const verdict = await tentativeAutorisee(analyse.data.email, adresseIp);
  if (!verdict.autorise) {
    return {
      ok: false,
      cle: "tropDeTentatives",
      secondes: verdict.secondesAvant,
    };
  }

  const compte = await authentifier(analyse.data.email, analyse.data.motDePasse);

  // Un seul message pour « adresse inconnue » et « mot de passe faux ». Les
  // distinguer permettrait d'énumérer les comptes de la plateforme, ce qui est
  // exactement ce que cherche une attaque par bourrage d'identifiants.
  if (!compte) {
    await consignerTentative(analyse.data.email, adresseIp, false);
    return { ok: false, cle: "identifiantsRefuses" };
  }

  await consignerTentative(analyse.data.email, adresseIp, true);
  // Quelqu'un qui se trompe sept fois puis réussit resterait sinon à un essai
  // du blocage pendant un quart d'heure — pour un compte dont il vient
  // pourtant de prouver qu'il est le titulaire.
  await reinitialiserTentatives(analyse.data.email);

  await ouvrirSession(compte, {
    adresseIp,
    agentUtilisateur: enTetes.get("user-agent") ?? undefined,
  });

  const [profil] = await db
    .select({ proprietaire: utilisateur.profilProprietaire, locataire: utilisateur.profilLocataire })
    .from(utilisateur)
    .where(eq(utilisateur.id, compte))
    .limit(1);

  return {
    ok: true,
    redirection: espaceDaccueil({
      profilLocataire: profil?.locataire ?? true,
      profilProprietaire: profil?.proprietaire ?? false,
    }),
  };
}

export async function deconnecter(): Promise<void> {
  await fermerSession();
}
