import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { devise, id, montant, reference, timestamps } from "./_helpers";
import { reservation } from "./reservation";
import { utilisateur } from "./utilisateur";

export const statutPaiement = pgEnum("statut_paiement", [
  "en_attente",
  "autorise",
  "capture",
  "echoue",
  "rembourse_partiellement",
  "rembourse",
  "conteste",
]);

export const statutCaution = pgEnum("statut_caution", [
  "constituee",
  "retenue",
  "debitee_partiellement",
  "contestee",
  "liberee",
]);

export const statutReversement = pgEnum("statut_reversement", [
  "planifie",
  "gele",
  "envoye",
  "paye",
  "echoue",
]);

/**
 * Mouvements de paiement — y compris les échecs et les remboursements
 * partiels (section 09). La plateforme encaisse d'abord et reverse ensuite :
 * c'est ce qui rend possible le remboursement et l'arbitrage d'un litige.
 */
export const paiement = pgTable(
  "paiement",
  {
    id: id(),
    reservationId: reference("reservation_id")
      .notNull()
      .references(() => reservation.id),
    statut: statutPaiement("statut").notNull().default("en_attente"),
    devise: devise().notNull(),
    montant: montant("montant").notNull(),
    montantRembourse: montant("montant_rembourse").notNull().default(0),

    /** Références du prestataire de paiement. */
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    stripeChargeId: text("stripe_charge_id"),
    moyenPaiement: text("moyen_paiement"),

    autoriseLe: timestamp("autorise_le", { withTimezone: true, mode: "date" }),
    captureLe: timestamp("capture_le", { withTimezone: true, mode: "date" }),
    echecMotif: text("echec_motif"),

    ...timestamps,
  },
  (table) => [
    index("paiement_reservation_idx").on(table.reservationId),
    index("paiement_intent_idx").on(table.stripePaymentIntentId),
  ],
);

/**
 * Caution — empreinte bancaire et non préautorisation (M07).
 *
 * « Une préautorisation expire au bout de sept jours, ce qui ne couvre ni une
 * location longue ni le délai de constatation d'un dommage. »
 */
export const caution = pgTable(
  "caution",
  {
    id: id(),
    reservationId: reference("reservation_id")
      .notNull()
      .references(() => reservation.id),
    statut: statutCaution("statut").notNull().default("constituee"),
    devise: devise().notNull(),
    montant: montant("montant").notNull(),
    montantDebite: montant("montant_debite").notNull().default(0),

    /** Moyen de paiement enregistré, débité seulement en cas de dommage. */
    stripePaymentMethodId: text("stripe_payment_method_id"),
    stripePaymentIntentId: text("stripe_payment_intent_id"),

    /** Échéance de libération automatique, calculée par pays (72 h par défaut). */
    liberationPrevueLe: timestamp("liberation_prevue_le", {
      withTimezone: true,
      mode: "date",
    }),
    libereeLe: timestamp("liberee_le", { withTimezone: true, mode: "date" }),
    debitMotif: text("debit_motif"),
    contesteeLe: timestamp("contestee_le", {
      withTimezone: true,
      mode: "date",
    }),

    ...timestamps,
  },
  (table) => [index("caution_reservation_idx").on(table.reservationId)],
);

/**
 * Reversement au propriétaire. Un ou plusieurs virements par réservation, avec
 * retenue possible en cas de litige (section 09).
 */
export const reversement = pgTable(
  "reversement",
  {
    id: id(),
    reservationId: reference("reservation_id")
      .notNull()
      .references(() => reservation.id),
    beneficiaireId: reference("beneficiaire_id")
      .notNull()
      .references(() => utilisateur.id),
    statut: statutReversement("statut").notNull().default("planifie"),
    devise: devise().notNull(),
    montant: montant("montant").notNull(),
    commissionRetenue: montant("commission_retenue").notNull().default(0),

    stripeTransferId: text("stripe_transfer_id"),
    /** Date à laquelle le virement doit partir — 24 h après restitution. */
    prevuLe: timestamp("prevu_le", { withTimezone: true, mode: "date" }),
    envoyeLe: timestamp("envoye_le", { withTimezone: true, mode: "date" }),
    geleMotif: text("gele_motif"),

    ...timestamps,
  },
  (table) => [
    index("reversement_reservation_idx").on(table.reservationId),
    index("reversement_beneficiaire_idx").on(table.beneficiaireId),
  ],
);

/**
 * Factures et reçus (M06) : reçu locataire, facture de commission au
 * propriétaire, numérotation continue et conforme par pays.
 */
export const facture = pgTable(
  "facture",
  {
    id: id(),
    reservationId: reference("reservation_id").references(() => reservation.id),
    destinataireId: reference("destinataire_id")
      .notNull()
      .references(() => utilisateur.id),
    /** `recu_locataire`, `commission_proprietaire`, `abonnement`. */
    type: text("type").notNull(),
    numero: text("numero").notNull(),
    devise: devise().notNull(),
    montantHt: montant("montant_ht").notNull(),
    montantTva: montant("montant_tva").notNull().default(0),
    montantTtc: montant("montant_ttc").notNull(),
    tauxTvaBp: integer("taux_tva_bp").notNull().default(0),
    url: text("url"),
    lignes: jsonb("lignes")
      .$type<Array<Record<string, unknown>>>()
      .notNull()
      .default([]),
    emiseLe: timestamp("emise_le", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    ...timestamps,
  },
  (table) => [
    index("facture_destinataire_idx").on(table.destinataireId),
    index("facture_numero_idx").on(table.numero),
  ],
);
