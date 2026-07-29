import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { id, reference } from "./_helpers";
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
