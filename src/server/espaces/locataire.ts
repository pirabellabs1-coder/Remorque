import "server-only";

import type { StatutReservation } from "@/domain/reservation/machine";
import { JEU_DE_DEMONSTRATION } from "@/server/annonces/catalogue";
import {
  AVIS_LOCATAIRES,
  FENETRE_AVIS_JOURS,
  generateur,
  GRAINES,
  joursEntre,
  MESSAGES_FIL,
  REPARTITION_LOCATAIRE,
  REPONSES_LOUEURS,
  STATUTS_ENCAISSES,
  tirer,
  tirerPondere,
  VOLUMES,
} from "@/server/donnees-demo";

/**
 * Dépôt d'activité du locataire.
 *
 * C'est le même monde que `activite.ts`, vu depuis l'autre bout : là où le
 * loueur voit « qui m'a loué », le locataire voit « chez qui j'ai loué ». Les
 * deux dépôts restent séparés parce que les questions ne sont pas les mêmes —
 * le loueur veut son chiffre d'affaires, le locataire veut savoir où retirer
 * sa remorque samedi et quand sa caution sera rendue.
 *
 * Comme pour le dépôt du loueur, le jeu d'essai est **déterministe** : même
 * graine, mêmes chiffres à chaque rendu. Un `Math.random()` nu ferait diverger
 * le rendu serveur et l'hydratation client, et rendrait toute capture d'écran
 * incomparable d'un jour à l'autre.
 */

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Cycle de vie de la caution.
 *
 * La caution n'est pas un paiement : c'est une **empreinte bancaire**, une
 * autorisation gelée sur la carte, jamais encaissée tant que rien ne le
 * justifie. La confondre avec un débit est l'incompréhension la plus coûteuse
 * du parcours — c'est elle qui fait écrire aux locataires « on m'a prélevé
 * 800 € ». Chaque état porte donc un libellé qui dit ce qui se passe sur le
 * compte, pas seulement où en est le dossier.
 */
export type EtatCaution =
  /** Empreinte prise, fonds gelés chez la banque, rien n'est débité. */
  | "empreinte"
  /** Location terminée, libération programmée à l'issue du délai du pays. */
  | "en_liberation"
  /** Autorisation levée, les fonds sont de nouveau disponibles. */
  | "liberee"
  /** Litige ou sinistre ouvert : la libération est suspendue — règle 6. */
  | "gelee"
  /** Retenue partielle ou totale, après accord ou arbitrage. */
  | "retenue";

export type MaReservation = {
  id: string;
  reference: string;
  annonceId: string;
  annonceTitre: string;
  slug: string;
  villeSlug: string;
  ville: string;
  /** Le loueur en face : prénom seul, comme partout dans l'interface publique. */
  proprietaire: string;
  proprietaireProfessionnel: boolean;
  debut: Date;
  fin: Date;
  statut: StatutReservation;
  /** Tous les montants sont des entiers de centimes. */
  montantTotal: number;
  caution: number;
  cautionEtat: EtatCaution;
  /** Montant effectivement retenu sur la caution, en centimes. Zéro le plus souvent. */
  cautionRetenue: number;
  devise: string;
  /** Un avis a-t-il déjà été déposé pour cette location ? */
  avisDepose: boolean;
  photo: string;
};

export type Favori = {
  annonceId: string;
  titre: string;
  slug: string;
  villeSlug: string;
  ville: string;
  prixJour: number;
  devise: string;
  photo: string;
  note: number | null;
  nombreAvis: number;
  ajouteLe: Date;
  /** Le prix a-t-il bougé depuis la mise en favori ? En centimes, signé. */
  variationPrix: number;
};

export type LignePaiement = {
  id: string;
  reference: string;
  annonceTitre: string;
  date: Date;
  /** `location` est débité, `caution` est seulement gelé, `remboursement` est crédité. */
  nature: "location" | "caution" | "remboursement";
  montant: number;
  devise: string;
  moyen: string;
  cautionEtat: EtatCaution | null;
};

