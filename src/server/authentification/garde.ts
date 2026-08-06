import "server-only";

import { redirect } from "@/i18n/navigation";
import type { Market } from "@/config/markets";
import { compteConnecte, type CompteConnecte } from "./session";

/**
 * Gardes d'accès aux espaces authentifiés.
 *
 * Elles vivent dans les `layout.tsx` de chaque espace et non dans le proxy.
 *
 * Le proxy semblerait plus naturel — un seul endroit, avant tout rendu — mais
 * il s'exécute sur le moteur périphérique, sans accès à la base : il ne peut
 * que constater la présence d'un cookie, pas vérifier que la session existe,
 * n'a pas expiré et n'a pas été révoquée. Un cookie forgé passerait. Le layout,
 * lui, s'exécute sur le serveur avec la base à portée, et surtout **avant**
 * tout rendu de page enfant : aucune donnée ne fuit avant la vérification.
 *
 * Le prix est une lecture de session par requête ; `compteConnecte` étant
 * mémorisée, les écrans qui la relisent ensuite ne coûtent rien.
 */

/**
 * Exige une session valide.
 *
 * L'adresse demandée est transmise en paramètre pour que la connexion y
 * ramène : renvoyer tout le monde sur l'accueil après connexion oblige à
 * refaire la navigation, et fait perdre la réservation qu'on était en train
 * de consulter.
 */
export async function exigerConnexion(
  locale: string,
  destination: string,
): Promise<CompteConnecte> {
  const compte = await compteConnecte();

  if (!compte) {
    redirect({
      href: { pathname: "/connexion", query: { suite: destination } },
      locale: locale as Market,
    });
  }

  return compte!;
}

/**
 * Exige un profil précis.
 *
 * Un locataire qui atteint `/proprietaire` n'est pas un intrus : c'est le plus
 * souvent quelqu'un qui n'a pas encore activé le second profil. On le renvoie
 * donc vers son espace plutôt que de lui opposer une erreur, et l'activation
 * du profil reste à un clic depuis ses paramètres.
 */
export async function exigerProfil(
  locale: string,
  destination: string,
  profil: "locataire" | "proprietaire",
): Promise<CompteConnecte> {
  const compte = await exigerConnexion(locale, destination);

  const autorise =
    profil === "locataire" ? compte.profilLocataire : compte.profilProprietaire;

  if (!autorise) {
    redirect({
      href: profil === "proprietaire" ? "/compte" : "/proprietaire",
      locale: locale as Market,
    });
  }

  return compte;
}

/**
 * Rôles internes autorisés à entrer dans l'administration.
 *
 * La liste est explicite plutôt que « toute personne ayant un rôle » : ajouter
 * demain un rôle `partenaire` ne doit pas ouvrir l'administration par
 * inadvertance. C'est la différence entre une autorisation par liste blanche
 * et une autorisation par absence d'interdiction.
 */
const ROLES_ADMIN = [
  "agent_support",
  "moderateur",
  "gestionnaire_financier",
  "super_administrateur",
];

export async function exigerAdministration(
  locale: string,
  destination: string,
): Promise<CompteConnecte> {
  const compte = await exigerConnexion(locale, destination);

  if (!compte.role || !ROLES_ADMIN.includes(compte.role)) {
    // Vers l'accueil, et non vers une page « accès refusé » : confirmer
    // l'existence de l'administration à qui n'y a pas droit ne sert qu'à
    // renseigner celui qui cherche.
    redirect({ href: "/", locale: locale as Market });
  }

  return compte;
}
