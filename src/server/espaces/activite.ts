import "server-only";

import type { StatutReservation } from "@/domain/reservation/machine";
import { listerAnnonces } from "@/server/annonces/depot";

/**
 * Dépôt d'activité des espaces : réservations, avis, messages, revenus.
 *
 * Même contrat que `annonces/depot.ts` — une seule porte d'entrée, une
 * implémentation en mémoire aujourd'hui, PostgreSQL demain. Les écrans
 * n'appellent que les fonctions publiées ici et n'auront pas à changer.
 *
 * Le jeu initial est **déterministe** : il dérive du catalogue par un
 * générateur pseudo-aléatoire à graine fixe. Deux conséquences voulues — le
 * rendu serveur et l'hydratation client concordent toujours, et une capture
 * d'écran prise aujourd'hui montrera les mêmes chiffres demain. Un
 * `Math.random()` nu donnerait des totaux qui changent à chaque rechargement,
 * rendant tout écart impossible à diagnostiquer.
 */

export type Reservation = {
  id: string;
  reference: string;
  annonceId: string;
  annonceTitre: string;
  ville: string;
  locataire: string;
  debut: Date;
  fin: Date;
  statut: StatutReservation;
  /** Tous les montants sont en centimes. */
  montantTotal: number;
  commission: number;
  netProprietaire: number;
  caution: number;
  devise: string;
  instantanee: boolean;
};

export type Avis = {
  id: string;
  annonceId: string;
  annonceTitre: string;
  auteur: string;
  note: number;
  texte: string;
  date: Date;
  reponse: string | null;
};

export type Fil = {
  id: string;
  interlocuteur: string;
  annonceTitre: string;
  dernierMessage: string;
  date: Date;
  nonLus: number;
};

/* -------------------------------------------------------------------------- */
/*  Générateur déterministe                                                   */
/* -------------------------------------------------------------------------- */

/** Mulberry32 — court, sans dépendance, suffisamment uniforme pour un jeu d'essai. */
function generateur(graine: number) {
  let etat = graine;
  return () => {
    etat |= 0;
    etat = (etat + 0x6d2b79f5) | 0;
    let resultat = Math.imul(etat ^ (etat >>> 15), 1 | etat);
    resultat = (resultat + Math.imul(resultat ^ (resultat >>> 7), 61 | resultat)) ^ resultat;
    return ((resultat ^ (resultat >>> 14)) >>> 0) / 4294967296;
  };
}

const PRENOMS = [
  "Camille", "Julien", "Fatima", "Marc", "Élodie", "Youssef", "Anne-Sophie",
  "Thomas", "Leïla", "Pieter", "Sofie", "Grégoire", "Nadia", "Bastien",
  "Margot", "Hicham", "Lucie", "Olivier", "Inès", "Damien",
];

const NOMS = [
  "D.", "M.", "B.", "L.", "V.", "R.", "T.", "C.", "H.", "P.",
];

/**
 * Répartition des statuts.
 *
 * Volontairement réaliste : une place de marché saine a une écrasante majorité
 * de locations closes, une poignée en cours, et quelques refus. Un jeu d'essai
 * où tout est « clôturé » ne permet de dessiner aucun des écrans qui comptent.
 */
const REPARTITION: { statut: StatutReservation; poids: number }[] = [
  { statut: "cloturee", poids: 46 },
  { statut: "confirmee", poids: 14 },
  { statut: "en_cours", poids: 5 },
  { statut: "payee", poids: 8 },
  { statut: "demandee", poids: 9 },
  { statut: "acceptee", poids: 5 },
  { statut: "restituee", poids: 4 },
  { statut: "annulee", poids: 5 },
  { statut: "refusee", poids: 3 },
  { statut: "expiree", poids: 1 },
];

function tirerStatut(hasard: number): StatutReservation {
  const total = REPARTITION.reduce((somme, entree) => somme + entree.poids, 0);
  let seuil = hasard * total;
  for (const entree of REPARTITION) {
    seuil -= entree.poids;
    if (seuil <= 0) return entree.statut;
  }
  return "cloturee";
}

/** Commission de la plateforme, en points de base — 15 %. */
const COMMISSION_PDB = 1500;

const global_ = globalThis as unknown as {
  __flexitrailerActivite?: { reservations: Reservation[]; avis: Avis[] };
};

