import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { devise, id, montant, reference, timestamps } from "./_helpers";
import { annonce } from "./annonce";
import { pays } from "./pays";
import { utilisateur } from "./utilisateur";

/**
 * États d'une réservation — figure 4 du cadrage.
 *
 * « Une réservation est une machine à états, pas une simple ligne dans un
 * tableau. » Les transitions autorisées sont décrites côté domaine dans
 * `src/domain/reservation/machine.ts` ; la base ne fait que stocker l'état
 * courant et l'historique complet des transitions.
 */
export const statutReservation = pgEnum("statut_reservation", [
  "demandee",
  "acceptee",
  "payee",
  "confirmee",
  "en_cours",
  "restituee",
  "cloturee",
  // États terminaux d'exception.
  "refusee",
  "expiree",
  "annulee",
]);

export const modeRetrait = pgEnum("mode_retrait", [
  "sur_place",
  "livraison_proprietaire",
]);

export const reservation = pgTable(
  "reservation",
  {
    id: id(),
    /** Référence lisible communiquée à l'utilisateur et portée par les PDF. */
    numero: text("numero").notNull(),

    annonceId: reference("annonce_id")
      .notNull()
      .references(() => annonce.id),
    locataireId: reference("locataire_id")
      .notNull()
      .references(() => utilisateur.id),
    proprietaireId: reference("proprietaire_id")
      .notNull()
      .references(() => utilisateur.id),
    /** Rattachement au pays et à la devise, figés à la confirmation. */
    paysId: reference("pays_id")
      .notNull()
      .references(() => pays.id),
    devise: devise().notNull(),

    statut: statutReservation("statut").notNull().default("demandee"),

    debut: timestamp("debut", { withTimezone: true, mode: "date" }).notNull(),
    fin: timestamp("fin", { withTimezone: true, mode: "date" }).notNull(),
    nombreJours: integer("nombre_jours").notNull(),

    modeRetrait: modeRetrait("mode_retrait").notNull().default("sur_place"),
    adresseLivraison: text("adresse_livraison"),

    /**
     * Montants figés à la confirmation (section 09) : une modification
     * ultérieure d'un barème ne doit jamais altérer une réservation existante.
     * Tous en centimes, dans la devise ci-dessus.
     */
    loyer: montant("loyer").notNull(),
    fraisService: montant("frais_service").notNull().default(0),
    primeAssurance: montant("prime_assurance").notNull().default(0),
    fraisLivraison: montant("frais_livraison").notNull().default(0),
    remise: montant("remise").notNull().default(0),
    totalLocataire: montant("total_locataire").notNull(),
    commissionProprietaire: montant("commission_proprietaire")
      .notNull()
      .default(0),
    montantReverse: montant("montant_reverse").notNull(),
    caution: montant("caution").notNull(),

    /** Barèmes appliqués, conservés pour l'audit et le rapprochement. */
    baremes: jsonb("baremes")
      .$type<Record<string, number>>()
      .notNull()
      .default({}),

    /** Code à quatre chiffres échangé à la remise du matériel (M05). */
    codeRetrait: text("code_retrait"),

    /** Délai laissé au propriétaire pour accepter ou refuser (24 h). */
    expireLe: timestamp("expire_le", { withTimezone: true, mode: "date" }),
    accepteeLe: timestamp("acceptee_le", { withTimezone: true, mode: "date" }),
    payeeLe: timestamp("payee_le", { withTimezone: true, mode: "date" }),
    confirmeeLe: timestamp("confirmee_le", {
      withTimezone: true,
      mode: "date",
    }),
    retraitLe: timestamp("retrait_le", { withTimezone: true, mode: "date" }),
    restitueeLe: timestamp("restituee_le", {
      withTimezone: true,
      mode: "date",
    }),
    clotureeLe: timestamp("cloturee_le", { withTimezone: true, mode: "date" }),
    annuleeLe: timestamp("annulee_le", { withTimezone: true, mode: "date" }),
    annulationMotif: text("annulation_motif"),
    /** `locataire`, `proprietaire`, `plateforme`. */
    annulationOrigine: text("annulation_origine"),
    retardConstateLe: timestamp("retard_constate_le", {
      withTimezone: true,
      mode: "date",
    }),

    /**
     * Gel des fonds (M13) : tant qu'un litige ou un sinistre reste ouvert,
     * aucun transfert au propriétaire ni libération de caution.
     */
    fondsGeles: boolean("fonds_geles").notNull().default(false),

    contratUrl: text("contrat_url"),
    attestationAssuranceUrl: text("attestation_assurance_url"),

    ...timestamps,
  },
  (table) => [
    uniqueIndex("reservation_numero_unique").on(table.numero),
    index("reservation_annonce_idx").on(table.annonceId, table.debut),
    index("reservation_locataire_idx").on(table.locataireId),
    index("reservation_proprietaire_idx").on(table.proprietaireId),
    index("reservation_statut_idx").on(table.statut),
  ],
);

/**
 * Historique des transitions.
 *
 * Table en écriture seule : chaque changement d'état est enregistré avec son
 * auteur, son motif et l'état précédent. C'est ce qui permet de reconstituer
 * une location contestée et de justifier une décision auprès d'un assureur.
 */
export const reservationTransition = pgTable(
  "reservation_transition",
  {
    id: id(),
    reservationId: reference("reservation_id")
      .notNull()
      .references(() => reservation.id, { onDelete: "cascade" }),
    statutPrecedent: statutReservation("statut_precedent"),
    statutSuivant: statutReservation("statut_suivant").notNull(),
    /** `locataire`, `proprietaire`, `systeme`, `administrateur`. */
    acteur: text("acteur").notNull(),
    acteurId: reference("acteur_id").references(() => utilisateur.id),
    motif: text("motif"),
    contexte: jsonb("contexte")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    creeLe: timestamp("cree_le", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("reservation_transition_reservation_idx").on(
      table.reservationId,
      table.creeLe,
    ),
  ],
);
