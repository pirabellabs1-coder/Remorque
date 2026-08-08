import "server-only";

import { cache } from "react";

import { and, desc, eq, sql } from "drizzle-orm";

import type { StatutReservation } from "@/domain/reservation/machine";
import { compteConnecte } from "@/server/authentification/session";
import { db } from "@/server/db";
import { annonce, avis as tableAvis, reservation, utilisateur } from "@/server/db/schema";
import { STATUTS_ENCAISSES } from "@/server/donnees-demo";

/**
 * Activité du loueur, lue en base.
 *
 * Ce module produisait jusqu'ici un jeu d'essai déterministe en mémoire. Les
 * réservations et les avis vivent désormais dans PostgreSQL, écrits par
 * `npm run db:demo` : les mêmes lignes servent l'espace loueur, l'espace
 * locataire, l'administration et le calcul des notes publiques. C'était tout
 * l'objet du passage en base — un seul jeu de faits, plusieurs lectures, et
 * aucune chance qu'un écran contredise l'autre.
 *
 * Les signatures publiques gardent leur forme et changent de nature : elles
 * sont devenues asynchrones. C'est la seule modification que subissent les dix
 * écrans qui les consomment.
 *
 * **Aucun montant n'est recalculé ici.** Loyer, commission et net reversé sont
 * lus tels qu'ils ont été figés à la réservation. Les recalculer à l'affichage
 * les ferait diverger de la comptabilité le jour où un barème change — c'est
 * précisément pour cela que `reservation.baremes` conserve le barème appliqué.
 *
 * ─── Portée ──────────────────────────────────────────────────────────────
 *
 * **Tout ici est restreint au loueur connecté.** Aucune fonction n'expose les
 * locations d'un autre, et aucune ne prend de paramètre permettant de le
 * demander. C'est délibéré : le défaut dangereux serait « tout voir », et il
 * suffirait d'un écran ajouté un jour de fatigue pour qu'un propriétaire lise
 * le chiffre d'affaires de son voisin.
 *
 * L'administration, qui a légitimement besoin de la vue d'ensemble, passe par
 * `administration.ts` — un module distinct, derrière une garde distincte.
 *
 * Sans session, les lectures rendent des listes vides plutôt que de lever :
 * les gardes de layout ont déjà renvoyé le visiteur vers la connexion, et une
 * exception ici ne signalerait qu'un défaut de garde, pas une erreur d'usager.
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

/**
 * Nom d'affichage d'un locataire : prénom et initiale du nom.
 *
 * L'espace loueur ne montre jamais le patronyme entier — le locataire n'est
 * pas un client dont on tient le fichier, et la référence de réservation
 * suffit à l'identifier. L'administration, elle, voit le nom complet : elle
 * instruit des litiges et doit désigner quelqu'un sans ambiguïté.
 */
const nomAffiche = sql<string>`
  ${utilisateur.prenom} || coalesce(' ' || left(${utilisateur.nom}, 1) || '.', '')
`;

/* -------------------------------------------------------------------------- */
/*  Lectures                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Mémorisée par requête HTTP : la synthèse, les listes filtrées et les courbes
 * de revenus repartent toutes des mêmes cent quarante lignes. Sans
 * déduplication, un seul tableau de bord les relisait six fois.
 */
