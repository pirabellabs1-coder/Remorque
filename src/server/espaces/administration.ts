import "server-only";

import { cache } from "react";

import { desc, eq, sql as raw } from "drizzle-orm";

import { db } from "@/server/db";
import {
  annonce,
  journalAudit,
  litige,
  pays,
  reservation,
  sinistre,
  ticketSupport,
  utilisateur,
} from "@/server/db/schema";

import type { StatutReservation } from "@/domain/reservation/machine";
import { STATUTS_ENCAISSES } from "@/server/donnees-demo";

import { PAYS, VILLES } from "@/config/villes";
import { JEU_DE_DEMONSTRATION } from "@/server/annonces/catalogue";

import { listerAvis, listerReservations } from "./activite";

/**
 * Dépôt de l'administration : utilisateurs, litiges, sinistres, files
 * d'attente, paramètres par pays et journal d'audit.
 *
 * Mêmes règles que les autres dépôts — porte d'entrée unique, jeu d'essai
 * déterministe, implémentation PostgreSQL à venir sans reprise des écrans.
 *
 * Deux règles non négociables du cadrage sont matérialisées ici plutôt que
 * dans les pages, pour qu'aucun écran ne puisse les contourner par oubli :
 *
 *  — **Aucun taux codé en dur** (règle 2). Commission, TVA, plafond de caution
 *    et délai de libération viennent tous de `PARAMETRES_PAYS`, la future table
 *    `pays`, modifiable depuis l'administration sans redéploiement.
 *  — **Gel des fonds** (règle 6). `(await fondsGeles())` est la seule autorité sur la
 *    question ; un litige ou un sinistre ouvert interdit le transfert au
 *    propriétaire comme la libération de la caution.
 */

/* -------------------------------------------------------------------------- */
/*  Paramètres par pays                                                       */
/* -------------------------------------------------------------------------- */

export type ParametresPays = {
  code: string;
  nom: string;
  devise: string;
  /** Points de base : 1 % = 100. Aucun pourcentage flottant. */
  commissionPdb: number;
  tvaPdb: number;
  /** Plafond de caution, en centimes. */
  plafondCaution: number;
  /** Délai avant versement au propriétaire, en jours. */
  delaiLiberation: number;
  actif: boolean;
};

const PARAMETRES_PAYS: ParametresPays[] = [
  {
    code: "BE",
    nom: "Belgique",
    devise: "EUR",
    commissionPdb: 1500,
    tvaPdb: 2100,
    plafondCaution: 150_000,
    delaiLiberation: 7,
    actif: true,
  },
  {
    code: "FR",
    nom: "France",
    devise: "EUR",
    commissionPdb: 1500,
    tvaPdb: 2000,
    plafondCaution: 150_000,
    delaiLiberation: 7,
    actif: true,
  },
  {
    code: "NL",
    nom: "Pays-Bas",
    devise: "EUR",
    commissionPdb: 1400,
    tvaPdb: 2100,
    plafondCaution: 200_000,
    delaiLiberation: 5,
    actif: true,
  },
  {
    code: "DE",
    nom: "Allemagne",
    devise: "EUR",
    commissionPdb: 1500,
    tvaPdb: 1900,
    plafondCaution: 200_000,
    delaiLiberation: 7,
    actif: false,
  },
  {
    code: "LU",
    nom: "Luxembourg",
    devise: "EUR",
    commissionPdb: 1500,
    tvaPdb: 1700,
    plafondCaution: 150_000,
    delaiLiberation: 7,
    actif: false,
  },
];

export function listerPays(): ParametresPays[] {
  return PARAMETRES_PAYS;
}

/* -------------------------------------------------------------------------- */
/*  Utilisateurs                                                              */
/* -------------------------------------------------------------------------- */

export type RoleUtilisateur = "locataire" | "loueur" | "les_deux";
export type EtatVerification = "verifie" | "en_attente" | "non_soumis" | "refuse";

