import "server-only";

import { desc, eq, sql } from "drizzle-orm";

import type { StatutReservation } from "@/domain/reservation/machine";
import { db } from "@/server/db";
import {
  annonce,
  avis as tableAvis,
  reservation,
  tarif,
  utilisateur,
} from "@/server/db/schema";
import {
  aujourdhui,
  decalerJours,
  FENETRE_AVIS_JOURS,
  generateur,
  GRAINES,
  joursEntre,
  MESSAGES_FIL,
  tirerEntier,
  VOLUMES,
} from "@/server/donnees-demo";

/**
 * Activité du locataire, lue en base.
 *
 * C'est le même monde que `activite.ts`, vu depuis l'autre bout : là où le
 * loueur voit « qui m'a loué », le locataire voit « chez qui j'ai loué ». Les
 * deux dépôts restent séparés parce que les questions ne sont pas les mêmes —
 * le loueur veut son chiffre d'affaires, le locataire veut savoir où retirer
 * sa remorque samedi et quand sa caution lui sera rendue.
 *
 * Les réservations et les avis viennent désormais de PostgreSQL, ceux-là mêmes
 * que lit l'espace loueur. Une location vue des deux côtés est la même ligne :
 * si le loueur la dit close, le locataire ne peut pas la voir en cours.
 *
 * Ce qui reste engendré ici, faute de table alimentée : l'état des cautions,
 * les favoris et les fils de discussion. Chacun est dérivé de données réelles
 * et le dit à l'endroit où il est construit.
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
 * même carte. Un relevé où chaque location porterait un moyen différent ne
 * serait reconnu comme le sien par personne.
 */
const MOYENS = ["Visa ••4218", "Mastercard ••7731", "Visa ••4218", "Visa ••4218"];

/**
 * Le compte dont on montre l'espace.
 *
 * Tant que l'authentification n'est pas branchée, l'espace locataire affiche
 * celui d'un compte désigné, créé par `npm run db:demo` avec un historique
 * complet. Le jour où la session existe, c'est cette fonction qui la lira —
 * une ligne, à un seul endroit, plutôt qu'un identifiant recopié dans chaque
 * requête.
 */
const COURRIEL_DEMO = "moi@demonstration.flexitrailer.eu";

async function compteCourant(): Promise<string | null> {
  const [ligne] = await db
    .select({ id: utilisateur.id })
    .from(utilisateur)
    .where(eq(utilisateur.email, COURRIEL_DEMO))
    .limit(1);

  return ligne?.id ?? null;
}

/**
 * État de la caution, déduit du statut et du calendrier.
 *
 * La table `caution` existe mais n'est pas alimentée : l'état est donc dérivé
 * plutôt qu'inventé, et toujours des mêmes faits — le statut de la réservation
 * et la date de restitution. Le déduire garantit qu'il ne peut pas contredire
 * la réservation qu'il accompagne, ce qu'une colonne indépendante permettrait.
 */
function etatCaution(
  statut: StatutReservation,
  fin: Date,
  maintenant: Date,
): EtatCaution {
  // Sans location engagée, aucune empreinte n'a été prise.
  if (["demandee", "refusee", "annulee", "expiree"].includes(statut)) return "liberee";
  if (statut === "restituee") return "en_liberation";

  if (statut === "cloturee") {
    return joursEntre(fin, maintenant) < DELAI_LIBERATION_JOURS
      ? "en_liberation"
      : "liberee";
  }

  return "empreinte";
}

/* -------------------------------------------------------------------------- */
/*  Lectures                                                                  */
/* -------------------------------------------------------------------------- */

