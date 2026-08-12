import type { NomIcone } from "@/components/espace/icone";
import type { pathnames } from "@/i18n/routing";

/**
 * Navigation des trois espaces authentifiés.
 *
 * Un seul fichier pour les trois : ils partagent la même coquille, et leur
 * arborescence est le contrat de la section 04 du cadrage. La voir d'un bloc
 * évite qu'une entrée de l'un dérive de son équivalent dans l'autre.
 *
 * Les entrées sont réunies en groupes. Treize entrées à plat, comme en compte
 * l'administration, ne se parcourent pas : on les relit une à une à chaque
 * fois. Regroupées par nature — l'activité, l'argent, le réglage — on va
 * directement à la bonne section.
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
  icone: NomIcone;
};

export type GroupeEspace = {
  /** Clé de traduction du titre de groupe ; absente pour le premier groupe. */
  cle?: string;
  entrees: readonly EntreeEspace[];
};

export const NAVIGATION_LOCATAIRE = [
  {
    entrees: [
      { cle: "tableauDeBord", href: "/compte", icone: "tableau" },
      { cle: "reservations", href: "/compte/reservations", icone: "reservation" },
      { cle: "messages", href: "/compte/messages", icone: "message" },
    ],
  },
  {
    cle: "groupe.suivi",
    entrees: [
      { cle: "favoris", href: "/compte/favoris", icone: "coeur" },
      { cle: "paiements", href: "/compte/paiements", icone: "carte" },
      { cle: "avis", href: "/compte/avis", icone: "etoile" },
    ],
  },
  {
    cle: "groupe.compte",
    entrees: [
      { cle: "profil", href: "/compte/profil", icone: "profil" },
      { cle: "verification", href: "/compte/verification", icone: "bouclier" },
      { cle: "assistance", href: "/compte/assistance", icone: "aide" },
      { cle: "parametres", href: "/compte/parametres", icone: "reglages" },
    ],
  },
] as const satisfies readonly GroupeEspace[];

export const NAVIGATION_LOUEUR = [
  {
    entrees: [
      { cle: "tableauDeBord", href: "/proprietaire", icone: "tableau" },
      { cle: "annonces", href: "/proprietaire/annonces", icone: "annonce" },
      { cle: "calendrier", href: "/proprietaire/calendrier", icone: "calendrier" },
    ],
  },
  {
    cle: "groupe.locations",
    entrees: [
      { cle: "reservations", href: "/proprietaire/reservations", icone: "reservation" },
      { cle: "etatsDesLieux", href: "/proprietaire/etats-des-lieux", icone: "photo" },
      { cle: "messages", href: "/proprietaire/messages", icone: "message" },
    ],
  },
  {
    cle: "groupe.argent",
    entrees: [
      { cle: "revenus", href: "/proprietaire/revenus", icone: "euro" },
      { cle: "avis", href: "/proprietaire/avis", icone: "etoile" },
    ],
  },
  {
    cle: "groupe.compte",
    entrees: [
      { cle: "profil", href: "/proprietaire/profil", icone: "profil" },
      // Même adresse que dans l'espace locataire : « un compte, deux profils »,
      // et la même carte d'identité ne se dépose pas deux fois.
      { cle: "verification", href: "/compte/verification", icone: "bouclier" },
      { cle: "assistance", href: "/proprietaire/assistance", icone: "aide" },
      { cle: "parametres", href: "/proprietaire/parametres", icone: "reglages" },
    ],
  },
] as const satisfies readonly GroupeEspace[];

export const NAVIGATION_ADMIN = [
  {
    entrees: [
      { cle: "vueDensemble", href: "/admin", icone: "tableau" },
      { cle: "statistiques", href: "/admin/statistiques", icone: "courbe" },
    ],
  },
  {
    cle: "groupe.exploitation",
    entrees: [
      { cle: "utilisateurs", href: "/admin/utilisateurs", icone: "utilisateurs" },
      { cle: "verifications", href: "/admin/verifications", icone: "bouclier" },
      { cle: "annonces", href: "/admin/annonces", icone: "annonce" },
      { cle: "reservations", href: "/admin/reservations", icone: "reservation" },
      { cle: "support", href: "/admin/support", icone: "aide" },
    ],
  },
  {
    cle: "groupe.argent",
    entrees: [
      { cle: "finance", href: "/admin/finance", icone: "euro" },
      { cle: "litiges", href: "/admin/litiges", icone: "balance" },
      { cle: "assurance", href: "/admin/assurance", icone: "bouclier" },
    ],
  },
  {
    cle: "groupe.configuration",
    entrees: [
      { cle: "pays", href: "/admin/pays", icone: "globe" },
      { cle: "contenu", href: "/admin/contenu", icone: "document" },
      { cle: "parametres", href: "/admin/parametres", icone: "reglages" },
      { cle: "journalAudit", href: "/admin/journal-audit", icone: "journal" },
    ],
  },
] as const satisfies readonly GroupeEspace[];