export type Utilisateur = {
  id: string;
  nom: string;
  courriel: string;
  ville: string;
  pays: string;
  role: RoleUtilisateur;
  verification: EtatVerification;
  inscritLe: Date;
  locations: number;
  annonces: number;
  note: number | null;
  suspendu: boolean;
};

export type Litige = {
  id: string;
  reference: string;
  reservationReference: string;
  ouvertLe: Date;
  motif: "dommage" | "retard" | "non_conformite" | "annulation" | "paiement";
  montantEnJeu: number;
  devise: string;
  partie: "locataire" | "proprietaire";
  statut: "ouvert" | "en_instruction" | "resolu";
  /** Ce qui reste gelé tant que le litige est ouvert. */
  fondsGeles: number;
};

export type Sinistre = {
  id: string;
  reference: string;
  reservationReference: string;
  declareLe: Date;
  nature: "collision" | "vol" | "bris" | "incendie";
  montantEstime: number;
  devise: string;
  statut: "declare" | "transmis" | "indemnise" | "refuse";
  transmisLe: Date | null;
};

export type EntreeAudit = {
  id: string;
  horodatage: Date;
  auteur: string;
  action: string;
  cible: string;
  motif: string;
  avant: string | null;
  apres: string | null;
};

export type TicketSupport = {
  id: string;
  reference: string;
  ouvertLe: Date;
  demandeur: string;
  sujet: string;
  canal: "courriel" | "formulaire" | "telephone";
  priorite: "basse" | "normale" | "haute";
  statut: "ouvert" | "en_cours" | "resolu";
};

/* -------------------------------------------------------------------------- */
/*  Construction déterministe                                                 */
/* -------------------------------------------------------------------------- */


/* -------------------------------------------------------------------------- */
/*  Lectures — sur PostgreSQL                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Les utilisateurs, avec leurs compteurs.
 *
 * Locations, annonces et note moyenne sont **comptés en base**, jamais stockés
 * sur la fiche : un compteur dénormalisé se désynchronise à la première
 * annulation, et l'administration se met alors à voir des chiffres que plus
 * personne ne peut expliquer.
 */
export const listerUtilisateurs = cache(async (): Promise<Utilisateur[]> => {
  const lignes = await db
    .select({
      id: utilisateur.id,
      prenom: utilisateur.prenom,
      nom: utilisateur.nom,
      courriel: utilisateur.email,
      pays: pays.code,
      profilLocataire: utilisateur.profilLocataire,
      profilProprietaire: utilisateur.profilProprietaire,
      verification: utilisateur.identiteStatut,
      inscritLe: utilisateur.creeLe,
      suspendu: raw<boolean>`${utilisateur.suspenduLe} is not null`,
      locations: raw<number>`(
        select count(*)::int from reservation r where r.locataire_id = ${utilisateur.id}
      )`,
      annonces: raw<number>`(
        select count(*)::int from annonce a where a.proprietaire_id = ${utilisateur.id}
      )`,
      note: raw<string | null>`(
        select avg(v.note) from avis v
        where v.destinataire_id = ${utilisateur.id} and v.publie_le is not null
      )`,
    })
    .from(utilisateur)
    .leftJoin(pays, eq(pays.id, utilisateur.paysId))
    .orderBy(desc(utilisateur.creeLe));

  return lignes.map((ligne) => ({
    id: ligne.id,
    // Nom complet ici, et non prénom abrégé : l'administration instruit des
    // litiges et doit désigner quelqu'un sans ambiguïté.
    nom: [ligne.prenom, ligne.nom].filter(Boolean).join(" ") || ligne.courriel,
    courriel: ligne.courriel,
    ville: "",
    pays: ligne.pays ?? "FR",
    role:
      ligne.profilLocataire && ligne.profilProprietaire
        ? "les_deux"
        : ligne.profilProprietaire
          ? "loueur"
          : "locataire",
    verification: ligne.verification as EtatVerification,
    inscritLe: ligne.inscritLe,
    locations: ligne.locations,
    annonces: ligne.annonces,
    note: ligne.note === null ? null : Number(ligne.note),
    suspendu: ligne.suspendu,
  }));
});

