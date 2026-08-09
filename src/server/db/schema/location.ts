import {
  boolean,
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

import { devise, id, montant, reference, timestamps } from "./_helpers";
import { annonce } from "./annonce";
import { reservation } from "./reservation";
import { utilisateur } from "./utilisateur";

export const typeEtatDesLieux = pgEnum("type_etat_des_lieux", [
  "depart",
  "retour",
]);

/**
 * États des lieux (M08). Deux occurrences par réservation, photos horodatées
 * sous angles imposés, signatures des deux parties : c'est le dossier de preuve
 * qui sera opposé en cas de litige bancaire ou de sinistre.
 */
export const etatDesLieux = pgTable(
  "etat_des_lieux",
  {
    id: id(),
    reservationId: reference("reservation_id")
      .notNull()
      .references(() => reservation.id, { onDelete: "cascade" }),
    type: typeEtatDesLieux("type").notNull(),

    /** Réponses à la liste de contrôle guidée. */
    controles: jsonb("controles")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    kilometrage: integer("kilometrage"),
    commentaire: text("commentaire"),

    signatureLocataireUrl: text("signature_locataire_url"),
    signatureLocataireLe: timestamp("signature_locataire_le", {
      withTimezone: true,
      mode: "date",
    }),
    signatureProprietaireUrl: text("signature_proprietaire_url"),
    signatureProprietaireLe: timestamp("signature_proprietaire_le", {
      withTimezone: true,
      mode: "date",
    }),

    finaliseLe: timestamp("finalise_le", { withTimezone: true, mode: "date" }),
    pdfUrl: text("pdf_url"),

    ...timestamps,
  },
  (table) => [
    uniqueIndex("etat_des_lieux_unique").on(table.reservationId, table.type),
  ],
);

export const etatDesLieuxPhoto = pgTable(
  "etat_des_lieux_photo",
  {
    id: id(),
    etatDesLieuxId: reference("etat_des_lieux_id")
      .notNull()
      .references(() => etatDesLieux.id, { onDelete: "cascade" }),
    /** Angle imposé : `avant`, `arriere`, `gauche`, `droite`, `plancher`… */
    angle: text("angle").notNull(),
    url: text("url").notNull(),
    /** Horodatage de la prise de vue, distinct de la date d'envoi. */
    priseLe: timestamp("prise_le", { withTimezone: true, mode: "date" }),
    annotations: jsonb("annotations")
      .$type<Array<Record<string, unknown>>>()
      .notNull()
      .default([]),
    ...timestamps,
  },
  (table) => [
    index("etat_des_lieux_photo_idx").on(table.etatDesLieuxId, table.angle),
  ],
);

export const statutLitige = pgEnum("statut_litige", [
  "ouvert",
  "en_resolution_amiable",
  "en_arbitrage",
  "resolu",
  "clos_sans_suite",
]);

/**
 * Litiges (M13). L'ouverture d'un litige gèle automatiquement le transfert au
 * propriétaire et prolonge la rétention de la caution (figure 5).
 */
export const litige = pgTable(
  "litige",
  {
    id: id(),
    reservationId: reference("reservation_id")
      .notNull()
      .references(() => reservation.id),
    ouvertParId: reference("ouvert_par_id")
      .notNull()
      .references(() => utilisateur.id),
    statut: statutLitige("statut").notNull().default("ouvert"),
    motif: text("motif").notNull(),
    description: text("description"),

    devise: devise().notNull(),
    montantReclame: montant("montant_reclame"),
    montantPropose: montant("montant_propose"),
    montantAccorde: montant("montant_accorde"),

    decisionMotif: text("decision_motif"),
    arbitreId: reference("arbitre_id").references(() => utilisateur.id),
    resoluLe: timestamp("resolu_le", { withTimezone: true, mode: "date" }),

    ...timestamps,
  },
  (table) => [index("litige_reservation_idx").on(table.reservationId)],
);

export const litigePiece = pgTable(
  "litige_piece",
  {
    id: id(),
    litigeId: reference("litige_id")
      .notNull()
      .references(() => litige.id, { onDelete: "cascade" }),
    deposeParId: reference("depose_par_id")
      .notNull()
      .references(() => utilisateur.id),
    /** `photo`, `video`, `devis`, `facture`, `message`. */
    type: text("type").notNull(),
    url: text("url"),
    commentaire: text("commentaire"),
    ...timestamps,
  },
  (table) => [index("litige_piece_litige_idx").on(table.litigeId)],
);

export const statutSinistre = pgEnum("statut_sinistre", [
  "declare",
  "transmis",
  "en_cours",
  "indemnise",
  "refuse",
]);

/** Sinistres transmis au courtier partenaire (M09). */
export const sinistre = pgTable(
  "sinistre",
  {
    id: id(),
    reservationId: reference("reservation_id")
      .notNull()
      .references(() => reservation.id),
    declareParId: reference("declare_par_id")
      .notNull()
      .references(() => utilisateur.id),
    statut: statutSinistre("statut").notNull().default("declare"),
    description: text("description").notNull(),
    devise: devise().notNull(),
    montantEstime: montant("montant_estime"),
    montantIndemnise: montant("montant_indemnise"),
    referenceAssureur: text("reference_assureur"),
    /** Motif d'un refus de garantie : il sera opposé au déclarant. */
    refusMotif: text("refus_motif"),
    transmisLe: timestamp("transmis_le", { withTimezone: true, mode: "date" }),
    clotureLe: timestamp("cloture_le", { withTimezone: true, mode: "date" }),
    ...timestamps,
  },
  (table) => [index("sinistre_reservation_idx").on(table.reservationId)],
);

/**
 * Avis croisés (M12). Deux avis par réservation, publication en aveugle :
 * visibles seulement une fois les deux déposés, ou après quatorze jours.
 */
export const avis = pgTable(
  "avis",
  {
    id: id(),
    reservationId: reference("reservation_id")
      .notNull()
      .references(() => reservation.id),
    auteurId: reference("auteur_id")
      .notNull()
      .references(() => utilisateur.id),
    destinataireId: reference("destinataire_id")
      .notNull()
      .references(() => utilisateur.id),
    annonceId: reference("annonce_id").references(() => annonce.id),

    note: smallint("note").notNull(),
    /** Notes par critère : conformité, propreté, communication, ponctualité. */
    notesCriteres: jsonb("notes_criteres")
      .$type<Record<string, number>>()
      .notNull()
      .default({}),
    commentaire: text("commentaire"),

    reponse: text("reponse"),
    reponseLe: timestamp("reponse_le", { withTimezone: true, mode: "date" }),

    publieLe: timestamp("publie_le", { withTimezone: true, mode: "date" }),
    signale: boolean("signale").notNull().default(false),
    masque: boolean("masque").notNull().default(false),

    ...timestamps,
  },
  (table) => [
    uniqueIndex("avis_unique_par_auteur").on(table.reservationId, table.auteurId),
    index("avis_destinataire_idx").on(table.destinataireId),
    index("avis_annonce_idx").on(table.annonceId),
  ],
);

/**
 * Messagerie interne (M11). Les coordonnées sont masquées tant que la
 * réservation n'est pas confirmée, afin d'éviter le contournement de la
 * plateforme.
 */
export const conversation = pgTable(
  "conversation",
  {
    id: id(),
    annonceId: reference("annonce_id").references(() => annonce.id),
    reservationId: reference("reservation_id").references(() => reservation.id),
    locataireId: reference("locataire_id")
      .notNull()
      .references(() => utilisateur.id),
    proprietaireId: reference("proprietaire_id")
      .notNull()
      .references(() => utilisateur.id),
    dernierMessageLe: timestamp("dernier_message_le", {
      withTimezone: true,
      mode: "date",
    }),
    ...timestamps,
  },
  (table) => [
    index("conversation_locataire_idx").on(table.locataireId),
    index("conversation_proprietaire_idx").on(table.proprietaireId),
  ],
);

export const message = pgTable(
  "message",
  {
    id: id(),
    conversationId: reference("conversation_id")
      .notNull()
      .references(() => conversation.id, { onDelete: "cascade" }),
    auteurId: reference("auteur_id")
      .notNull()
      .references(() => utilisateur.id),
    contenu: text("contenu").notNull(),
    /** Contenu original avant masquage des coordonnées, conservé pour audit. */
    contenuOriginal: text("contenu_original"),
    coordonneesMasquees: boolean("coordonnees_masquees")
      .notNull()
      .default(false),
    luLe: timestamp("lu_le", { withTimezone: true, mode: "date" }),
    ...timestamps,
  },
  (table) => [index("message_conversation_idx").on(table.conversationId, table.creeLe)],
);