export async function mesReservations(): Promise<MaReservation[]> {
  const moi = await compteCourant();
  if (!moi) return [];

  const maintenant = aujourdhui();

  const lignes = await db
    .select({
      id: reservation.id,
      reference: reservation.numero,
      annonceId: reservation.annonceId,
      annonceTitre: annonce.titre,
      slug: annonce.slug,
      villeSlug: annonce.villeSlug,
      ville: annonce.ville,
      proprietaire: utilisateur.prenom,
      proprietaireProfessionnel: sql<boolean>`${utilisateur.typeCompte} = 'professionnel'`,
      debut: reservation.debut,
      fin: reservation.fin,
      statut: reservation.statut,
      montantTotal: reservation.totalLocataire,
      caution: reservation.caution,
      devise: reservation.devise,
      photo: sql<string | null>`(
        select p.url from annonce_photo p
        where p.annonce_id = ${annonce.id}
        order by p.ordre limit 1
      )`,
      // Un avis existe-t-il déjà pour cette location ? Compté en base plutôt
      // que supposé : c'est ce qui décide si l'écran propose d'en écrire un.
      avisDepose: sql<boolean>`exists (
        select 1 from avis a where a.reservation_id = ${reservation.id}
      )`,
    })
    .from(reservation)
    .innerJoin(annonce, eq(annonce.id, reservation.annonceId))
    .innerJoin(utilisateur, eq(utilisateur.id, reservation.proprietaireId))
    .where(eq(reservation.locataireId, moi))
    .orderBy(desc(reservation.debut));

  return lignes.map((ligne) => ({
    ...ligne,
    statut: ligne.statut as StatutReservation,
    proprietaire: ligne.proprietaire ?? "",
    photo: ligne.photo ?? "",
    cautionEtat: etatCaution(ligne.statut as StatutReservation, ligne.fin, maintenant),
    // Aucune retenue n'est simulée : la table `caution` n'est pas alimentée, et
    // inventer une retenue ferait croire à un litige qui n'existe pas.
    cautionRetenue: 0,
  }));
}

export async function mesAvis(): Promise<MonAvis[]> {
  const moi = await compteCourant();
  if (!moi) return [];

  const lignes = await db
    .select({
      id: tableAvis.id,
      reservationId: tableAvis.reservationId,
      annonceId: tableAvis.annonceId,
      annonceTitre: annonce.titre,
      slug: annonce.slug,
      villeSlug: annonce.villeSlug,
      proprietaire: utilisateur.prenom,
      note: tableAvis.note,
      texte: tableAvis.commentaire,
      date: tableAvis.publieLe,
      reponse: tableAvis.reponse,
    })
    .from(tableAvis)
    .innerJoin(annonce, eq(annonce.id, tableAvis.annonceId))
    .innerJoin(utilisateur, eq(utilisateur.id, tableAvis.destinataireId))
    .where(eq(tableAvis.auteurId, moi))
    .orderBy(desc(tableAvis.publieLe));

  return lignes.map((ligne) => ({
    id: ligne.id,
    reservationId: ligne.reservationId,
    annonceId: ligne.annonceId!,
    annonceTitre: ligne.annonceTitre,
    slug: ligne.slug,
    villeSlug: ligne.villeSlug,
    proprietaire: ligne.proprietaire ?? "",
    note: ligne.note,
    texte: ligne.texte ?? "",
    date: ligne.date!,
    reponse: ligne.reponse,
  }));
}

/** Locations à venir, la plus proche d'abord — l'ordre dans lequel on les vit. */
export async function reservationsAvenir(): Promise<MaReservation[]> {
  const maintenant = new Date();
  return (await mesReservations())
    .filter(
      (entree) =>
        entree.debut >= maintenant &&
        ["demandee", "acceptee", "payee", "confirmee"].includes(entree.statut),
    )
    .sort((a, b) => a.debut.getTime() - b.debut.getTime());
}

export async function reservationsEnCours(): Promise<MaReservation[]> {
  return (await mesReservations()).filter((entree) => entree.statut === "en_cours");
}

/**
 * La location à mettre en tête du tableau de bord.
 *
 * Une location en cours prime sur une location à venir : on est dedans. Le
 * nombre de jours restants est calculé ici plutôt qu'à l'affichage, pour que
 * l'écran n'ait pas à refaire une soustraction de dates dont il se tromperait
 * au changement d'heure.
 */
export async function prochaineLocation(): Promise<{
  reservation: MaReservation;
  joursAvant: number;
} | null> {
  const enCours = await reservationsEnCours();
  const choisie = enCours[0] ?? (await reservationsAvenir())[0];
  if (!choisie) return null;

  return {
    reservation: choisie,
    joursAvant: Math.max(0, joursEntre(new Date(), choisie.debut)),
  };
}

