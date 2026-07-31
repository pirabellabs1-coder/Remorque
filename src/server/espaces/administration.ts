import "server-only";

import { PAYS, VILLES } from "@/config/villes";
import { listerAnnonces } from "@/server/annonces/depot";

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
 *  — **Gel des fonds** (règle 6). `fondsGeles()` est la seule autorité sur la
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

function generateur(graine: number) {
  let etat = graine;
  return () => {
    etat |= 0;
    etat = (etat + 0x6d2b79f5) | 0;
    let resultat = Math.imul(etat ^ (etat >>> 15), 1 | etat);
    resultat =
      (resultat + Math.imul(resultat ^ (resultat >>> 7), 61 | resultat)) ^ resultat;
    return ((resultat ^ (resultat >>> 14)) >>> 0) / 4294967296;
  };
}

const PRENOMS = [
  "Camille", "Julien", "Fatima", "Marc", "Élodie", "Youssef", "Anne-Sophie",
  "Thomas", "Leïla", "Pieter", "Sofie", "Grégoire", "Nadia", "Bastien",
  "Margot", "Hicham", "Lucie", "Olivier", "Inès", "Damien", "Karim", "Manon",
];

const NOMS = [
  "Deprez", "Martin", "Bakker", "Lemaire", "Vandamme", "Rousseau", "Thys",
  "Claes", "Hendrickx", "Peeters", "Dubois", "Janssens",
];

const global_ = globalThis as unknown as {
  __flexitrailerAdmin?: {
    utilisateurs: Utilisateur[];
    litiges: Litige[];
    sinistres: Sinistre[];
    audit: EntreeAudit[];
    tickets: TicketSupport[];
  };
};

