import "server-only";

import type { StatutReservation } from "@/domain/reservation/machine";
import { listerAnnonces } from "@/server/annonces/depot";
import {
  AVIS_LOCATAIRES,
  generateur,
  GRAINES,
  MESSAGES_FIL,
  REPARTITION_LOUEUR,
  REPONSES_LOUEURS,
  STATUTS_ENCAISSES,
  tirer,
  tirerPersonne,
  tirerPondere,
  VOLUMES,
} from "@/server/donnees-demo";

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

/** Commission de la plateforme, en points de base — 15 %. */
const COMMISSION_PDB = 1500;

const global_ = globalThis as unknown as {
  __flexitrailerActivite?: { reservations: Reservation[]; avis: Avis[] };
};

function construire(): { reservations: Reservation[]; avis: Avis[] } {
  const annonces = listerAnnonces();
  const hasard = generateur(GRAINES.activiteLoueur);

  const reservations: Reservation[] = [];
  const avis: Avis[] = [];

  const aujourdhui = new Date();
  aujourdhui.setHours(12, 0, 0, 0);

  // Réparties sur les quatorze derniers mois : de quoi dessiner une courbe
  // annuelle et une saisonnalité crédible. Le volume se règle dans
  // `donnees-demo/volumes.ts`.
  for (let index = 0; index < VOLUMES.reservationsLoueur; index += 1) {
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
    let statut = tirerPondere(hasard, REPARTITION_LOUEUR);
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

    // Le locataire vient de l'annuaire commun, et s'affiche en prénom et
    // initiale : un loueur n'a pas à connaître le patronyme de son locataire.
    // L'administration, elle, lit le même annuaire en nom complet.
    const locataire = tirerPersonne(hasard);

    reservations.push({
      id: `r${index.toString().padStart(3, "0")}`,
      reference: `FT-${debut.getFullYear()}-${(index + 1).toString().padStart(4, "0")}`,
      annonceId: annonce.id,
      annonceTitre: annonce.titre,
      ville: annonce.ville,
      locataire: locataire.nomAffiche,
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
      texte: tirer(hasard, AVIS_LOCATAIRES),
      date,
      reponse: hasard() < 0.3 ? tirer(hasard, REPONSES_LOUEURS) : null,
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

/**
 * Fils de discussion, dérivés des réservations les plus récentes.
 *
 * Les messages viennent du jeu commun, dont le point de vue de référence est
 * celui du **locataire** : `deMoi` y signifie « écrit par le locataire ». Vu du
 * loueur, ce sont donc exactement ces messages-là qui peuvent être non lus, et
 * jamais les siens. Compter ses propres messages comme non lus est le bogue
 * classique de cet écran, et il se voit tout de suite.
 */
export function listerFils(): Fil[] {
  return listerReservations()
    .slice(0, 12)
    .map((reservation, index) => {
      const message = MESSAGES_FIL[index % MESSAGES_FIL.length];

      return {
        id: `f${index}`,
        interlocuteur: reservation.locataire,
        annonceTitre: reservation.annonceTitre,
        dernierMessage: message.texte,
        date: reservation.debut,
        nonLus: message.deMoi && index < 4 ? (index % 2) + 1 : 0,
      };
    });
}
