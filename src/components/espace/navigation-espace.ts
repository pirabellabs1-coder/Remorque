import type { pathnames } from "@/i18n/routing";

/**
 * Navigation des trois espaces authentifiés.
 *
 * Un seul fichier pour les trois : ils partagent la même coquille, et leur
 * arborescence est le contrat de la section 04 du cadrage. La voir d'un bloc
 * évite qu'une entrée de l'un dérive de son équivalent dans l'autre.
 *
 * Sur les appellations
 * -------------------
 * L'espace du locataire s'appelle « Mes locations » et non « Mon compte » :
 * le locataire ne vient pas gérer un compte, il vient retrouver la réservation
 * de samedi. Le libellé doit dire ce qu'on y trouve.
 *
 * Celui du propriétaire s'appelle « Espace loueur » — c'est le mot juste en
 * français pour celui qui donne en location. L'identifiant technique reste
 * `proprietaire`, comme dans le schéma de base et le document de cadrage :
 * renommer une colonne pour un libellé serait payer cher un synonyme.
 */

type AdresseStatique = Exclude<keyof typeof pathnames, `${string}[${string}`>;

export type EntreeEspace = {
  /** Clé de traduction, dans l'espace de noms `espaces`. */
  cle: string;
  href: AdresseStatique;
};

export const NAVIGATION_LOCATAIRE = [
  { cle: "tableauDeBord", href: "/compte" },
  { cle: "reservations", href: "/compte/reservations" },
  { cle: "favoris", href: "/compte/favoris" },
  { cle: "messages", href: "/compte/messages" },
  { cle: "paiements", href: "/compte/paiements" },
  { cle: "avis", href: "/compte/avis" },
  { cle: "profil", href: "/compte/profil" },
  { cle: "parametres", href: "/compte/parametres" },
] as const satisfies readonly EntreeEspace[];

export const NAVIGATION_LOUEUR = [
  { cle: "tableauDeBord", href: "/proprietaire" },
  { cle: "annonces", href: "/proprietaire/annonces" },
  { cle: "calendrier", href: "/proprietaire/calendrier" },
  { cle: "reservations", href: "/proprietaire/reservations" },
  { cle: "etatsDesLieux", href: "/proprietaire/etats-des-lieux" },
  { cle: "messages", href: "/proprietaire/messages" },
  { cle: "revenus", href: "/proprietaire/revenus" },
  { cle: "avis", href: "/proprietaire/avis" },
  { cle: "profil", href: "/proprietaire/profil" },
  { cle: "parametres", href: "/proprietaire/parametres" },
] as const satisfies readonly EntreeEspace[];

export const NAVIGATION_ADMIN = [
  { cle: "vueDensemble", href: "/admin" },
  { cle: "utilisateurs", href: "/admin/utilisateurs" },
  { cle: "annonces", href: "/admin/annonces" },
  { cle: "reservations", href: "/admin/reservations" },
  { cle: "finance", href: "/admin/finance" },
  { cle: "litiges", href: "/admin/litiges" },
  { cle: "assurance", href: "/admin/assurance" },
  { cle: "pays", href: "/admin/pays" },
  { cle: "contenu", href: "/admin/contenu" },
  { cle: "support", href: "/admin/support" },
  { cle: "statistiques", href: "/admin/statistiques" },
  { cle: "parametres", href: "/admin/parametres" },
  { cle: "journalAudit", href: "/admin/journal-audit" },
] as const satisfies readonly EntreeEspace[];