export type MonAvis = {
  id: string;
  reservationId: string;
  annonceId: string;
  annonceTitre: string;
  slug: string;
  villeSlug: string;
  proprietaire: string;
  note: number;
  texte: string;
  date: Date;
  reponse: string | null;
};

/** Location terminée pour laquelle aucun avis n'a encore été écrit. */
export type AvisAecrire = {
  reservationId: string;
  annonceTitre: string;
  slug: string;
  villeSlug: string;
  proprietaire: string;
  finLe: Date;
  /** Jours restants avant la fermeture du dépôt d'avis. */
  joursRestants: number;
};

export type FilLocataire = {
  id: string;
  proprietaire: string;
  annonceTitre: string;
  reference: string;
  dernierMessage: string;
  /** L'auteur du dernier message : savoir si la balle est dans notre camp. */
  deMoi: boolean;
  date: Date;
  nonLus: number;
};

export type SyntheseLocataire = {
  aVenir: number;
  enCours: number;
  terminees: number;
  /** Somme des cautions encore gelées, en centimes. */
  cautionsGelees: number;
  cautionsNombre: number;
  messagesNonLus: number;
  avisAecrire: number;
  totalDepense: number;
  devise: string;
};

/** Délai de libération de la caution, en jours. Valeur France du cadrage. */
const DELAI_LIBERATION_JOURS = 7;

/**
 * Moyens de paiement du jeu d'essai.
 *
 * Volontairement peu variés : un particulier paie presque toujours avec la
 * même carte. Une liste où chaque location porterait un moyen différent
 * donnerait un relevé que personne ne reconnaîtrait comme le sien.
 */
const MOYENS = ["Visa ••4218", "Mastercard ••7731", "Visa ••4218", "Visa ••4218"];

const global_ = globalThis as unknown as {
  __flexitrailerLocataire?: {
    reservations: MaReservation[];
    favoris: Favori[];
    avis: MonAvis[];
  };
};