/**
 * Correspondance entre les statuts de la base et ceux de l'écran.
 *
 * La base distingue la résolution amiable de l'arbitrage ; l'écran n'a que
 * trois colonnes. Le rapprochement est fait ici, en un endroit, plutôt que
 * dans chaque tableau où il finirait par diverger.
 */
const STATUT_LITIGE: Record<string, Litige["statut"]> = {
  ouvert: "ouvert",
  en_resolution_amiable: "en_instruction",
  en_arbitrage: "en_instruction",
  resolu: "resolu",
  clos_sans_suite: "resolu",
};

export const listerLitiges = cache(async (): Promise<Litige[]> => {
  const lignes = await db
    .select({
      id: litige.id,
      reservationReference: reservation.numero,
      ouvertLe: litige.creeLe,
      motif: litige.motif,
      montantEnJeu: litige.montantReclame,
      devise: litige.devise,
      statut: litige.statut,
      ouvertParId: litige.ouvertParId,
      locataireId: reservation.locataireId,
    })
    .from(litige)
    .innerJoin(reservation, eq(reservation.id, litige.reservationId))
    .orderBy(desc(litige.creeLe));

  return lignes.map((ligne, index) => {
    const statut = STATUT_LITIGE[ligne.statut ?? "ouvert"] ?? "ouvert";
    const montant = ligne.montantEnJeu ?? 0;

    return {
      id: ligne.id,
      reference: `LIT-${(index + 1).toString().padStart(4, "0")}`,
      reservationReference: ligne.reservationReference,
      ouvertLe: ligne.ouvertLe,
      motif: ligne.motif as Litige["motif"],
      montantEnJeu: montant,
      devise: ligne.devise,
      partie: ligne.ouvertParId === ligne.locataireId ? "locataire" : "proprietaire",
      statut,
      // Règle 6 : un litige résolu ne gèle plus rien, un litige ouvert gèle le
      // montant réclamé. C'est ici, et nulle part ailleurs, que la règle
      // s'applique.
      fondsGeles: statut === "resolu" ? 0 : montant,
    };
  });
});

const NATURE_SINISTRE: Sinistre["nature"][] = ["collision", "vol", "bris", "incendie"];

export const listerSinistres = cache(async (): Promise<Sinistre[]> => {
  const lignes = await db
    .select({
      id: sinistre.id,
      reservationReference: reservation.numero,
      declareLe: sinistre.creeLe,
      description: sinistre.description,
      montantEstime: sinistre.montantEstime,
      devise: sinistre.devise,
      statut: sinistre.statut,
      transmisLe: sinistre.transmisLe,
    })
    .from(sinistre)
    .innerJoin(reservation, eq(reservation.id, sinistre.reservationId))
    .orderBy(desc(sinistre.creeLe));

  return lignes.map((ligne, index) => ({
    id: ligne.id,
    reference: `SIN-${(index + 1).toString().padStart(4, "0")}`,
    reservationReference: ligne.reservationReference,
    declareLe: ligne.declareLe,
    // La nature n'a pas de colonne : elle est déduite de la description, ce
    // qui vaut mieux que de l'inventer à chaque affichage.
    nature: /[Vv]ol/.test(ligne.description)
      ? "vol"
      : /[Ii]ncendie/.test(ligne.description)
        ? "incendie"
        : /déchir|Bâche|éclat|arrach/.test(ligne.description)
          ? "bris"
          : NATURE_SINISTRE[0],
    montantEstime: ligne.montantEstime ?? 0,
    devise: ligne.devise,
    statut: (ligne.statut === "en_cours" ? "transmis" : ligne.statut) as Sinistre["statut"],
    transmisLe: ligne.transmisLe,
  }));
});