function construire() {
  const hasard = generateur(31072026);
  const aujourdhui = new Date();
  const reservations = listerReservations();

  /* ---- Utilisateurs ---- */
  const utilisateurs: Utilisateur[] = [];
  for (let index = 0; index < 220; index += 1) {
    const ville = VILLES[Math.floor(hasard() * VILLES.length)];
    const prenom = PRENOMS[Math.floor(hasard() * PRENOMS.length)];
    const nom = NOMS[Math.floor(hasard() * NOMS.length)];

    const tirage = hasard();
    const role: RoleUtilisateur =
      tirage < 0.72 ? "locataire" : tirage < 0.93 ? "loueur" : "les_deux";

    const tirageVerif = hasard();
    const verification: EtatVerification =
      tirageVerif < 0.68
        ? "verifie"
        : tirageVerif < 0.83
          ? "en_attente"
          : tirageVerif < 0.96
            ? "non_soumis"
            : "refuse";

    const inscritLe = new Date(aujourdhui);
    inscritLe.setDate(inscritLe.getDate() - Math.floor(hasard() * 700));

    const loue = role !== "locataire";

    utilisateurs.push({
      id: `u${index.toString().padStart(3, "0")}`,
      nom: `${prenom} ${nom}`,
      courriel: `${prenom.toLowerCase().replace(/[^a-z]/g, "")}.${nom.toLowerCase()}@exemple.be`,
      ville: ville.nom,
      pays: ville.pays,
      role,
      verification,
      inscritLe,
      locations: Math.floor(hasard() * 14),
      annonces: loue ? 1 + Math.floor(hasard() * 4) : 0,
      note: hasard() < 0.7 ? 4 + Math.round(hasard() * 10) / 10 : null,
      // La suspension est rare : une plateforme qui suspend cinq pour cent de
      // ses inscrits a un problème bien plus grave que sa modération.
      suspendu: hasard() < 0.015,
    });
  }
  utilisateurs.sort((a, b) => b.inscritLe.getTime() - a.inscritLe.getTime());

  /* ---- Litiges ---- */
  const MOTIFS: Litige["motif"][] = [
    "dommage", "retard", "non_conformite", "annulation", "paiement",
  ];
  const litiges: Litige[] = [];
  const closes = reservations.filter((r) =>
    ["cloturee", "restituee", "en_cours"].includes(r.statut),
  );

  for (let index = 0; index < 14; index += 1) {
    const reservation = closes[Math.floor(hasard() * closes.length)];
    if (!reservation) break;

    const ouvertLe = new Date(reservation.fin);
    ouvertLe.setDate(ouvertLe.getDate() + Math.floor(hasard() * 4));

    const tirage = hasard();
    const statut: Litige["statut"] =
      tirage < 0.35 ? "ouvert" : tirage < 0.6 ? "en_instruction" : "resolu";

    const montantEnJeu = Math.round(reservation.caution * (0.2 + hasard() * 0.8));

    litiges.push({
      id: `l${index.toString().padStart(3, "0")}`,
      reference: `LIT-${ouvertLe.getFullYear()}-${(index + 1).toString().padStart(3, "0")}`,
      reservationReference: reservation.reference,
      ouvertLe,
      motif: MOTIFS[Math.floor(hasard() * MOTIFS.length)],
      montantEnJeu,
      devise: reservation.devise,
      partie: hasard() < 0.6 ? "locataire" : "proprietaire",
      statut,
      // Un litige résolu ne gèle plus rien : c'est tout l'intérêt de le clore.
      fondsGeles: statut === "resolu" ? 0 : reservation.netProprietaire + reservation.caution,
    });
  }
  litiges.sort((a, b) => b.ouvertLe.getTime() - a.ouvertLe.getTime());

  /* ---- Sinistres ---- */
  const NATURES: Sinistre["nature"][] = ["collision", "vol", "bris", "incendie"];
  const sinistres: Sinistre[] = [];

  for (let index = 0; index < 6; index += 1) {
    const reservation = closes[Math.floor(hasard() * closes.length)];
    if (!reservation) break;

    const declareLe = new Date(reservation.fin);
    declareLe.setDate(declareLe.getDate() + Math.floor(hasard() * 3));

    const tirage = hasard();
    const statut: Sinistre["statut"] =
      tirage < 0.3 ? "declare" : tirage < 0.6 ? "transmis" : tirage < 0.9 ? "indemnise" : "refuse";

    const transmisLe = statut === "declare" ? null : new Date(declareLe);
    if (transmisLe) transmisLe.setDate(transmisLe.getDate() + 1);

    sinistres.push({
      id: `s${index.toString().padStart(3, "0")}`,
      reference: `SIN-${declareLe.getFullYear()}-${(index + 1).toString().padStart(3, "0")}`,
      reservationReference: reservation.reference,
      declareLe,
      nature: NATURES[Math.floor(hasard() * NATURES.length)],
      montantEstime: 30_000 + Math.floor(hasard() * 350_000),
      devise: reservation.devise,
      statut,
      transmisLe,
    });
  }
  sinistres.sort((a, b) => b.declareLe.getTime() - a.declareLe.getTime());

  /* ---- Support ---- */
  const SUJETS = [
    "Caution non libérée après restitution",
    "Impossible de téléverser la pièce d'identité",
    "Annonce refusée à la modération, motif incompris",
    "Demande de facture pour une location professionnelle",
    "Le locataire ne répond plus, matériel non restitué",
    "Erreur de calcul sur la commission du mois",
    "Modification d'IBAN refusée",
    "Suppression de compte et données personnelles",
  ];

  const tickets: TicketSupport[] = [];
  for (let index = 0; index < 18; index += 1) {
    const ouvertLe = new Date(aujourdhui);
    ouvertLe.setDate(ouvertLe.getDate() - Math.floor(hasard() * 21));
    const tirage = hasard();

    tickets.push({
      id: `t${index.toString().padStart(3, "0")}`,
      reference: `SUP-${(index + 1).toString().padStart(4, "0")}`,
      ouvertLe,
      demandeur: utilisateurs[Math.floor(hasard() * utilisateurs.length)].nom,
      sujet: SUJETS[Math.floor(hasard() * SUJETS.length)],
      canal: hasard() < 0.6 ? "formulaire" : hasard() < 0.9 ? "courriel" : "telephone",
      priorite: tirage < 0.15 ? "haute" : tirage < 0.7 ? "normale" : "basse",
      statut: tirage < 0.3 ? "ouvert" : tirage < 0.55 ? "en_cours" : "resolu",
    });
  }
  tickets.sort((a, b) => b.ouvertLe.getTime() - a.ouvertLe.getTime());

  /* ---- Journal d'audit ---- */
  const ACTIONS = [
    { action: "Annonce approuvée", cible: "annonce", motif: "Conforme après vérification des photographies" },
    { action: "Annonce refusée", cible: "annonce", motif: "Photographies ne correspondant pas au matériel décrit" },
    { action: "Utilisateur suspendu", cible: "utilisateur", motif: "Trois signalements concordants" },
    { action: "Identité validée", cible: "utilisateur", motif: "Pièce lisible et concordante" },
    { action: "Litige tranché en faveur du locataire", cible: "litige", motif: "État des lieux de départ défavorable au propriétaire" },
    { action: "Caution libérée manuellement", cible: "reservation", motif: "Retard technique du prestataire de paiement" },
    { action: "Commission modifiée", cible: "pays", motif: "Alignement tarifaire sur le marché néerlandais", avant: "15,00 %", apres: "14,00 %" },
    { action: "Remboursement exceptionnel", cible: "reservation", motif: "Panne du matériel constatée au départ" },
    { action: "Sinistre transmis à l'assureur", cible: "sinistre", motif: "Dossier complet" },
  ];

  const AUTEURS = ["marie.admin", "karim.support", "sophie.direction"];
  const audit: EntreeAudit[] = [];

  for (let index = 0; index < 60; index += 1) {
    const modele = ACTIONS[Math.floor(hasard() * ACTIONS.length)];
    const horodatage = new Date(aujourdhui);
    horodatage.setMinutes(horodatage.getMinutes() - Math.floor(hasard() * 60 * 24 * 45));

    audit.push({
      id: `j${index.toString().padStart(3, "0")}`,
      horodatage,
      auteur: AUTEURS[Math.floor(hasard() * AUTEURS.length)],
      action: modele.action,
      cible: `${modele.cible} #${Math.floor(hasard() * 900) + 100}`,
      motif: modele.motif,
      avant: modele.avant ?? null,
      apres: modele.apres ?? null,
    });
  }
  audit.sort((a, b) => b.horodatage.getTime() - a.horodatage.getTime());

  return { utilisateurs, litiges, sinistres, audit, tickets };
}