export const listerReservations = cache(async (): Promise<Reservation[]> => {
  const moi = await compteConnecte();
  if (!moi) return [];

  const lignes = await db
    .select({
      id: reservation.id,
      reference: reservation.numero,
      annonceId: reservation.annonceId,
      annonceTitre: annonce.titre,
      ville: annonce.ville,
      locataire: nomAffiche,
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
    .where(eq(reservation.proprietaireId, moi.id))
    .orderBy(desc(reservation.debut));

  return lignes.map((ligne) => ({
    ...ligne,
    statut: ligne.statut as StatutReservation,
    commission: ligne.commission ?? 0,
  }));
});

export const listerAvis = cache(async (): Promise<Avis[]> => {
  const moi = await compteConnecte();
  if (!moi) return [];

  const lignes = await db
    .select({
      id: tableAvis.id,
      annonceId: tableAvis.annonceId,
      annonceTitre: annonce.titre,
      auteur: nomAffiche,
      note: tableAvis.note,
      texte: tableAvis.commentaire,
      date: tableAvis.publieLe,
      reponse: tableAvis.reponse,
    })
    .from(tableAvis)
    .innerJoin(annonce, eq(annonce.id, tableAvis.annonceId))
    .innerJoin(utilisateur, eq(utilisateur.id, tableAvis.auteurId))
    .where(
      and(
        eq(tableAvis.destinataireId, moi.id),
        sql`${tableAvis.publieLe} is not null and ${tableAvis.masque} = false`,
      ),
    )
    .orderBy(desc(tableAvis.publieLe));

  return lignes.map((ligne) => ({
    id: ligne.id,
    annonceId: ligne.annonceId!,
    annonceTitre: ligne.annonceTitre,
    auteur: ligne.auteur,
    note: ligne.note,
    texte: ligne.texte ?? "",
    date: ligne.date!,
    reponse: ligne.reponse,
  }));
});

/** Réservations qui demandent une action du loueur, les plus urgentes d'abord. */
export async function reservationsAtraiter(): Promise<Reservation[]> {
  const toutes = await listerReservations();
  return toutes
    .filter((entree) => entree.statut === "demandee")
    .sort((a, b) => a.debut.getTime() - b.debut.getTime());
}

export async function reservationsAvenir(): Promise<Reservation[]> {
  const maintenant = new Date();
  const toutes = await listerReservations();
  return toutes
    .filter(
      (entree) =>
        entree.debut >= maintenant &&
        ["confirmee", "payee", "acceptee"].includes(entree.statut),
    )
    .sort((a, b) => a.debut.getTime() - b.debut.getTime());
}

export async function reservationsEnCours(): Promise<Reservation[]> {
  const toutes = await listerReservations();
  return toutes.filter((entree) => entree.statut === "en_cours");
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
export async function revenusParMois(nombreMois = 12): Promise<MoisRevenu[]> {
  const toutes = await listerReservations();
  const encaissees = toutes.filter((entree) =>
    STATUTS_ENCAISSES.includes(entree.statut),
  );

  const mois: MoisRevenu[] = [];
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

/**
 * Répartition du chiffre d'affaires par annonce, décroissante.
 *
 * Agrégée par PostgreSQL et non en JavaScript : c'est une somme groupée, ce
 * que la base fait mieux que nous, et cela évite de rapatrier cent quarante
 * lignes pour en produire huit.
 */
export async function revenusParAnnonce(): Promise<{ titre: string; net: number }[]> {
  const moi = await compteConnecte();
  if (!moi) return [];

  return db
    .select({
      titre: annonce.titre,
      net: sql<number>`coalesce(sum(${reservation.montantReverse}), 0)::int`,
    })
    .from(reservation)
    .innerJoin(annonce, eq(annonce.id, reservation.annonceId))
    .where(
      and(
        eq(reservation.proprietaireId, moi.id),
        sql`${reservation.statut} in ('payee','confirmee','en_cours','restituee','cloturee')`,
      ),
    )
    .groupBy(annonce.id, annonce.titre)
    .orderBy(sql`coalesce(sum(${reservation.montantReverse}), 0) desc`);
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
export async function syntheseLoueur(): Promise<SyntheseLoueur> {
  const [reservations, avis, mois] = await Promise.all([
    listerReservations(),
    listerAvis(),
    revenusParMois(2),
  ]);

  const maintenant = new Date();
  const encaissees = reservations.filter((entree) =>
    STATUTS_ENCAISSES.includes(entree.statut),
  );

  // Taux d'acceptation : sur les seules demandes tranchées. Les demandes
  // encore en attente ne sont ni acceptées ni refusées ; les compter ferait
  // varier le taux au fil de la journée sans qu'aucune décision soit prise.
  const tranchees = reservations.filter((entree) =>
    [
      "refusee",
      "expiree",
      "acceptee",
      "payee",
      "confirmee",
      "en_cours",
      "restituee",
      "cloturee",
    ].includes(entree.statut),
  );
  const acceptees = tranchees.filter(
    (entree) => !["refusee", "expiree"].includes(entree.statut),
  );

  return {
    netTotal: encaissees.reduce((somme, entree) => somme + entree.netProprietaire, 0),
    netMoisCourant: mois[1]?.net ?? 0,
    netMoisPrecedent: mois[0]?.net ?? 0,
    locationsCloturees: reservations.filter((entree) => entree.statut === "cloturee")
      .length,
    aTraiter: reservations.filter((entree) => entree.statut === "demandee").length,
    aVenir: reservations.filter(
      (entree) =>
        entree.debut >= maintenant &&
        ["confirmee", "payee", "acceptee"].includes(entree.statut),
    ).length,
    enCours: reservations.filter((entree) => entree.statut === "en_cours").length,
    noteMoyenne:
      avis.length > 0
        ? avis.reduce((somme, entree) => somme + entree.note, 0) / avis.length
        : null,
    nombreAvis: avis.length,
    tauxAcceptation:
      tranchees.length > 0 ? (acceptees.length / tranchees.length) * 100 : null,
    devise: reservations[0]?.devise ?? "EUR",
  };
}