export const listerAudit = cache(async (): Promise<EntreeAudit[]> => {
  const lignes = await db
    .select({
      id: journalAudit.id,
      horodatage: journalAudit.creeLe,
      auteur: journalAudit.auteurEmail,
      action: journalAudit.action,
      cible: journalAudit.entite,
      motif: journalAudit.motif,
      avant: journalAudit.avant,
      apres: journalAudit.apres,
    })
    .from(journalAudit)
    .orderBy(desc(journalAudit.creeLe))
    .limit(200);

  // L'état avant/après est un objet libre : `{ valeur: "15,00 %" }` pour le
  // jeu d'essai, `{ maintenance: "true" }` ou plusieurs clés pour les actions
  // réelles. Ne lire que `valeur` faisait afficher « — » sur toute action
  // véritable — le journal existait, mais ne montrait plus rien.
  const valeur = (donnee: Record<string, unknown> | null) => {
    if (!donnee) return null;
    if (typeof donnee.valeur === "string") return donnee.valeur;

    const paires = Object.entries(donnee)
      .filter(([, contenu]) => contenu !== null && typeof contenu !== "object")
      .map(([cle, contenu]) => `${cle} : ${String(contenu)}`);

    return paires.length > 0 ? paires.join(", ") : null;
  };

  return lignes.map((ligne) => ({
    id: ligne.id,
    horodatage: ligne.horodatage,
    auteur: ligne.auteur ?? "—",
    action: ligne.action,
    cible: ligne.cible,
    motif: ligne.motif ?? "",
    avant: valeur(ligne.avant),
    apres: valeur(ligne.apres),
  }));
});

export const listerTickets = cache(async (): Promise<TicketSupport[]> => {
  const lignes = await db
    .select({
      id: ticketSupport.id,
      reference: ticketSupport.reference,
      ouvertLe: ticketSupport.creeLe,
      prenom: utilisateur.prenom,
      nom: utilisateur.nom,
      courriel: utilisateur.email,
      sujet: ticketSupport.sujet,
      canal: ticketSupport.canal,
      priorite: ticketSupport.priorite,
      statut: ticketSupport.statut,
    })
    .from(ticketSupport)
    .leftJoin(utilisateur, eq(utilisateur.id, ticketSupport.demandeurId))
    .orderBy(desc(ticketSupport.creeLe));

  return lignes.map((ligne) => ({
    id: ligne.id,
    reference: ligne.reference,
    ouvertLe: ligne.ouvertLe,
    demandeur:
      [ligne.prenom, ligne.nom].filter(Boolean).join(" ") || (ligne.courriel ?? "—"),
    sujet: ligne.sujet,
    canal: ligne.canal as TicketSupport["canal"],
    priorite: ligne.priorite as TicketSupport["priorite"],
    statut: ligne.statut as TicketSupport["statut"],
  }));
});

/**
 * Montant total gelé par les litiges et sinistres en cours — règle 6.
 *
 * Une seule fonction fait autorité, appelée par tous les écrans qui parlent
 * d'argent. Si la règle évolue, elle évolue en un seul endroit.
 */
export async function fondsGeles(): Promise<number> {
  const parLitiges = (await listerLitiges())
    .filter((litige) => litige.statut !== "resolu")
    .reduce((somme, litige) => somme + litige.fondsGeles, 0);

  const parSinistres = (await listerSinistres())
    .filter((sinistre) => ["declare", "transmis"].includes(sinistre.statut))
    .reduce((somme, sinistre) => somme + sinistre.montantEstime, 0);

  return parLitiges + parSinistres;
}

export type SyntheseAdmin = {
  volumeAffaires: number;
  commissionPercue: number;
  tauxCommissionReel: number | null;
  reservations: number;
  utilisateurs: number;
  nouveauxUtilisateurs30j: number;
  annoncesActives: number;
  litigesOuverts: number;
  sinistresOuverts: number;
  identitesAverifier: number;
  ticketsOuverts: number;
  fondsGeles: number;
  noteMoyenne: number | null;
  devise: string;
};


