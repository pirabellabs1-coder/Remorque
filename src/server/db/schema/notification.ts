import { index, jsonb, pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { id, reference, timestamps } from "./_helpers";
import { utilisateur } from "./utilisateur";

export const statutNotification = pgEnum("statut_notification", [
  "en_attente",
  "envoyee",
  "echec",
]);

/**
 * Boîte d'envoi des notifications (M12).
 *
 * La notification est **enfilée dans la même transaction** que l'événement qui
 * la fonde : une réservation acceptée sans courriel d'acceptation, ou un
 * courriel annonçant une transition qui a été annulée par un retour en
 * arrière, sont les deux mensonges que ce montage rend impossibles.
 *
 * La table ne stocke ni sujet ni corps : seulement le nom du gabarit et ses
 * données. Le texte est rendu à l'expédition, par `next-intl` (règle 3) —
 * corriger une tournure ne demande donc pas de purger une file de textes
 * déjà figés.
 */
export const notification = pgTable(
  "notification",
  {
    id: id(),
    destinataireId: reference("destinataire_id")
      .notNull()
      .references(() => utilisateur.id, { onDelete: "cascade" }),
    /** `courriel` aujourd'hui ; l'application mobile viendra s'y ranger. */
    canal: text("canal").notNull().default("courriel"),
    /** Clé de traduction sous `courriels.*`, p. ex. `reservation.acceptee`. */
    gabarit: text("gabarit").notNull(),
    donnees: jsonb("donnees")
      .$type<Record<string, string>>()
      .notNull()
      .default({}),
    statut: statutNotification("statut").notNull().default("en_attente"),
    envoyeLe: timestamp("envoye_le", { withTimezone: true, mode: "date" }),
    erreur: text("erreur"),
    ...timestamps,
  },
  (table) => [
    // L'expéditeur ne lit que la file en attente, du plus ancien au plus
    // récent : l'index épouse exactement cette requête.
    index("notification_file_idx").on(table.statut, table.creeLe),
    index("notification_destinataire_idx").on(table.destinataireId),
  ],
);
