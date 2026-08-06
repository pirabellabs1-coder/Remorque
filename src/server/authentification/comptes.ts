import "server-only";

import { eq } from "drizzle-orm";

import { profilsDuRole, type Role } from "@/domain/compte/roles";
import { db } from "@/server/db";
import {
  consentementInscription,
  identifiant,
  pays,
  utilisateur,
} from "@/server/db/schema";

import { hacherMotDePasse } from "./mots-de-passe";

/** Version des conditions générales acceptée à l'inscription. */
export const VERSION_CGU = "2026-07";

/**
 * Crée un compte, sans toucher au contexte HTTP.
 *
 * Séparée de l'action pour être testable : `cookies()` et `headers()` de Next
 * n'existent que pendant une requête, et une fonction qui les appelle ne peut
 * être exercée ni par un test ni par un script. L'action reste chargée de lire
 * la requête et d'ouvrir la session ; celle-ci ne fait qu'écrire en base.
 *
 * Le rôle choisi n'est pas stocké tel quel : il devient deux booléens,
 * `profil_locataire` et `profil_proprietaire`. La table n'a pas de colonne
 * « rôle », et c'est voulu — un compte porte l'un, l'autre ou les deux, et l'on
 * doit pouvoir activer le second sans migration ni second compte.
 */
export async function creerCompte(entree: {
  email: string;
  motDePasse: string;
  prenom: string;
  role: Role;
  adresseIp?: string;
}): Promise<{ ok: true; id: string } | { ok: false; cle: string }> {
  // L'adresse est normalisée **ici**, et non chez l'appelant.
  //
  // Une première version s'en remettait au schéma de validation de l'action,
  // qui met bien en minuscules. Mais un compte créé avec une majuscule par
  // n'importe quel autre chemin — script d'import, second formulaire, test —
  // devenait définitivement inaccessible : la connexion cherche en minuscules
  // et ne trouvait rien. Le compte existait, personne ne pouvait s'y
  // connecter, et rien ne le signalait.
  //
  // Une règle d'unicité ne se délègue pas à ses appelants.
  const email = entree.email.trim().toLowerCase();

  const [existant] = await db
    .select({ id: utilisateur.id })
    .from(utilisateur)
    .where(eq(utilisateur.email, email))
    .limit(1);

  if (existant) return { ok: false, cle: "dejaUtilise" };

  // Le pays d'inscription vient de la table, jamais d'une constante : c'est lui
  // qui portera commission, TVA et plafond de caution (règles 2 et 7).
  const [paysDefaut] = await db
    .select({ id: pays.id, langue: pays.langue })
    .from(pays)
    .where(eq(pays.actif, true))
    .limit(1);

  const empreinte = await hacherMotDePasse(entree.motDePasse);

  // Transaction : un compte sans identifiant serait inaccessible à jamais, et
  // un identifiant sans compte, orphelin. Les trois écritures tiennent ou
  // tombent ensemble.
  const compte = await db.transaction(async (tx) => {
    const [cree] = await tx
      .insert(utilisateur)
      .values({
        email,
        prenom: entree.prenom,
        paysId: paysDefaut?.id,
        langue: paysDefaut?.langue ?? "fr",
        ...profilsDuRole(entree.role),
      })
      .returning({ id: utilisateur.id });

    await tx.insert(identifiant).values({
      utilisateurId: cree.id,
      fournisseur: "mot_de_passe",
      identifiantExterne: email,
      empreinte,
    });

    // Registre des consentements (M21) : la version acceptée est consignée.
    // Savoir que quelqu'un a coché une case n'a aucune valeur probante si l'on
    // ne sait pas ce que disait le texte ce jour-là.
    await tx.insert(consentementInscription).values({
      utilisateurId: cree.id,
      document: "conditions_generales",
      version: VERSION_CGU,
      adresseIp: entree.adresseIp,
    });

    return cree;
  });

  return { ok: true, id: compte.id };
}

