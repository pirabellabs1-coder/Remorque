import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import {
  devise,
  id,
  montant,
  pointGeographique,
  positionGeographique,
  reference,
  timestamps,
} from "./_helpers";
import { pays } from "./pays";
import { utilisateur } from "./utilisateur";

export const statutAnnonce = pgEnum("statut_annonce", [
  "brouillon",
  "en_moderation",
  "publiee",
  "refusee",
  "suspendue",
  "archivee",
]);

export const politiqueAnnulation = pgEnum("politique_annulation", [
  "souple",
  "moderee",
  "stricte",
]);

/**
 * Arborescence du catalogue (M02), modifiable depuis l'administration.
 * Les champs propres à une catégorie sont décrits par `schemaChamps` : une
 * benne et un van à chevaux n'ont pas les mêmes caractéristiques à saisir.
 */
export const categorie = pgTable(
  "categorie",
  {
    id: id(),
    slug: text("slug").notNull(),
    nom: text("nom").notNull(),
    parentId: reference("parent_id"),
    ordre: smallint("ordre").notNull().default(0),
    /** Description JSON Schema des champs dynamiques de la catégorie. */
    schemaChamps: jsonb("schema_champs")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    /** Un relevé kilométrique est-il exigé aux états des lieux (M08) ? */
    releveKilometrique: boolean("releve_kilometrique")
      .notNull()
      .default(false),
    actif: boolean("actif").notNull().default(true),
    ...timestamps,
  },
  (table) => [uniqueIndex("categorie_slug_unique").on(table.slug)],
);

export const annonce = pgTable(
  "annonce",
  {
    id: id(),
    proprietaireId: reference("proprietaire_id")
      .notNull()
      .references(() => utilisateur.id),
    categorieId: reference("categorie_id")
      .notNull()
      .references(() => categorie.id),
    paysId: reference("pays_id")
      .notNull()
      .references(() => pays.id),

    titre: text("titre").notNull(),
    description: text("description"),
    slug: text("slug").notNull(),
    statut: statutAnnonce("statut").notNull().default("brouillon"),
    /** Étape atteinte dans l'assistant de publication en six étapes (M02). */
    etapePublication: smallint("etape_publication").notNull().default(1),

    /** Caractéristiques techniques normalisées (M02). */
    ptacKg: integer("ptac_kg"),
    poidsVideKg: integer("poids_vide_kg"),
    chargeUtileKg: integer("charge_utile_kg"),
    longueurUtileMm: integer("longueur_utile_mm"),
    largeurUtileMm: integer("largeur_utile_mm"),
    hauteurUtileMm: integer("hauteur_utile_mm"),
    freinee: boolean("freinee"),
    nombreEssieux: smallint("nombre_essieux"),
    typeAttelage: text("type_attelage"),
    faisceauBroches: integer("faisceau_broches"),
    adaptateurFourni: boolean("adaptateur_fourni").notNull().default(false),

    /** Champs propres à la catégorie, validés contre `categorie.schemaChamps`. */
    caracteristiques: jsonb("caracteristiques")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    equipements: jsonb("equipements").$type<string[]>().notNull().default([]),
    reglesUtilisation: text("regles_utilisation"),

    /**
     * Adresse de retrait. L'adresse exacte reste masquée jusqu'à la
     * confirmation de la réservation (M02) : seuls le quartier, la ville et un
     * rayon approximatif sont publics.
     */
    adresseLigne1: text("adresse_ligne1"),
    codePostal: text("code_postal"),
    ville: text("ville").notNull(),
    villeSlug: text("ville_slug").notNull(),
    position: pointGeographique("position").notNull(),
    /** Rayon d'imprécision affiché publiquement, en mètres. */
    rayonApproximatifM: integer("rayon_approximatif_m").notNull().default(800),

    /** Réservation instantanée activable annonce par annonce (M05). */
    reservationInstantanee: boolean("reservation_instantanee")
      .notNull()
      .default(false),
    politiqueAnnulation: politiqueAnnulation("politique_annulation")
      .notNull()
      .default("moderee"),
    /** Temps tampon automatique entre deux locations (M04). */
    delaiPreparationHeures: integer("delai_preparation_heures")
      .notNull()
      .default(0),
    dureeMinimumJours: smallint("duree_minimum_jours").notNull().default(1),
    dureeMaximumJours: smallint("duree_maximum_jours").notNull().default(30),

    devise: devise().notNull(),
    /** Caution demandée, encadrée par le plancher et le plafond du pays. */
    caution: montant("caution").notNull(),

    publieeLe: timestamp("publiee_le", { withTimezone: true, mode: "date" }),
    moderationMotif: text("moderation_motif"),

    ...timestamps,
  },
  (table) => [
    uniqueIndex("annonce_slug_unique").on(table.villeSlug, table.slug),
    index("annonce_proprietaire_idx").on(table.proprietaireId),
    index("annonce_statut_idx").on(table.statut),
    index("annonce_ville_idx").on(table.villeSlug),
    // Index géographique posé sur la projection `::geography`, celle-là même
    // qu'emploie ST_DWithin : un index sur la colonne `geometry` brute ne
    // serait pas utilisé. Il conditionne la performance de la recherche par
    // rayon, requête la plus fréquente du site public (M03).
    index("annonce_position_idx").using(
      "gist",
      positionGeographique("position"),
    ),
  ],
);

