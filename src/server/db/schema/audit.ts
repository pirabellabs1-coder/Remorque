import {
  boolean,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { id, reference, timestamps } from "./_helpers";
import { utilisateur } from "./utilisateur";

/**
 * Journal d'audit — « non négociable » (section 4.4).
 *
 * Chaque action d'un administrateur — remboursement, débit de caution,
 * suspension d'un compte, modification d'un prix — est enregistrée avec son
 * auteur, sa date, son motif et l'état avant / après. C'est ce qui protège
 * l'entreprise en cas de contestation, de contrôle fiscal ou de litige avec un
 * assureur, et la première chose que demande un investisseur lors d'un audit.
 *
 * Table immuable, en écriture seule : aucun code applicatif ne doit proposer de
 * mise à jour ni de suppression sur cette table.
 */
export const journalAudit = pgTable(
  "journal_audit",
  {
    id: id(),
    auteurId: reference("auteur_id").references(() => utilisateur.id),
    /** Adresse e-mail figée au moment de l'action, même si le compte évolue. */
    auteurEmail: text("auteur_email"),
    /** `remboursement`, `debit_caution`, `suspension`, `modification_bareme`… */
    action: text("action").notNull(),
    /** Table et identifiant de l'entité concernée. */
    entite: text("entite").notNull(),
    entiteId: text("entite_id"),
    motif: text("motif"),
    avant: jsonb("avant").$type<Record<string, unknown> | null>(),
    apres: jsonb("apres").$type<Record<string, unknown> | null>(),
    adresseIp: text("adresse_ip"),
    creeLe: timestamp("cree_le", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("journal_audit_entite_idx").on(table.entite, table.entiteId),
    index("journal_audit_auteur_idx").on(table.auteurId, table.creeLe),
    index("journal_audit_date_idx").on(table.creeLe),
  ],
);

/**
 * Canal par lequel une demande d'assistance arrive.
 *
 * Il conditionne le délai de réponse attendu et la traçabilité : un appel
 * téléphonique ne laisse pas la même trace qu'un courriel, et l'écart de
 * traitement entre les deux canaux est un indicateur de qualité de service.
 */
export const canalSupport = pgEnum("canal_support", [
  "courriel",
  "formulaire",
  "telephone",
]);

export const prioriteSupport = pgEnum("priorite_support", [
  "basse",
  "normale",
  "haute",
]);

export const statutSupport = pgEnum("statut_support", [
  "ouvert",
  "en_cours",
  "resolu",
]);

/**
 * Demandes d'assistance.
 *
 * L'écran de support de l'administration existait avant cette table : les
 * tickets y étaient engendrés en mémoire, donc perdus au redémarrage et
 * invisibles de toute autre partie du système. Une demande d'assistance est
 * pourtant une entité de plein droit — elle a un auteur, une date d'ouverture,
 * un délai, et elle se rattache le plus souvent à une réservation précise.
 *
 * Le rattachement est facultatif : on écrit au support avant d'avoir réservé,
 * pour demander si telle remorque passe sous un porche.
 */
export const ticketSupport = pgTable(
  "ticket_support",
  {
    id: id(),
    /** Référence lisible, communiquée au demandeur. */
    reference: text("reference").notNull().unique(),
    demandeurId: reference("demandeur_id").references(() => utilisateur.id),
    /** Conservé même si le compte est supprimé : le dossier doit rester lisible. */
    demandeurEmail: text("demandeur_email"),
    reservationId: reference("reservation_id"),
    sujet: text("sujet").notNull(),
    message: text("message"),
    canal: canalSupport("canal").notNull().default("formulaire"),
    priorite: prioriteSupport("priorite").notNull().default("normale"),
    statut: statutSupport("statut").notNull().default("ouvert"),
    assigneAId: reference("assigne_a_id").references(() => utilisateur.id),
    /** Première réponse : c'est elle que mesure l'engagement de délai. */
    premiereReponseLe: timestamp("premiere_reponse_le", {
      withTimezone: true,
      mode: "date",
    }),
    resoluLe: timestamp("resolu_le", { withTimezone: true, mode: "date" }),
    ...timestamps,
  },
  (table) => [
    index("ticket_support_statut_idx").on(table.statut, table.creeLe),
    index("ticket_support_demandeur_idx").on(table.demandeurId),
  ],
);

/**
 * Fil d'une demande d'assistance.
 *
 * Le ticket porte le message d'ouverture ; l'échange qui suit vit ici. Les
 * séparer plutôt que d'empiler du texte dans une colonne est ce qui permet de
 * dater la **première réponse** — l'engagement de délai — et de savoir, à
 * chaque tour, qui a parlé en dernier.
 *
 * Le message interne est le seul qui ne parte pas au demandeur : il sert aux
 * notes de dossier, celles qu'on écrit pour le collègue qui prendra la suite.
 */
export const ticketMessage = pgTable(
  "ticket_message",
  {
    id: id(),
    ticketId: reference("ticket_id")
      .notNull()
      .references(() => ticketSupport.id, { onDelete: "cascade" }),
    auteurId: reference("auteur_id").references(() => utilisateur.id),
    /** `demandeur` ou `assistance` : la qualité au moment d'écrire. */
    auteurRole: text("auteur_role").notNull(),
    corps: text("corps").notNull(),
    /** Note de dossier, jamais montrée au demandeur. */
    interne: boolean("interne").notNull().default(false),
    ...timestamps,
  },
  (table) => [index("ticket_message_ticket_idx").on(table.ticketId, table.creeLe)],
);

/**
 * Réglages de la plateforme.
 *
 * Un magasin clé-valeur plutôt qu'une table à colonnes : ces réglages
 * s'ajoutent au fil des fonctionnalités — délai de réponse, modération a
 * priori, mode maintenance — et chacun vaudrait sinon une migration.
 *
 * Ce qui ne peut **pas** vivre ici : commission, TVA, plafond de caution,
 * délai de libération. Ceux-là sont par pays, ils entrent dans des calculs
 * monétaires, et la table `pays` les porte avec leur typage — règle 2. Un
 * taux stocké en texte finirait tôt ou tard converti à la volée, et un
 * `parseFloat` sur une commission est exactement ce que la règle 1 interdit.
 */
export const parametrePlateforme = pgTable("parametre_plateforme", {
  cle: text("cle").primaryKey(),
  valeur: text("valeur").notNull(),
  /** Qui a changé quoi : le journal d'audit garde le détail, ceci le raccourci. */
  modifiePar: text("modifie_par"),
  ...timestamps,
});