export async function reservationsPassees(): Promise<MaReservation[]> {
  return (await mesReservations()).filter((entree) =>
    ["cloturee", "restituee", "annulee", "refusee", "expiree"].includes(entree.statut),
  );
}

/**
 * Cautions encore immobilisées.
 *
 * Ce sont les seules qui pèsent sur le plafond de la carte du locataire, et
 * donc les seules qui l'intéressent. Une caution libérée n'a plus à figurer
 * dans un total.
 */
export async function cautionsEnCours(): Promise<MaReservation[]> {
  return (await mesReservations())
    .filter((entree) =>
      ["empreinte", "en_liberation", "gelee"].includes(entree.cautionEtat),
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
export async function avisAecrire(): Promise<AvisAecrire[]> {
  const maintenant = new Date();

  return (await mesReservations())
    .filter((entree) => entree.statut === "cloturee" && !entree.avisDepose)
    .map((entree) => ({
      reservationId: entree.id,
      annonceTitre: entree.annonceTitre,
      slug: entree.slug,
      villeSlug: entree.villeSlug,
      proprietaire: entree.proprietaire,
      finLe: entree.fin,
      joursRestants: FENETRE_AVIS_JOURS - joursEntre(entree.fin, maintenant),
    }))
    .filter((entree) => entree.joursRestants > 0)
    .sort((a, b) => a.joursRestants - b.joursRestants);
}

/**
 * Relevé des mouvements.
 *
 * La caution y figure comme une ligne distincte de la location, avec son état,
 * parce que c'est exactement la confusion qu'il faut lever : l'une est débitée,
 * l'autre seulement gelée. Les mettre sur la même ligne, ou n'en montrer que
 * la somme, produirait le malentendu que cet écran existe pour éviter.
 */
export async function mesPaiements(): Promise<LignePaiement[]> {
  const lignes: LignePaiement[] = [];

  for (const entree of await mesReservations()) {
    if (["demandee", "refusee", "expiree"].includes(entree.statut)) continue;

    const moyen = MOYENS[entree.reference.charCodeAt(8) % MOYENS.length];

    lignes.push({
      id: `${entree.id}-loc`,
      reference: entree.reference,
      annonceTitre: entree.annonceTitre,
      date: entree.debut,
      nature: "location",
      montant: entree.montantTotal,
      devise: entree.devise,
      moyen,
      cautionEtat: null,
    });

    if (entree.statut === "annulee") {
      lignes.push({
        id: `${entree.id}-remb`,
        reference: entree.reference,
        annonceTitre: entree.annonceTitre,
        date: entree.debut,
        nature: "remboursement",
        montant: entree.montantTotal,
        devise: entree.devise,
        moyen,
        cautionEtat: null,
      });
      continue;
    }

    lignes.push({
      id: `${entree.id}-cau`,
      reference: entree.reference,
      annonceTitre: entree.annonceTitre,
      date: entree.debut,
      nature: "caution",
      montant: entree.caution,
      devise: entree.devise,
      moyen,
      cautionEtat: entree.cautionEtat,
    });
  }

  return lignes.sort((a, b) => b.date.getTime() - a.date.getTime());
}

/**
 * Favoris.
 *
 * La table n'existe pas encore : la liste est dérivée du catalogue réel, en
 * écartant ce que le compte a déjà loué — mettre en favori une remorque qu'on
 * vient de rendre n'aurait pas de sens. Le tirage est déterministe, donc stable
 * d'un rechargement à l'autre.
 */
export async function mesFavoris(): Promise<Favori[]> {
  const louees = new Set((await mesReservations()).map((entree) => entree.annonceId));
  const hasard = generateur(GRAINES.locataire);
  const maintenant = aujourdhui();

  const lignes = await db
    .select({
      annonceId: annonce.id,
      titre: annonce.titre,
      slug: annonce.slug,
      villeSlug: annonce.villeSlug,
      ville: annonce.ville,
      devise: annonce.devise,
      prixJour: tarif.prixJour,
      photo: sql<string | null>`(
        select p.url from annonce_photo p
        where p.annonce_id = ${annonce.id} order by p.ordre limit 1
      )`,
      moyenne: sql<string | null>`(
        select avg(a.note) from avis a
        where a.annonce_id = ${annonce.id} and a.publie_le is not null
      )`,
      nombreAvis: sql<number>`(
        select count(*)::int from avis a
        where a.annonce_id = ${annonce.id} and a.publie_le is not null
      )`,
    })
    .from(annonce)
    .leftJoin(tarif, eq(tarif.annonceId, annonce.id))
    .where(eq(annonce.statut, "publiee"));

  const favoris: Favori[] = [];

  for (const ligne of lignes) {
    if (louees.has(ligne.annonceId)) continue;
    if (favoris.length >= VOLUMES.favoris) break;

    const prixJour = ligne.prixJour ?? 0;
    const tirage = hasard();

    // Une variation de prix depuis la mise en favori : c'est la seule raison de
    // revenir consulter sa liste, et donc ce que l'écran doit signaler.
    const variationPrix =
      tirage < 0.25
        ? -Math.round(prixJour * (0.05 + hasard() * 0.15))
        : tirage < 0.45
          ? Math.round(prixJour * (0.05 + hasard() * 0.12))
          : 0;

    favoris.push({
      annonceId: ligne.annonceId,
      titre: ligne.titre,
      slug: ligne.slug,
      villeSlug: ligne.villeSlug,
      ville: ligne.ville,
      prixJour,
      devise: ligne.devise,
      photo: ligne.photo ?? "",
      note: ligne.moyenne === null ? null : Number(ligne.moyenne),
      nombreAvis: ligne.nombreAvis,
      ajouteLe: decalerJours(maintenant, -tirerEntier(hasard, 1, 180)),
      variationPrix,
    });
  }

  return favoris.sort((a, b) => b.ajouteLe.getTime() - a.ajouteLe.getTime());
}

/**
 * Fils de discussion, un par location engagée.
 *
 * La messagerie n'a pas de table alimentée : les interlocuteurs, les matériels
 * et les références sont vrais, les textes sont des amorces. C'est l'écran qui
 * est incomplet, non les données qui seraient fausses.
 */
export async function mesFils(): Promise<FilLocataire[]> {
  const reservations = await mesReservations();

  return reservations
    .filter((entree) => entree.statut !== "expiree")
    .slice(0, 10)
    .map((entree, index) => {
      const amorce = MESSAGES_FIL[index % MESSAGES_FIL.length];
      return {
        id: `fl${index}`,
        proprietaire: entree.proprietaire,
        annonceTitre: entree.annonceTitre,
        reference: entree.reference,
        dernierMessage: amorce.texte,
        deMoi: amorce.deMoi,
        date: entree.debut,
        // Seuls les messages reçus peuvent être non lus : compter les siens
        // comme non lus est un bogue classique, et visible.
        nonLus: !amorce.deMoi && index < 4 ? (index % 2) + 1 : 0,
      };
    });
}

/** Chiffres de tête du tableau de bord. Aucun n'est inventé au rendu. */
export async function syntheseLocataire(): Promise<SyntheseLocataire> {
  const [reservations, cautions, fils, aEcrire] = await Promise.all([
    mesReservations(),
    cautionsEnCours(),
    mesFils(),
    avisAecrire(),
  ]);

  const maintenant = new Date();

  const depensees = reservations.filter((entree) =>
    ["payee", "confirmee", "en_cours", "restituee", "cloturee"].includes(entree.statut),
  );

  return {
    aVenir: reservations.filter(
      (entree) =>
        entree.debut >= maintenant &&
        ["demandee", "acceptee", "payee", "confirmee"].includes(entree.statut),
    ).length,
    enCours: reservations.filter((entree) => entree.statut === "en_cours").length,
    terminees: reservations.filter((entree) => entree.statut === "cloturee").length,
    cautionsGelees: cautions.reduce((somme, entree) => somme + entree.caution, 0),
    cautionsNombre: cautions.length,
    messagesNonLus: fils.reduce((somme, fil) => somme + fil.nonLus, 0),
    avisAecrire: aEcrire.length,
    totalDepense: depensees.reduce((somme, entree) => somme + entree.montantTotal, 0),
    devise: reservations[0]?.devise ?? "EUR",
  };
}
