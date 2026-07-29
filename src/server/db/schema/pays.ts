import {
  boolean,
  char,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { devise, id, reference, timestamps } from "./_helpers";

/**
 * Configuration d'un pays ouvert.
 *
 * Section 05 : « une commission codée en dur dans l'application est une erreur
 * classique qui bloque toute expérimentation commerciale ». Tous les taux sont
 * donc en base et pilotés depuis l'espace super administrateur.
 */
export const pays = pgTable(
  "pays",
  {
    id: id(),
    /** ISO 3166-1 alpha-2. */
    code: char("code", { length: 2 }).notNull(),
    nom: text("nom").notNull(),
    /** Identifiant de marché (`fr-FR`) utilisé par le routage. */
    marche: text("marche").notNull(),
    langue: char("langue", { length: 2 }).notNull(),
    devise: devise().notNull(),

    actif: boolean("actif").notNull().default(false),
    ouvertLe: timestamp("ouvert_le", { withTimezone: true, mode: "date" }),

    /** Barèmes exprimés en points de base (1 % = 100). */
    commissionLocataireBp: integer("commission_locataire_bp")
      .notNull()
      .default(1200),
    commissionProprietaireBp: integer("commission_proprietaire_bp")
      .notNull()
      .default(800),
    tvaCommissionBp: integer("tva_commission_bp").notNull().default(2000),

    /** Encadrement de la caution fixée par le propriétaire (en centimes). */
    cautionMinimum: integer("caution_minimum").notNull().default(20000),
    cautionMaximum: integer("caution_maximum").notNull().default(150000),
    /** Délai de libération de la caution après restitution sans incident. */
    cautionLiberationHeures: integer("caution_liberation_heures")
      .notNull()
      .default(72),

    /** Partenaire d'assurance — un contrat et des garanties par pays (M09). */
    assureurNom: text("assureur_nom"),
    assureurReference: text("assureur_reference"),

    /** Organisme de médiation de la consommation, obligatoire (M13). */
    mediateurNom: text("mediateur_nom"),
    mediateurUrl: text("mediateur_url"),

    /**
     * Moyens de paiement activés et surcharges de configuration propres au
     * pays. Volontairement souple : ces réglages évoluent sans migration.
     */
    moyensPaiement: jsonb("moyens_paiement")
      .$type<string[]>()
      .notNull()
      .default(["card"]),
    parametres: jsonb("parametres")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),

    ...timestamps,
  },
  (table) => [
    uniqueIndex("pays_code_unique").on(table.code),
    uniqueIndex("pays_marche_unique").on(table.marche),
  ],
);

/**
 * Documents légaux versionnés (M20) : une version des conditions par pays et
 * par date, avec preuve d'acceptation côté utilisateur.
 */
export const documentLegal = pgTable(
  "document_legal",
  {
    id: id(),
    paysId: reference("pays_id")
      .notNull()
      .references(() => pays.id),
    /** `cgu`, `cgv`, `confidentialite`, `cookies`, `contrat-location`. */
    type: text("type").notNull(),
    version: text("version").notNull(),
    contenu: text("contenu").notNull(),
    entreEnVigueurLe: timestamp("entre_en_vigueur_le", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("document_legal_unique").on(
      table.paysId,
      table.type,
      table.version,
    ),
  ],
);
