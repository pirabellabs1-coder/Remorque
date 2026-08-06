import { boolean, index, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { id, reference, timestamps } from "./_helpers";
import { utilisateur } from "./utilisateur";

/**
 * Authentification.
 *
 * Trois tables, séparées de `utilisateur` à dessein. `utilisateur` porte
 * l'identité **métier** — profils, vérification, fiscalité, comptes de
 * paiement — et vit aussi longtemps que le dossier. Ce qui suit porte les
 * moyens de se connecter, qui se révoquent, se remplacent et se multiplient
 * sans que la personne change.
 *
 * Les mélanger coûterait cher au premier ajout de connexion par Google : il
 * faudrait alors soit une seconde ligne d'utilisateur pour la même personne,
 * soit des colonnes nulles à foison sur la table centrale.
 */

/**
 * Moyen de connexion rattaché à un compte.
 *
 * Une ligne par méthode : une pour le mot de passe, une par fournisseur
 * externe. Une même personne peut donc se connecter par mot de passe et par
 * Google sans que cela crée deux comptes.
 */
export const identifiant = pgTable(
  "identifiant",
  {
    id: id(),
    utilisateurId: reference("utilisateur_id")
      .notNull()
      .references(() => utilisateur.id, { onDelete: "cascade" }),
    /** `mot_de_passe`, `google`, `apple`… */
    fournisseur: text("fournisseur").notNull(),
    /**
     * Identifiant chez le fournisseur. Pour le mot de passe, c'est l'adresse
     * électronique ; pour un fournisseur externe, l'identifiant qu'il attribue.
     */
    identifiantExterne: text("identifiant_externe").notNull(),
    /**
     * Empreinte du mot de passe — jamais le mot de passe lui-même.
     *
     * Nul pour les fournisseurs externes, qui n'en confient aucun : c'est tout
     * l'intérêt de la délégation.
     */
    empreinte: text("empreinte"),
    ...timestamps,
  },
  (table) => [
    index("identifiant_utilisateur_idx").on(table.utilisateurId),
    index("identifiant_fournisseur_idx").on(
      table.fournisseur,
      table.identifiantExterne,
    ),
  ],
);

/**
 * Session ouverte.
 *
 * Le jeton est stocké haché, comme un mot de passe : une fuite de la base ne
 * doit pas permettre d'usurper les sessions en cours. Le cookie du navigateur
 * porte la valeur en clair, la base n'en garde que l'empreinte.
 */
export const session = pgTable(
  "session",
  {
    id: id(),
    utilisateurId: reference("utilisateur_id")
      .notNull()
      .references(() => utilisateur.id, { onDelete: "cascade" }),
    empreinteJeton: text("empreinte_jeton").notNull().unique(),
    expireLe: timestamp("expire_le", { withTimezone: true, mode: "date" }).notNull(),
    /** Consignés pour permettre à l'usager de reconnaître ses propres sessions. */
    adresseIp: text("adresse_ip"),
    agentUtilisateur: text("agent_utilisateur"),
    revoqueeLe: timestamp("revoquee_le", { withTimezone: true, mode: "date" }),
    ...timestamps,
  },
  (table) => [
    index("session_utilisateur_idx").on(table.utilisateurId),
    index("session_expiration_idx").on(table.expireLe),
  ],
);

/**
 * Jeton à usage unique : vérification d'adresse, réinitialisation de mot de
 * passe.
 *
 * `consommeLe` plutôt qu'une suppression : on veut pouvoir distinguer « jeton
 * inconnu » de « jeton déjà utilisé », et répondre la seconde chose à qui
 * clique deux fois sur le même lien.
 */
export const jetonUsageUnique = pgTable(
  "jeton_usage_unique",
  {
    id: id(),
    utilisateurId: reference("utilisateur_id")
      .notNull()
      .references(() => utilisateur.id, { onDelete: "cascade" }),
    /** `verification_courriel`, `reinitialisation_mot_de_passe`. */
    usage: text("usage").notNull(),
    empreinteJeton: text("empreinte_jeton").notNull().unique(),
    expireLe: timestamp("expire_le", { withTimezone: true, mode: "date" }).notNull(),
    consommeLe: timestamp("consomme_le", { withTimezone: true, mode: "date" }),
    ...timestamps,
  },
  (table) => [index("jeton_utilisateur_idx").on(table.utilisateurId, table.usage)],
);

/**
 * Registre des consentements — M21.
 *
 * L'acceptation des conditions doit être un acte explicite et horodaté, et
 * rester prouvable des années plus tard. On consigne donc la version acceptée :
 * savoir que quelqu'un a coché une case n'a aucune valeur si l'on ne sait pas
 * ce que disait le texte ce jour-là.
 */
export const consentementInscription = pgTable(
  "consentement_inscription",
  {
    id: id(),
    utilisateurId: reference("utilisateur_id")
      .notNull()
      .references(() => utilisateur.id, { onDelete: "cascade" }),
    document: text("document").notNull(),
    version: text("version").notNull(),
    accepte: boolean("accepte").notNull().default(true),
    adresseIp: text("adresse_ip"),
    ...timestamps,
  },
  (table) => [index("consentement_inscription_idx").on(table.utilisateurId)],
);