function construire() {
  const annonces = JEU_DE_DEMONSTRATION;
  const hasard = generateur(GRAINES.locataire);

  const aujourdhui = new Date();
  aujourdhui.setHours(12, 0, 0, 0);

  const reservations: MaReservation[] = [];
  const avis: MonAvis[] = [];

  // Dix-huit locations sur deux ans : l'historique plausible d'un particulier
  // qui déménage, bricole et part en vacances. Cent quarante, comme pour le
  // loueur, n'aurait aucun sens ici — personne ne loue une remorque par
  // semaine.
  for (let index = 0; index < VOLUMES.reservationsLocataire; index += 1) {
    const annonce = annonces[Math.floor(hasard() * annonces.length)];
    if (!annonce) break;

    const joursEnArriere = Math.floor(hasard() * 700);
    const debut = new Date(aujourdhui);
    debut.setDate(debut.getDate() - joursEnArriere + 45);

    const duree = 1 + Math.floor(hasard() * 4);
    const fin = new Date(debut);
    fin.setDate(fin.getDate() + duree);

    // Même règle de cohérence que chez le loueur : le statut ne peut pas
    // contredire les dates. Une location terminée n'est jamais « confirmée ».
    let statut = tirerPondere(hasard, REPARTITION_LOCATAIRE);
    const passee = fin < aujourdhui;
    const future = debut > aujourdhui;

    if (passee && ["confirmee", "payee", "acceptee", "demandee", "en_cours"].includes(statut)) {
      statut = hasard() < 0.92 ? "cloturee" : "annulee";
    }
    if (future && ["cloturee", "restituee", "en_cours"].includes(statut)) {
      statut = hasard() < 0.75 ? "confirmee" : "demandee";
    }
    if (!passee && !future) statut = "en_cours";

    // État de la caution, déduit du statut et du calendrier — jamais tiré au
    // sort indépendamment, sans quoi l'écran des paiements contredirait celui
    // des réservations.
    let cautionEtat: EtatCaution;
    let cautionRetenue = 0;

    if (["demandee", "refusee", "annulee", "expiree"].includes(statut)) {
      // Sans location, aucune empreinte n'a été prise.
      cautionEtat = "liberee";
    } else if (statut === "cloturee") {
      const depuisLaFin = joursEntre(fin, aujourdhui);
      if (depuisLaFin < DELAI_LIBERATION_JOURS) {
        cautionEtat = "en_liberation";
      } else if (hasard() < 0.06) {
        // Une retenue reste rare : la plupart des locations se passent bien.
        cautionEtat = "retenue";
        cautionRetenue = Math.round(annonce.caution * (0.1 + hasard() * 0.3));
      } else {
        cautionEtat = "liberee";
      }
    } else if (statut === "restituee") {
      cautionEtat = hasard() < 0.15 ? "gelee" : "en_liberation";
    } else {
      cautionEtat = "empreinte";
    }

    const montantTotal = annonce.prixJour * duree;

    reservations.push({
      id: `l${index.toString().padStart(3, "0")}`,
      reference: `FT-${debut.getFullYear()}-${(9000 + index).toString()}`,
      annonceId: annonce.id,
      annonceTitre: annonce.titre,
      slug: annonce.slug,
      villeSlug: annonce.villeSlug,
      ville: annonce.ville,
      proprietaire: annonce.proprietaire.prenom,
      proprietaireProfessionnel: annonce.proprietaire.professionnel,
      debut,
      fin,
      statut,
      montantTotal,
      caution: annonce.caution,
      cautionEtat,
      cautionRetenue,
      devise: annonce.devise,
      avisDepose: false,
      photo: annonce.photo,
    });
  }

  reservations.sort((a, b) => b.debut.getTime() - a.debut.getTime());

  // Avis déposés : environ deux locations closes sur trois, et seulement dans
  // la fenêtre autorisée. Un avis écrit deux ans après la location n'existe pas.
  for (const reservation of reservations) {
    if (reservation.statut !== "cloturee") continue;
    if (joursEntre(reservation.fin, aujourdhui) > FENETRE_AVIS_JOURS && hasard() > 0.66) continue;
    if (joursEntre(reservation.fin, aujourdhui) <= FENETRE_AVIS_JOURS && hasard() > 0.4) continue;

    const note = hasard() < 0.7 ? 5 : hasard() < 0.88 ? 4 : 3;
    const date = new Date(reservation.fin);
    date.setDate(date.getDate() + 1 + Math.floor(hasard() * 4));

    avis.push({
      id: `mav${avis.length.toString().padStart(3, "0")}`,
      reservationId: reservation.id,
      annonceId: reservation.annonceId,
      annonceTitre: reservation.annonceTitre,
      slug: reservation.slug,
      villeSlug: reservation.villeSlug,
      proprietaire: reservation.proprietaire,
      note,
      texte: tirer(hasard, AVIS_LOCATAIRES),
      date,
      reponse: hasard() < 0.35 ? tirer(hasard, REPONSES_LOUEURS) : null,
    });

    reservation.avisDepose = true;
  }

  avis.sort((a, b) => b.date.getTime() - a.date.getTime());

  // Favoris : des annonces jamais louées, sinon ce serait un historique.
  const louees = new Set(reservations.map((reservation) => reservation.annonceId));
  const favoris: Favori[] = [];

  for (const annonce of annonces) {
    if (louees.has(annonce.id)) continue;
    if (favoris.length >= 7) break;
    if (hasard() > 0.25) continue;

    const ajouteLe = new Date(aujourdhui);
    ajouteLe.setDate(ajouteLe.getDate() - Math.floor(hasard() * 180));

    // Une variation de prix depuis la mise en favori : c'est la seule raison
    // de revenir voir sa liste, et donc ce que l'écran doit signaler.
    const tirage = hasard();
    const variationPrix =
      tirage < 0.2
        ? -Math.round(annonce.prixJour * (0.05 + hasard() * 0.15))
        : tirage < 0.35
          ? Math.round(annonce.prixJour * (0.05 + hasard() * 0.12))
          : 0;

    favoris.push({
      annonceId: annonce.id,
      titre: annonce.titre,
      slug: annonce.slug,
      villeSlug: annonce.villeSlug,
      ville: annonce.ville,
      prixJour: annonce.prixJour,
      devise: annonce.devise,
      photo: annonce.photo,
      note: annonce.note,
      nombreAvis: annonce.nombreAvis,
      ajouteLe,
      variationPrix,
    });
  }

  favoris.sort((a, b) => b.ajouteLe.getTime() - a.ajouteLe.getTime());

  return { reservations, favoris, avis };
}

