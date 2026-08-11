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

import { id, reference, timestamps } from "./_helpers";
import { pays } from "./pays";

/**
 * Rôles internes. Le double profil locataire / propriétaire n'est pas un rôle :
 * c'est une bascule d'interface sur un compte unique (section 03 — « un compte,
 * deux profils »). Forcer un second compte fait perdre une part importante de
 * l'offre potentielle.
 */
export const roleInterne = pgEnum("role_interne", [
  "agent_support",
  "moderateur",
  "gestionnaire_financier",
  "super_administrateur",
]);

export const statutVerification = pgEnum("statut_verification", [
  "non_soumis",
  "en_attente",
  "verifie",
  "refuse",
]);

export const typeCompte = pgEnum("type_compte", [
  "particulier",
  "professionnel",
]);

export const utilisateur = pgTable(
  "utilisateur",
  {
    id: id(),
    email: text("email").notNull(),
    emailVerifie: boolean("email_verifie").notNull().default(false),
    telephone: text("telephone"),
    /** Vérification par SMS : condition obligatoire pour publier ou réserver. */
    telephoneVerifie: boolean("telephone_verifie").notNull().default(false),

    prenom: text("prenom"),
    nom: text("nom"),
    photoUrl: text("photo_url"),

    /**
     * Adresse du titulaire du compte.
     *
     * Demandée à la première demande de location, pas à l'inscription : rien
     * ne la justifie tant qu'on se contente de regarder le catalogue, et un
     * formulaire d'inscription long fait fuir. Elle sert au contrat de
     * location, à la facture et à l'assurance — trois pièces qui nomment un
     * preneur et le situent.
     *
     * Le pays n'est pas répété ici : il est déjà porté par `paysId`.
     */
    adresseLigne1: text("adresse_ligne1"),
    adresseLigne2: text("adresse_ligne2"),
    codePostal: text("code_postal"),
    ville: text("ville"),

    typeCompte: typeCompte("type_compte").notNull().default("particulier"),
    paysId: reference("pays_id").references(() => pays.id),
    langue: text("langue").notNull().default("fr"),

    /** Profils activés sur le compte. */
    profilLocataire: boolean("profil_locataire").notNull().default(true),
    profilProprietaire: boolean("profil_proprietaire")
      .notNull()
      .default(false),

    /** Vérifications (M01) — conditionnent la publication et la réservation. */
    identiteStatut: statutVerification("identite_statut")
      .notNull()
      .default("non_soumis"),
    identiteVerifieeLe: timestamp("identite_verifiee_le", {
      withTimezone: true,
      mode: "date",
    }),
    permisStatut: statutVerification("permis_statut")
      .notNull()
      .default("non_soumis"),
    /** Catégories détenues : B, B96, BE (M01 — vérification du permis). */
    permisCategories: jsonb("permis_categories")
      .$type<string[]>()
      .notNull()
      .default([]),
    permisExpireLe: timestamp("permis_expire_le", {
      withTimezone: true,
      mode: "date",
    }),

    /** Rôle interne éventuel — nul pour un utilisateur ordinaire. */
    role: roleInterne("role"),

    /** Compte de reversement Stripe Connect du propriétaire (M06). */
    stripeCompteId: text("stripe_compte_id"),
    stripeCompteActif: boolean("stripe_compte_actif").notNull().default(false),
    stripeClientId: text("stripe_client_id"),

    /**
     * Identification fiscale collectée au parcours d'inscription (M21) :
     * obligation européenne DAC7, à prévoir dès le lancement et non après.
     */
    fiscaliteNumero: text("fiscalite_numero"),
    fiscalitePaysId: reference("fiscalite_pays_id").references(() => pays.id),
    tvaNumero: text("tva_numero"),
    raisonSociale: text("raison_sociale"),

    suspenduLe: timestamp("suspendu_le", { withTimezone: true, mode: "date" }),
    suspensionMotif: text("suspension_motif"),

    /** Anonymisation conforme (M01) plutôt que suppression physique. */
    anonymiseLe: timestamp("anonymise_le", {
      withTimezone: true,
      mode: "date",
    }),

    /**
     * Préférences de notification et d'affichage.
     *
     * En JSON plutôt qu'en colonnes : ces réglages s'ajoutent et disparaissent
     * au fil des fonctionnalités, et chacun vaudrait une migration. Rien de ce
     * qui s'y trouve ne conditionne un calcul métier — c'est le critère qui
     * permet de s'en remettre à un document plutôt qu'à un schéma.
     */
    preferences: jsonb("preferences")
      .$type<Record<string, boolean | string>>()
      .notNull()
      .default({}),

    ...timestamps,
  },
  (table) => [
    uniqueIndex("utilisateur_email_unique").on(table.email),
    index("utilisateur_stripe_compte_idx").on(table.stripeCompteId),
  ],
);

/**
 * Véhicule tracteur du locataire (M01).
 *
 * Section 4.3 : « le détail qui change tout ». Permet d'afficher sur chaque
 * annonce si le locataire peut légalement et physiquement tracter le matériel.
 * C'est à la fois un filtre de recherche, un argument de réassurance et une
 * protection juridique.
 */
export const vehiculeTracteur = pgTable(
  "vehicule_tracteur",
  {
    id: id(),
    utilisateurId: reference("utilisateur_id")
      .notNull()
      .references(() => utilisateur.id, { onDelete: "cascade" }),
    marque: text("marque").notNull(),
    modele: text("modele").notNull(),
    /** Plaque, pour que le loueur reconnaisse le véhicule à la remise. */
    immatriculation: text("immatriculation"),
    /** Poids total autorisé en charge du véhicule, en kilogrammes. */
    ptacKg: integer("ptac_kg").notNull(),
    /** Poids tractable freiné / non freiné, en kilogrammes. */
    tractableFreineKg: integer("tractable_freine_kg").notNull(),
    tractableNonFreineKg: integer("tractable_non_freine_kg").notNull(),
    /** Boule 50 mm, col de cygne, crochet — voir M02 « compatibilité d'attelage ». */
    typeAttelage: text("type_attelage"),
    /** Faisceau 7 ou 13 broches. */
    faisceauBroches: integer("faisceau_broches"),
    principal: boolean("principal").notNull().default(true),
    ...timestamps,
  },
  (table) => [index("vehicule_utilisateur_idx").on(table.utilisateurId)],
);

/**
 * Registre des consentements (M21) : preuve horodatée de l'acceptation des
 * conditions et de la politique de données, rattachée à une version précise
 * du document.
 */
export const consentement = pgTable(
  "consentement",
  {
    id: id(),
    utilisateurId: reference("utilisateur_id")
      .notNull()
      .references(() => utilisateur.id, { onDelete: "cascade" }),
    documentLegalId: reference("document_legal_id"),
    type: text("type").notNull(),
    accepteLe: timestamp("accepte_le", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    adresseIp: text("adresse_ip"),
    agentUtilisateur: text("agent_utilisateur"),
  },
  (table) => [index("consentement_utilisateur_idx").on(table.utilisateurId)],
);