export const annoncePhoto = pgTable(
  "annonce_photo",
  {
    id: id(),
    annonceId: reference("annonce_id")
      .notNull()
      .references(() => annonce.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    ordre: smallint("ordre").notNull().default(0),
    largeur: integer("largeur"),
    hauteur: integer("hauteur"),
    ...timestamps,
  },
  (table) => [index("annonce_photo_annonce_idx").on(table.annonceId)],
);

/**
 * Documents du matériel : carte grise, assurance, contrôle technique.
 * Visibles de l'administration seule (M02) — jamais exposés publiquement.
 */
export const annonceDocument = pgTable(
  "annonce_document",
  {
    id: id(),
    annonceId: reference("annonce_id")
      .notNull()
      .references(() => annonce.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    url: text("url").notNull(),
    expireLe: date("expire_le"),
    ...timestamps,
  },
  (table) => [index("annonce_document_annonce_idx").on(table.annonceId)],
);

/**
 * Grille tarifaire, séparée de l'annonce afin de gérer la saisonnalité, les
 * promotions et l'historique des prix (section 09).
 */
export const tarif = pgTable(
  "tarif",
  {
    id: id(),
    annonceId: reference("annonce_id")
      .notNull()
      .references(() => annonce.id, { onDelete: "cascade" }),
    /** Période d'application ; nulle pour le tarif de base. */
    debut: date("debut"),
    fin: date("fin"),
    prixJour: montant("prix_jour").notNull(),
    prixDemiJournee: montant("prix_demi_journee"),
    prixWeekEnd: montant("prix_week_end"),
    /** Dégressivité automatique, en points de base de remise. */
    remiseSemaineBp: integer("remise_semaine_bp").notNull().default(0),
    remiseMoisBp: integer("remise_mois_bp").notNull().default(0),
    kilometresInclus: integer("kilometres_inclus"),
    prixKilometreSupplementaire: montant("prix_kilometre_supplementaire"),
    ...timestamps,
  },
  (table) => [index("tarif_annonce_idx").on(table.annonceId)],
);

/**
 * Blocages de calendrier : indisponibilités saisies par le propriétaire,
 * importées par iCal (M04) ou posées automatiquement par le délai de
 * préparation. Les réservations confirmées bloquent via la table `reservation`.
 */
export const indisponibilite = pgTable(
  "indisponibilite",
  {
    id: id(),
    annonceId: reference("annonce_id")
      .notNull()
      .references(() => annonce.id, { onDelete: "cascade" }),
    debut: timestamp("debut", { withTimezone: true, mode: "date" }).notNull(),
    fin: timestamp("fin", { withTimezone: true, mode: "date" }).notNull(),
    /** `manuel`, `ical`, `preparation`, `maintenance`. */
    origine: text("origine").notNull().default("manuel"),
    icalUid: text("ical_uid"),
    ...timestamps,
  },
  (table) => [index("indisponibilite_annonce_idx").on(table.annonceId, table.debut)],
);