function donnees() {
  global_.__flexitrailerAdmin ??= construire();
  return global_.__flexitrailerAdmin;
}

/* -------------------------------------------------------------------------- */
/*  Lectures                                                                  */
/* -------------------------------------------------------------------------- */

export function listerUtilisateurs(): Utilisateur[] {
  return donnees().utilisateurs;
}

export function listerLitiges(): Litige[] {
  return donnees().litiges;
}

export function listerSinistres(): Sinistre[] {
  return donnees().sinistres;
}

export function listerAudit(): EntreeAudit[] {
  return donnees().audit;
}

export function listerTickets(): TicketSupport[] {
  return donnees().tickets;
}

/**
 * Montant total gelé par les litiges et sinistres en cours — règle 6.
 *
 * Une seule fonction fait autorité, appelée par tous les écrans qui parlent
 * d'argent. Si la règle évolue, elle évolue en un seul endroit.
 */
export function fondsGeles(): number {
  const parLitiges = listerLitiges()
    .filter((litige) => litige.statut !== "resolu")
    .reduce((somme, litige) => somme + litige.fondsGeles, 0);

  const parSinistres = listerSinistres()
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

const ENCAISSES = ["payee", "confirmee", "en_cours", "restituee", "cloturee"];

export function syntheseAdmin(): SyntheseAdmin {
  const reservations = listerReservations().filter((reservation) =>
    ENCAISSES.includes(reservation.statut),
  );
  const utilisateurs = listerUtilisateurs();
  const avis = listerAvis();

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
    annoncesActives: listerAnnonces().length,
    litigesOuverts: listerLitiges().filter((litige) => litige.statut !== "resolu")
      .length,
    sinistresOuverts: listerSinistres().filter((sinistre) =>
      ["declare", "transmis"].includes(sinistre.statut),
    ).length,
    identitesAverifier: utilisateurs.filter(
      (utilisateur) => utilisateur.verification === "en_attente",
    ).length,
    ticketsOuverts: listerTickets().filter((ticket) => ticket.statut !== "resolu")
      .length,
    fondsGeles: fondsGeles(),
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
export function comparaisonPays(): LignePays[] {
  const annonces = listerAnnonces();
  const reservations = listerReservations().filter((reservation) =>
    ENCAISSES.includes(reservation.statut),
  );
  const utilisateurs = listerUtilisateurs();

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
export function inscriptionsParMois(nombreMois = 12) {
  const utilisateurs = listerUtilisateurs();
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