function donnees() {
  global_.__flexitrailerLocataire ??= construire();
  return global_.__flexitrailerLocataire;
}

/* -------------------------------------------------------------------------- */
/*  Lectures                                                                  */
/* -------------------------------------------------------------------------- */

export function mesReservations(): MaReservation[] {
  return donnees().reservations;
}

export function mesFavoris(): Favori[] {
  return donnees().favoris;
}

export function mesAvis(): MonAvis[] {
  return donnees().avis;
}

/** Locations à venir, la plus proche d'abord — l'ordre dans lequel on les vit. */
export function reservationsAvenir(): MaReservation[] {
  const maintenant = new Date();
  return mesReservations()
    .filter(
      (reservation) =>
        reservation.debut >= maintenant &&
        ["demandee", "acceptee", "payee", "confirmee"].includes(reservation.statut),
    )
    .sort((a, b) => a.debut.getTime() - b.debut.getTime());
}

export function reservationsEnCours(): MaReservation[] {
  return mesReservations().filter(
    (reservation) => reservation.statut === "en_cours",
  );
}

/**
 * La location que le tableau de bord met en avant, et le nombre de jours qui
 * l'en sépare.
 *
 * Le décompte est calculé ici et non dans la page : lire l'heure courante
 * pendant un rendu est impur, et le rendu serveur et l'hydratation client
 * pourraient tomber de part et d'autre de minuit. Une location en cours prime
 * sur une location à venir — on est dedans.
 */
export function prochaineLocation(): {
  reservation: MaReservation;
  joursAvant: number;
} | null {
  const reservation = reservationsEnCours()[0] ?? reservationsAvenir()[0];
  if (!reservation) return null;

  const aujourdhui = new Date();
  aujourdhui.setHours(0, 0, 0, 0);
  const debut = new Date(reservation.debut);
  debut.setHours(0, 0, 0, 0);

  return { reservation, joursAvant: Math.max(0, joursEntre(aujourdhui, debut)) };
}

export function reservationsPassees(): MaReservation[] {
  return mesReservations().filter((reservation) =>
    ["cloturee", "restituee", "annulee", "refusee", "expiree"].includes(
      reservation.statut,
    ),
  );
}

/**
 * Cautions encore immobilisées.
 *
 * Ce sont les seules qui pèsent sur le plafond de la carte du locataire, et
 * donc les seules qui l'intéressent. Une caution libérée n'a plus à figurer
 * dans un total.
 */
export function cautionsEnCours(): MaReservation[] {
  return mesReservations()
    .filter((reservation) =>
      ["empreinte", "en_liberation", "gelee"].includes(reservation.cautionEtat),
    )
    .sort((a, b) => a.fin.getTime() - b.fin.getTime());
}

/**
 * Locations terminées sans avis, encore dans la fenêtre de dépôt.
 *
 * La fenêtre est affichée en jours restants et non en date de fermeture :
 * « il vous reste 4 jours » se comprend d'un coup d'œil, « avant le 12/08 »
 * demande un calcul.
 */
export function avisAecrire(): AvisAecrire[] {
  const aujourdhui = new Date();

  return mesReservations()
    .filter((reservation) => reservation.statut === "cloturee" && !reservation.avisDepose)
    .map((reservation) => ({
      reservationId: reservation.id,
      annonceTitre: reservation.annonceTitre,
      slug: reservation.slug,
      villeSlug: reservation.villeSlug,
      proprietaire: reservation.proprietaire,
      finLe: reservation.fin,
      joursRestants: FENETRE_AVIS_JOURS - joursEntre(reservation.fin, aujourdhui),
    }))
    .filter((entree) => entree.joursRestants > 0)
    .sort((a, b) => a.joursRestants - b.joursRestants);
}

