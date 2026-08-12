import { index, pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { id, reference, timestamps } from "./_helpers";
import { utilisateur } from "./utilisateur";

/**
 * Pièces déposées à l'appui d'une vérification d'identité ou de permis.
 *
 * La table `utilisateur` portait déjà le *résultat* — `identite_statut`,
 * `permis_statut` — mais rien ne portait la *preuve*. Un administrateur ne
 * pouvait donc rien contrôler : il aurait fallu qu'il fasse confiance à un
 * statut posé par personne.
 *
 * **Les octets ne sont pas ici.** Le contenu va au stockage, comme les photos
 * d'annonce ; cette table en tient la référence, le type et la décision. La
 * différence tient à la route qui les sert : `/api/fichiers` est publique et
 * met en cache pour un an, ce qui convient à la photo d'une remorque et
 * jamais à une carte d'identité. Les pièces d'un dossier passent par
 * `/api/verification/piece/[id]`, qui vérifie la session et interdit tout
 * cache partagé.
 *
 * **Rien n'est effacé au refus.** Une pièce refusée reste, avec son motif :
 * c'est la seule manière de répondre plus tard à « pourquoi mon compte a-t-il
 * été bloqué ». La purge relève de la conservation des données, pas du
 * parcours de l'utilisateur — et elle se fait par `anonymise_le`, comme le
 * reste.
 */

export const typePiece = pgEnum("type_piece", ["identite", "permis"]);

export const faceePiece = pgEnum("face_piece", ["recto", "verso"]);

export const statutPiece = pgEnum("statut_piece", [
  "en_attente",
  "acceptee",
  "refusee",
]);

export const pieceVerification = pgTable(
  "piece_verification",
  {
    id: id(),
    utilisateurId: reference("utilisateur_id")
      .notNull()
      .references(() => utilisateur.id, { onDelete: "cascade" }),

    type: typePiece("type").notNull(),
    /**
     * Recto ou verso.
     *
     * Deux faces plutôt qu'un seul fichier : le numéro et la date de fin de
     * validité sont au dos des deux documents, et un contrôleur qui ne voit
     * que la face avant ne peut pas relever la date qui rend la vérification
     * périssable.
     */
    face: faceePiece("face").notNull(),

    /** Chemin logique dans le stockage, jamais une adresse publique. */
    chemin: text("chemin").notNull(),
    typeMime: text("type_mime").notNull(),

    statut: statutPiece("statut").notNull().default("en_attente"),
    /** Motif de refus, montré tel quel à l'intéressé. */
    motif: text("motif"),

    decideLe: timestamp("decide_le", { withTimezone: true, mode: "date" }),
    decideurId: reference("decideur_id").references(() => utilisateur.id),

    ...timestamps,
  },
  (table) => [
    index("piece_verification_utilisateur_idx").on(
      table.utilisateurId,
      table.type,
    ),
    // La file de contrôle lit d'abord « tout ce qui attend, du plus ancien au
    // plus récent » : sans cet index, elle balaie la table entière à chaque
    // ouverture de l'écran d'administration.
    index("piece_verification_attente_idx").on(table.statut, table.creeLe),
  ],
);