function construire(): { reservations: Reservation[]; avis: Avis[] } {
  const annonces = listerAnnonces();
  const hasard = generateur(20260731);

  const reservations: Reservation[] = [];
  const avis: Avis[] = [];

  const aujourdhui = new Date();
  aujourdhui.setHours(12, 0, 0, 0);

  // 140 réservations réparties sur les quatorze derniers mois : de quoi
  // dessiner une courbe annuelle et une saisonnalité crédible.
  for (let index = 0; index < 140; index += 1) {
    const annonce = annonces[Math.floor(hasard() * annonces.length)];
    if (!annonce) break;

    const joursEnArriere = Math.floor(hasard() * 420);
    const debut = new Date(aujourdhui);
    debut.setDate(debut.getDate() - joursEnArriere + 30);

    const duree = 1 + Math.floor(hasard() * 4);
    const fin = new Date(debut);
    fin.setDate(fin.getDate() + duree);

    // Le statut doit être cohérent avec la date : une location dont la fin est
    // passée ne peut pas être « confirmée », et une location future ne peut
    // pas être « clôturée ». Sans cette règle, les écrans afficheraient des
    // absurdités que l'on prendrait pour des bogues.
    let statut = tirerStatut(hasard());
    const passee = fin < aujourdhui;
    const future = debut > aujourdhui;

    if (passee && ["confirmee", "payee", "acceptee", "demandee", "en_cours"].includes(statut)) {
      statut = hasard() < 0.9 ? "cloturee" : "annulee";
    }
    if (future && ["cloturee", "restituee", "en_cours"].includes(statut)) {
      statut = hasard() < 0.7 ? "confirmee" : "demandee";
    }
    if (!passee && !future) statut = "en_cours";

    const montantTotal = annonce.prixJour * duree;
    const commission = Math.round((montantTotal * COMMISSION_PDB) / 10000);

    const prenom = PRENOMS[Math.floor(hasard() * PRENOMS.length)];
    const nom = NOMS[Math.floor(hasard() * NOMS.length)];

    reservations.push({
      id: `r${index.toString().padStart(3, "0")}`,
      reference: `FT-${debut.getFullYear()}-${(index + 1).toString().padStart(4, "0")}`,
      annonceId: annonce.id,
      annonceTitre: annonce.titre,
      ville: annonce.ville,
      locataire: `${prenom} ${nom}`,
      debut,
      fin,
      statut,
      montantTotal,
      commission,
      netProprietaire: montantTotal - commission,
      caution: annonce.caution,
      devise: annonce.devise,
      instantanee: annonce.reservationInstantanee,
    });
  }

  reservations.sort((a, b) => b.debut.getTime() - a.debut.getTime());

  // Un avis pour environ une location close sur deux — un taux de dépôt
  // d'avis de 100 % n'existe nulle part.
  const COMMENTAIRES = [
    "Remorque conforme à l'annonce, attelage rapide. Rien à redire.",
    "Propriétaire très arrangeant sur l'horaire de retour. Je recommande.",
    "Matériel propre et bien entretenu. Feux vérifiés devant moi au départ.",
    "Tout s'est bien passé, sangles fournies en plus. Parfait pour un déménagement.",
    "Bon rapport qualité-prix. La bâche était un peu usée mais rien de gênant.",
    "Échange simple et efficace, état des lieux fait en deux minutes.",
    "Remorque récente, freinage impeccable sur autoroute.",
  ];

  for (const reservation of reservations) {
    if (reservation.statut !== "cloturee") continue;
    if (hasard() > 0.55) continue;

    const note = hasard() < 0.72 ? 5 : hasard() < 0.85 ? 4 : hasard() < 0.95 ? 3 : 2;
    const date = new Date(reservation.fin);
    date.setDate(date.getDate() + 1 + Math.floor(hasard() * 5));

    avis.push({
      id: `av${avis.length.toString().padStart(3, "0")}`,
      annonceId: reservation.annonceId,
      annonceTitre: reservation.annonceTitre,
      auteur: reservation.locataire,
      note,
      texte: COMMENTAIRES[Math.floor(hasard() * COMMENTAIRES.length)],
      date,
      reponse: hasard() < 0.3 ? "Merci beaucoup, au plaisir de vous revoir !" : null,
    });
  }

  avis.sort((a, b) => b.date.getTime() - a.date.getTime());

  return { reservations, avis };
}

function activite() {
  global_.__flexitrailerActivite ??= construire();
  return global_.__flexitrailerActivite;
}

/* -------------------------------------------------------------------------- */
/*  Lectures                                                                  */
/* -------------------------------------------------------------------------- */

export function listerReservations(): Reservation[] {
  return activite().reservations;
}

export function listerAvis(): Avis[] {
  return activite().avis;
}

/** Réservations qui demandent une action du loueur, les plus urgentes d'abord. */
export function reservationsAtraiter(): Reservation[] {
  return listerReservations()
    .filter((reservation) => reservation.statut === "demandee")
    .sort((a, b) => a.debut.getTime() - b.debut.getTime());
}

export function reservationsAvenir(): Reservation[] {
  const maintenant = new Date();
  return listerReservations()
    .filter(
      (reservation) =>
        reservation.debut >= maintenant &&
        ["confirmee", "payee", "acceptee"].includes(reservation.statut),
    )
    .sort((a, b) => a.debut.getTime() - b.debut.getTime());
}

export function reservationsEnCours(): Reservation[] {
  return listerReservations().filter(
    (reservation) => reservation.statut === "en_cours",
  );
}

/** Réservations retenues pour le chiffre d'affaires : encaissées, non annulées. */
const STATUTS_ENCAISSES: StatutReservation[] = [
  "payee",
  "confirmee",
  "en_cours",
  "restituee",
  "cloturee",
];

export type MoisRevenu = {
  cle: string;
  etiquette: string;
  brut: number;
  commission: number;
  net: number;
  locations: number;
};