export async function syntheseAdmin(): Promise<SyntheseAdmin> {
  const reservations = (await listerReservations()).filter((reservation) =>
    STATUTS_ENCAISSES.includes(reservation.statut),
  );
  const utilisateurs = (await listerUtilisateurs());
  const avis = (await listerAvis());

  const volumeAffaires = reservations.reduce(
    (somme, reservation) => somme + reservation.montantTotal,
    0,
  );
  const commissionPercue = reservations.reduce(
    (somme, reservation) => somme + reservation.commission,
    0,
  );

  const ilYaTrenteJours = new Date();
  ilYaTrenteJours.setDate(ilYaTrenteJours.getDate() - 30);

  return {
    volumeAffaires,
    commissionPercue,
    // Le taux réel diffère du taux affiché : remboursements et gestes
    // commerciaux le rabotent. C'est celui-là qu'il faut suivre.
    tauxCommissionReel:
      volumeAffaires > 0 ? (commissionPercue / volumeAffaires) * 100 : null,
    reservations: reservations.length,
    utilisateurs: utilisateurs.length,
    nouveauxUtilisateurs30j: utilisateurs.filter(
      (utilisateur) => utilisateur.inscritLe >= ilYaTrenteJours,
    ).length,
    annoncesActives: JEU_DE_DEMONSTRATION.length,
    litigesOuverts: (await listerLitiges()).filter((litige) => litige.statut !== "resolu")
      .length,
    sinistresOuverts: (await listerSinistres()).filter((sinistre) =>
      ["declare", "transmis"].includes(sinistre.statut),
    ).length,
    identitesAverifier: utilisateurs.filter(
      (utilisateur) => utilisateur.verification === "en_attente",
    ).length,
    ticketsOuverts: (await listerTickets()).filter((ticket) => ticket.statut !== "resolu")
      .length,
    fondsGeles: (await fondsGeles()),
    noteMoyenne:
      avis.length > 0
        ? avis.reduce((somme, entree) => somme + entree.note, 0) / avis.length
        : null,
    devise: "EUR",
  };
}

export type LignePays = {
  pays: string;
  annonces: number;
  reservations: number;
  volume: number;
  utilisateurs: number;
};

/** Comparaison entre pays — l'indicateur qui décide des ouvertures de marché. */
export async function comparaisonPays(): Promise<LignePays[]> {
  const annonces = JEU_DE_DEMONSTRATION;
  const reservations = (await listerReservations()).filter((reservation) =>
    STATUTS_ENCAISSES.includes(reservation.statut),
  );
  const utilisateurs = (await listerUtilisateurs());

  const villeVersPays = new Map(VILLES.map((ville) => [ville.nom, ville.pays]));

  return PAYS.map((pays) => {
    const desAnnonces = annonces.filter(
      (annonce) => villeVersPays.get(annonce.ville) === pays,
    );
    const idsAnnonces = new Set(desAnnonces.map((annonce) => annonce.id));
    const desReservations = reservations.filter((reservation) =>
      idsAnnonces.has(reservation.annonceId),
    );

    return {
      pays,
      annonces: desAnnonces.length,
      reservations: desReservations.length,
      volume: desReservations.reduce(
        (somme, reservation) => somme + reservation.montantTotal,
        0,
      ),
      utilisateurs: utilisateurs.filter(
        (utilisateur) => utilisateur.pays === pays,
      ).length,
    };
  }).sort((a, b) => b.volume - a.volume);
}

/** Inscriptions par mois — la courbe de croissance de la place de marché. */
export async function inscriptionsParMois(nombreMois = 12) {
  const utilisateurs = (await listerUtilisateurs());
  const mois: { etiquette: string; valeur: number }[] = [];

  const curseur = new Date();
  curseur.setDate(1);
  curseur.setHours(0, 0, 0, 0);
  curseur.setMonth(curseur.getMonth() - (nombreMois - 1));

  for (let index = 0; index < nombreMois; index += 1) {
    const annee = curseur.getFullYear();
    const numero = curseur.getMonth();

    mois.push({
      etiquette: new Intl.DateTimeFormat("fr-FR", { month: "short" }).format(curseur),
      valeur: utilisateurs.filter(
        (utilisateur) =>
          utilisateur.inscritLe.getFullYear() === annee &&
          utilisateur.inscritLe.getMonth() === numero,
      ).length,
    });

    curseur.setMonth(curseur.getMonth() + 1);
  }

  return mois;
}