/**
 * Relevé des mouvements.
 *
 * La caution y figure comme une ligne distincte de la location, avec son état,
 * parce que c'est exactement la confusion qu'il faut lever : l'une est débitée,
 * l'autre seulement gelée. Les mettre sur la même ligne, ou n'en montrer que la
 * somme, produirait le malentendu que cet écran existe pour éviter.
 */
export function mesPaiements(): LignePaiement[] {
  const lignes: LignePaiement[] = [];

  for (const reservation of mesReservations()) {
    if (["demandee", "refusee", "expiree"].includes(reservation.statut)) continue;

    // Le moyen varie d'une location à l'autre : toutes les références
    // commencent par « FT-AAAA-9 », si bien qu'un index pris trop tôt dans la
    // chaîne donnerait la même carte partout — ce qui se voit immédiatement à
    // l'écran, et fait douter du reste du relevé.
    const rang = Number.parseInt(reservation.id.slice(1), 10);
    const moyen = MOYENS[rang % MOYENS.length];

    lignes.push({
      id: `${reservation.id}-loc`,
      reference: reservation.reference,
      annonceTitre: reservation.annonceTitre,
      date: reservation.debut,
      nature: "location",
      montant: reservation.montantTotal,
      devise: reservation.devise,
      moyen,
      cautionEtat: null,
    });

    if (reservation.statut === "annulee") {
      lignes.push({
        id: `${reservation.id}-remb`,
        reference: reservation.reference,
        annonceTitre: reservation.annonceTitre,
        date: reservation.debut,
        nature: "remboursement",
        montant: reservation.montantTotal,
        devise: reservation.devise,
        moyen,
        cautionEtat: null,
      });
      continue;
    }

    lignes.push({
      id: `${reservation.id}-cau`,
      reference: reservation.reference,
      annonceTitre: reservation.annonceTitre,
      date: reservation.debut,
      nature: "caution",
      montant: reservation.caution,
      devise: reservation.devise,
      moyen,
      cautionEtat: reservation.cautionEtat,
    });
  }

  return lignes.sort((a, b) => b.date.getTime() - a.date.getTime());
}

/** Fils de discussion, un par location engagée. */
export function mesFils(): FilLocataire[] {
  return mesReservations()
    .filter((reservation) => reservation.statut !== "expiree")
    .slice(0, 10)
    .map((reservation, index) => {
      const amorce = MESSAGES_FIL[index % MESSAGES_FIL.length];
      return {
        id: `fl${index}`,
        proprietaire: reservation.proprietaire,
        annonceTitre: reservation.annonceTitre,
        reference: reservation.reference,
        dernierMessage: amorce.texte,
        deMoi: amorce.deMoi,
        date: reservation.debut,
        // Seuls les messages reçus peuvent être non lus : compter les siens
        // comme non lus est un bogue classique, et visible.
        nonLus: !amorce.deMoi && index < 4 ? (index % 2) + 1 : 0,
      };
    });
}

/** Chiffres de tête du tableau de bord. Aucun n'est inventé au rendu. */
export function syntheseLocataire(): SyntheseLocataire {
  const reservations = mesReservations();
  const cautions = cautionsEnCours();

  const depensees = reservations.filter((reservation) =>
    STATUTS_ENCAISSES.includes(reservation.statut),
  );

  return {
    aVenir: reservationsAvenir().length,
    enCours: reservationsEnCours().length,
    terminees: reservations.filter((reservation) => reservation.statut === "cloturee")
      .length,
    cautionsGelees: cautions.reduce((somme, reservation) => somme + reservation.caution, 0),
    cautionsNombre: cautions.length,
    messagesNonLus: mesFils().reduce((somme, fil) => somme + fil.nonLus, 0),
    avisAecrire: avisAecrire().length,
    totalDepense: depensees.reduce(
      (somme, reservation) => somme + reservation.montantTotal,
      0,
    ),
    devise: "EUR",
  };
}