/**
 * Revenus des `nombreMois` derniers mois, du plus ancien au plus récent.
 *
 * Les mois sans location sont produits à zéro et non omis : une courbe qui
 * saute les mois creux ment sur la saisonnalité, laquelle est précisément ce
 * que le loueur vient regarder.
 */
export function revenusParMois(nombreMois = 12): MoisRevenu[] {
  const reservations = listerReservations().filter((reservation) =>
    STATUTS_ENCAISSES.includes(reservation.statut),
  );

  const mois: MoisRevenu[] = [];
  const curseur = new Date();
  curseur.setDate(1);
  curseur.setHours(0, 0, 0, 0);
  curseur.setMonth(curseur.getMonth() - (nombreMois - 1));

  for (let index = 0; index < nombreMois; index += 1) {
    const annee = curseur.getFullYear();
    const numero = curseur.getMonth();
    const cle = `${annee}-${String(numero + 1).padStart(2, "0")}`;

    const duMois = reservations.filter(
      (reservation) =>
        reservation.debut.getFullYear() === annee &&
        reservation.debut.getMonth() === numero,
    );

    mois.push({
      cle,
      etiquette: new Intl.DateTimeFormat("fr-FR", { month: "short" }).format(curseur),
      brut: duMois.reduce((somme, reservation) => somme + reservation.montantTotal, 0),
      commission: duMois.reduce((somme, reservation) => somme + reservation.commission, 0),
      net: duMois.reduce((somme, reservation) => somme + reservation.netProprietaire, 0),
      locations: duMois.length,
    });

    curseur.setMonth(curseur.getMonth() + 1);
  }

  return mois;
}

/** Répartition du chiffre d'affaires par annonce, décroissante. */
export function revenusParAnnonce(): { titre: string; net: number }[] {
  const parAnnonce = new Map<string, { titre: string; net: number }>();

  for (const reservation of listerReservations()) {
    if (!STATUTS_ENCAISSES.includes(reservation.statut)) continue;
    const entree = parAnnonce.get(reservation.annonceId) ?? {
      titre: reservation.annonceTitre,
      net: 0,
    };
    entree.net += reservation.netProprietaire;
    parAnnonce.set(reservation.annonceId, entree);
  }

  return [...parAnnonce.values()].sort((a, b) => b.net - a.net);
}

export type SyntheseLoueur = {
  netTotal: number;
  netMoisCourant: number;
  netMoisPrecedent: number;
  locationsCloturees: number;
  aTraiter: number;
  aVenir: number;
  enCours: number;
  noteMoyenne: number | null;
  nombreAvis: number;
  tauxAcceptation: number | null;
  devise: string;
};

/** Chiffres de tête du tableau de bord. Aucun n'est inventé au rendu. */
export function syntheseLoueur(): SyntheseLoueur {
  const reservations = listerReservations();
  const mois = revenusParMois(2);
  const avis = listerAvis();

  const encaissees = reservations.filter((reservation) =>
    STATUTS_ENCAISSES.includes(reservation.statut),
  );

  // Taux d'acceptation : sur les seules demandes tranchées. Les demandes encore
  // en attente ne sont ni acceptées ni refusées, les compter fausserait le taux.
  const tranchees = reservations.filter((reservation) =>
    ["refusee", "expiree", "acceptee", "payee", "confirmee", "en_cours", "restituee", "cloturee"]
      .includes(reservation.statut),
  );
  const acceptees = tranchees.filter(
    (reservation) => !["refusee", "expiree"].includes(reservation.statut),
  );

  return {
    netTotal: encaissees.reduce((somme, reservation) => somme + reservation.netProprietaire, 0),
    netMoisCourant: mois[1]?.net ?? 0,
    netMoisPrecedent: mois[0]?.net ?? 0,
    locationsCloturees: reservations.filter((r) => r.statut === "cloturee").length,
    aTraiter: reservationsAtraiter().length,
    aVenir: reservationsAvenir().length,
    enCours: reservationsEnCours().length,
    noteMoyenne:
      avis.length > 0
        ? avis.reduce((somme, entree) => somme + entree.note, 0) / avis.length
        : null,
    nombreAvis: avis.length,
    tauxAcceptation:
      tranchees.length > 0 ? (acceptees.length / tranchees.length) * 100 : null,
    devise: "EUR",
  };
}

/** Fils de discussion, dérivés des réservations les plus récentes. */
export function listerFils(): Fil[] {
  const AMORCES = [
    "Bonjour, la remorque est-elle disponible ce week-end ?",
    "Merci, tout est en ordre pour samedi matin.",
    "Est-ce que le faisceau 13 broches est fourni ?",
    "Je serai un peu en retard, vers 18 h 30, cela vous convient ?",
    "Parfait, à demain 9 h devant le garage.",
  ];

  return listerReservations()
    .slice(0, 12)
    .map((reservation, index) => ({
      id: `f${index}`,
      interlocuteur: reservation.locataire,
      annonceTitre: reservation.annonceTitre,
      dernierMessage: AMORCES[index % AMORCES.length],
      date: reservation.debut,
      nonLus: index < 3 ? (index % 2) + 1 : 0,
    }));
}