/* -------------------------------------------------------------------------- */
/*  Vues d'ensemble de la plateforme                                          */
/* -------------------------------------------------------------------------- */

/**
 * Les réservations de **toute** la plateforme.
 *
 * Elle vit ici, et non dans `activite.ts`, parce que ce module-là est
 * entièrement restreint au loueur connecté — c'est sa garantie, et une
 * fonction « toutes les réservations » y ouvrirait une porte que le reste du
 * fichier s'emploie à fermer.
 *
 * Ici, la vue d'ensemble est l'objet même du module, et l'accès est protégé en
 * amont par `exigerAdministration` dans le layout de l'espace.
 */
export const listerReservationsPlateforme = cache(async () => {
  const lignes = await db
    .select({
      id: reservation.id,
      reference: reservation.numero,
      annonceId: reservation.annonceId,
      annonceTitre: annonce.titre,
      ville: annonce.ville,
      // Nom complet : l'administration instruit des litiges et doit désigner
      // quelqu'un sans ambiguïté, là où l'espace loueur s'en tient au prénom.
      locataire: raw<string>`${utilisateur.prenom} || coalesce(' ' || ${utilisateur.nom}, '')`,
      debut: reservation.debut,
      fin: reservation.fin,
      statut: reservation.statut,
      montantTotal: reservation.loyer,
      commission: reservation.commissionProprietaire,
      netProprietaire: reservation.montantReverse,
      caution: reservation.caution,
      devise: reservation.devise,
      instantanee: annonce.reservationInstantanee,
    })
    .from(reservation)
    .innerJoin(annonce, eq(annonce.id, reservation.annonceId))
    .innerJoin(utilisateur, eq(utilisateur.id, reservation.locataireId))
    .orderBy(desc(reservation.debut));

  return lignes.map((ligne) => ({
    ...ligne,
    statut: ligne.statut as StatutReservation,
    commission: ligne.commission ?? 0,
  }));
});

export type MoisPlateforme = {
  cle: string;
  etiquette: string;
  brut: number;
  commission: number;
  net: number;
  locations: number;
};

/**
 * Volume de la plateforme, mois par mois.
 *
 * Les mois sans location sont produits à zéro et non omis : une courbe qui
 * saute les mois creux ment sur la saisonnalité.
 */
export async function revenusPlateformeParMois(
  nombreMois = 12,
): Promise<MoisPlateforme[]> {
  const toutes = await listerReservationsPlateforme();
  const encaissees = toutes.filter((entree) =>
    STATUTS_ENCAISSES.includes(entree.statut),
  );

  const mois: MoisPlateforme[] = [];
  const curseur = new Date();
  curseur.setDate(1);
  curseur.setHours(0, 0, 0, 0);
  curseur.setMonth(curseur.getMonth() - (nombreMois - 1));

  for (let index = 0; index < nombreMois; index += 1) {
    const annee = curseur.getFullYear();
    const numero = curseur.getMonth();

    const duMois = encaissees.filter(
      (entree) =>
        entree.debut.getFullYear() === annee && entree.debut.getMonth() === numero,
    );

    mois.push({
      cle: `${annee}-${String(numero + 1).padStart(2, "0")}`,
      etiquette: new Intl.DateTimeFormat("fr-FR", { month: "short" }).format(curseur),
      brut: duMois.reduce((somme, entree) => somme + entree.montantTotal, 0),
      commission: duMois.reduce((somme, entree) => somme + entree.commission, 0),
      net: duMois.reduce((somme, entree) => somme + entree.netProprietaire, 0),
      locations: duMois.length,
    });

    curseur.setMonth(curseur.getMonth() + 1);
  }

  return mois;
}
