CREATE TYPE "public"."role_interne" AS ENUM('agent_support', 'moderateur', 'gestionnaire_financier', 'super_administrateur');--> statement-breakpoint
CREATE TYPE "public"."statut_verification" AS ENUM('non_soumis', 'en_attente', 'verifie', 'refuse');--> statement-breakpoint
CREATE TYPE "public"."type_compte" AS ENUM('particulier', 'professionnel');--> statement-breakpoint
CREATE TYPE "public"."politique_annulation" AS ENUM('souple', 'moderee', 'stricte');--> statement-breakpoint
CREATE TYPE "public"."statut_annonce" AS ENUM('brouillon', 'en_moderation', 'publiee', 'refusee', 'suspendue', 'archivee');--> statement-breakpoint
CREATE TYPE "public"."mode_retrait" AS ENUM('sur_place', 'livraison_proprietaire');--> statement-breakpoint
CREATE TYPE "public"."statut_reservation" AS ENUM('demandee', 'acceptee', 'payee', 'confirmee', 'en_cours', 'restituee', 'cloturee', 'refusee', 'expiree', 'annulee');--> statement-breakpoint
CREATE TYPE "public"."statut_caution" AS ENUM('constituee', 'retenue', 'debitee_partiellement', 'contestee', 'liberee');--> statement-breakpoint
CREATE TYPE "public"."statut_paiement" AS ENUM('en_attente', 'autorise', 'capture', 'echoue', 'rembourse_partiellement', 'rembourse', 'conteste');--> statement-breakpoint
CREATE TYPE "public"."statut_reversement" AS ENUM('planifie', 'gele', 'envoye', 'paye', 'echoue');--> statement-breakpoint
CREATE TYPE "public"."statut_litige" AS ENUM('ouvert', 'en_resolution_amiable', 'en_arbitrage', 'resolu', 'clos_sans_suite');--> statement-breakpoint
CREATE TYPE "public"."statut_sinistre" AS ENUM('declare', 'transmis', 'en_cours', 'indemnise', 'refuse');--> statement-breakpoint
CREATE TYPE "public"."type_etat_des_lieux" AS ENUM('depart', 'retour');--> statement-breakpoint
CREATE TABLE "document_legal" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pays_id" uuid NOT NULL,
	"type" text NOT NULL,
	"version" text NOT NULL,
	"contenu" text NOT NULL,
	"entre_en_vigueur_le" timestamp with time zone NOT NULL,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL,
	"modifie_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pays" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" char(2) NOT NULL,
	"nom" text NOT NULL,
	"marche" text NOT NULL,
	"langue" char(2) NOT NULL,
	"devise" char(3) NOT NULL,
	"actif" boolean DEFAULT false NOT NULL,
	"ouvert_le" timestamp with time zone,
	"commission_locataire_bp" integer DEFAULT 1200 NOT NULL,
	"commission_proprietaire_bp" integer DEFAULT 800 NOT NULL,
	"tva_commission_bp" integer DEFAULT 2000 NOT NULL,
	"caution_minimum" integer DEFAULT 20000 NOT NULL,
	"caution_maximum" integer DEFAULT 150000 NOT NULL,
	"caution_liberation_heures" integer DEFAULT 72 NOT NULL,
	"assureur_nom" text,
	"assureur_reference" text,
	"mediateur_nom" text,
	"mediateur_url" text,
	"moyens_paiement" jsonb DEFAULT '["card"]'::jsonb NOT NULL,
	"parametres" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL,
	"modifie_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consentement" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"utilisateur_id" uuid NOT NULL,
	"document_legal_id" uuid,
	"type" text NOT NULL,
	"accepte_le" timestamp with time zone DEFAULT now() NOT NULL,
	"adresse_ip" text,
	"agent_utilisateur" text
);
--> statement-breakpoint
CREATE TABLE "utilisateur" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"email_verifie" boolean DEFAULT false NOT NULL,
	"telephone" text,
	"telephone_verifie" boolean DEFAULT false NOT NULL,
	"prenom" text,
	"nom" text,
	"photo_url" text,
	"type_compte" "type_compte" DEFAULT 'particulier' NOT NULL,
	"pays_id" uuid,
	"langue" text DEFAULT 'fr' NOT NULL,
	"profil_locataire" boolean DEFAULT true NOT NULL,
	"profil_proprietaire" boolean DEFAULT false NOT NULL,
	"identite_statut" "statut_verification" DEFAULT 'non_soumis' NOT NULL,
	"identite_verifiee_le" timestamp with time zone,
	"permis_statut" "statut_verification" DEFAULT 'non_soumis' NOT NULL,
	"permis_categories" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"permis_expire_le" timestamp with time zone,
	"role" "role_interne",
	"stripe_compte_id" text,
	"stripe_compte_actif" boolean DEFAULT false NOT NULL,
	"stripe_client_id" text,
	"fiscalite_numero" text,
	"fiscalite_pays_id" uuid,
	"tva_numero" text,
	"raison_sociale" text,
	"suspendu_le" timestamp with time zone,
	"suspension_motif" text,
	"anonymise_le" timestamp with time zone,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL,
	"modifie_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vehicule_tracteur" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"utilisateur_id" uuid NOT NULL,
	"marque" text NOT NULL,
	"modele" text NOT NULL,
	"ptac_kg" integer NOT NULL,
	"tractable_freine_kg" integer NOT NULL,
	"tractable_non_freine_kg" integer NOT NULL,
	"type_attelage" text,
	"faisceau_broches" integer,
	"principal" boolean DEFAULT true NOT NULL,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL,
	"modifie_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "annonce" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proprietaire_id" uuid NOT NULL,
	"categorie_id" uuid NOT NULL,
	"pays_id" uuid NOT NULL,
	"titre" text NOT NULL,
	"description" text,
	"slug" text NOT NULL,
	"statut" "statut_annonce" DEFAULT 'brouillon' NOT NULL,
	"etape_publication" smallint DEFAULT 1 NOT NULL,
	"ptac_kg" integer,
	"poids_vide_kg" integer,
	"charge_utile_kg" integer,
	"longueur_utile_mm" integer,
	"largeur_utile_mm" integer,
	"hauteur_utile_mm" integer,
	"freinee" boolean,
	"nombre_essieux" smallint,
	"type_attelage" text,
	"faisceau_broches" integer,
	"adaptateur_fourni" boolean DEFAULT false NOT NULL,
	"caracteristiques" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"equipements" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"regles_utilisation" text,
	"adresse_ligne1" text,
	"code_postal" text,
	"ville" text NOT NULL,
	"ville_slug" text NOT NULL,
	"position" geometry(Point, 4326) NOT NULL,
	"rayon_approximatif_m" integer DEFAULT 800 NOT NULL,
	"reservation_instantanee" boolean DEFAULT false NOT NULL,
	"politique_annulation" "politique_annulation" DEFAULT 'moderee' NOT NULL,
	"delai_preparation_heures" integer DEFAULT 0 NOT NULL,
	"duree_minimum_jours" smallint DEFAULT 1 NOT NULL,
	"duree_maximum_jours" smallint DEFAULT 30 NOT NULL,
	"devise" char(3) NOT NULL,
	"caution" integer NOT NULL,
	"publiee_le" timestamp with time zone,
	"moderation_motif" text,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL,
	"modifie_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "annonce_document" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"annonce_id" uuid NOT NULL,
	"type" text NOT NULL,
	"url" text NOT NULL,
	"expire_le" date,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL,
	"modifie_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "annonce_photo" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"annonce_id" uuid NOT NULL,
	"url" text NOT NULL,
	"ordre" smallint DEFAULT 0 NOT NULL,
	"largeur" integer,
	"hauteur" integer,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL,
	"modifie_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categorie" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"nom" text NOT NULL,
	"parent_id" uuid,
	"ordre" smallint DEFAULT 0 NOT NULL,
	"schema_champs" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"releve_kilometrique" boolean DEFAULT false NOT NULL,
	"actif" boolean DEFAULT true NOT NULL,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL,
	"modifie_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "indisponibilite" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"annonce_id" uuid NOT NULL,
	"debut" timestamp with time zone NOT NULL,
	"fin" timestamp with time zone NOT NULL,
	"origine" text DEFAULT 'manuel' NOT NULL,
	"ical_uid" text,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL,
	"modifie_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tarif" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"annonce_id" uuid NOT NULL,
	"debut" date,
	"fin" date,
	"prix_jour" integer NOT NULL,
	"prix_demi_journee" integer,
	"prix_week_end" integer,
	"remise_semaine_bp" integer DEFAULT 0 NOT NULL,
	"remise_mois_bp" integer DEFAULT 0 NOT NULL,
	"kilometres_inclus" integer,
	"prix_kilometre_supplementaire" integer,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL,
	"modifie_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reservation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"numero" text NOT NULL,
	"annonce_id" uuid NOT NULL,
	"locataire_id" uuid NOT NULL,
	"proprietaire_id" uuid NOT NULL,
	"pays_id" uuid NOT NULL,
	"devise" char(3) NOT NULL,
	"statut" "statut_reservation" DEFAULT 'demandee' NOT NULL,
	"debut" timestamp with time zone NOT NULL,
	"fin" timestamp with time zone NOT NULL,
	"nombre_jours" integer NOT NULL,
	"mode_retrait" "mode_retrait" DEFAULT 'sur_place' NOT NULL,
	"adresse_livraison" text,
	"loyer" integer NOT NULL,
	"frais_service" integer DEFAULT 0 NOT NULL,
	"prime_assurance" integer DEFAULT 0 NOT NULL,
	"frais_livraison" integer DEFAULT 0 NOT NULL,
	"remise" integer DEFAULT 0 NOT NULL,
	"total_locataire" integer NOT NULL,
	"commission_proprietaire" integer DEFAULT 0 NOT NULL,
	"montant_reverse" integer NOT NULL,
	"caution" integer NOT NULL,
	"baremes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"code_retrait" text,
	"expire_le" timestamp with time zone,
	"acceptee_le" timestamp with time zone,
	"payee_le" timestamp with time zone,
	"confirmee_le" timestamp with time zone,
	"retrait_le" timestamp with time zone,
	"restituee_le" timestamp with time zone,
	"cloturee_le" timestamp with time zone,
	"annulee_le" timestamp with time zone,
	"annulation_motif" text,
	"annulation_origine" text,
	"retard_constate_le" timestamp with time zone,
	"fonds_geles" boolean DEFAULT false NOT NULL,
	"contrat_url" text,
	"attestation_assurance_url" text,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL,
	"modifie_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reservation_transition" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reservation_id" uuid NOT NULL,
	"statut_precedent" "statut_reservation",
	"statut_suivant" "statut_reservation" NOT NULL,
	"acteur" text NOT NULL,
	"acteur_id" uuid,
	"motif" text,
	"contexte" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "caution" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reservation_id" uuid NOT NULL,
	"statut" "statut_caution" DEFAULT 'constituee' NOT NULL,
	"devise" char(3) NOT NULL,
	"montant" integer NOT NULL,
	"montant_debite" integer DEFAULT 0 NOT NULL,
	"stripe_payment_method_id" text,
	"stripe_payment_intent_id" text,
	"liberation_prevue_le" timestamp with time zone,
	"liberee_le" timestamp with time zone,
	"debit_motif" text,
	"contestee_le" timestamp with time zone,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL,
	"modifie_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "facture" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reservation_id" uuid,
	"destinataire_id" uuid NOT NULL,
	"type" text NOT NULL,
	"numero" text NOT NULL,
	"devise" char(3) NOT NULL,
	"montant_ht" integer NOT NULL,
	"montant_tva" integer DEFAULT 0 NOT NULL,
	"montant_ttc" integer NOT NULL,
	"taux_tva_bp" integer DEFAULT 0 NOT NULL,
	"url" text,
	"lignes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"emise_le" timestamp with time zone DEFAULT now() NOT NULL,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL,
	"modifie_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "paiement" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reservation_id" uuid NOT NULL,
	"statut" "statut_paiement" DEFAULT 'en_attente' NOT NULL,
	"devise" char(3) NOT NULL,
	"montant" integer NOT NULL,
	"montant_rembourse" integer DEFAULT 0 NOT NULL,
	"stripe_payment_intent_id" text,
	"stripe_charge_id" text,
	"moyen_paiement" text,
	"autorise_le" timestamp with time zone,
	"capture_le" timestamp with time zone,
	"echec_motif" text,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL,
	"modifie_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reversement" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reservation_id" uuid NOT NULL,
	"beneficiaire_id" uuid NOT NULL,
	"statut" "statut_reversement" DEFAULT 'planifie' NOT NULL,
	"devise" char(3) NOT NULL,
	"montant" integer NOT NULL,
	"commission_retenue" integer DEFAULT 0 NOT NULL,
	"stripe_transfer_id" text,
	"prevu_le" timestamp with time zone,
	"envoye_le" timestamp with time zone,
	"gele_motif" text,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL,
	"modifie_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "avis" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reservation_id" uuid NOT NULL,
	"auteur_id" uuid NOT NULL,
	"destinataire_id" uuid NOT NULL,
	"annonce_id" uuid,
	"note" smallint NOT NULL,
	"notes_criteres" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"commentaire" text,
	"reponse" text,
	"reponse_le" timestamp with time zone,
	"publie_le" timestamp with time zone,
	"signale" boolean DEFAULT false NOT NULL,
	"masque" boolean DEFAULT false NOT NULL,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL,
	"modifie_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"annonce_id" uuid,
	"reservation_id" uuid,
	"locataire_id" uuid NOT NULL,
	"proprietaire_id" uuid NOT NULL,
	"dernier_message_le" timestamp with time zone,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL,
	"modifie_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "etat_des_lieux" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reservation_id" uuid NOT NULL,
	"type" "type_etat_des_lieux" NOT NULL,
	"controles" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"kilometrage" integer,
	"commentaire" text,
	"signature_locataire_url" text,
	"signature_locataire_le" timestamp with time zone,
	"signature_proprietaire_url" text,
	"signature_proprietaire_le" timestamp with time zone,
	"finalise_le" timestamp with time zone,
	"pdf_url" text,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL,
	"modifie_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "etat_des_lieux_photo" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"etat_des_lieux_id" uuid NOT NULL,
	"angle" text NOT NULL,
	"url" text NOT NULL,
	"prise_le" timestamp with time zone,
	"annotations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL,
	"modifie_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "litige" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reservation_id" uuid NOT NULL,
	"ouvert_par_id" uuid NOT NULL,
	"statut" "statut_litige" DEFAULT 'ouvert' NOT NULL,
	"motif" text NOT NULL,
	"description" text,
	"devise" char(3) NOT NULL,
	"montant_reclame" integer,
	"montant_propose" integer,
	"montant_accorde" integer,
	"decision_motif" text,
	"arbitre_id" uuid,
	"resolu_le" timestamp with time zone,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL,
	"modifie_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "litige_piece" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"litige_id" uuid NOT NULL,
	"depose_par_id" uuid NOT NULL,
	"type" text NOT NULL,
	"url" text,
	"commentaire" text,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL,
	"modifie_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"auteur_id" uuid NOT NULL,
	"contenu" text NOT NULL,
	"contenu_original" text,
	"coordonnees_masquees" boolean DEFAULT false NOT NULL,
	"lu_le" timestamp with time zone,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL,
	"modifie_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sinistre" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reservation_id" uuid NOT NULL,
	"declare_par_id" uuid NOT NULL,
	"statut" "statut_sinistre" DEFAULT 'declare' NOT NULL,
	"description" text NOT NULL,
	"devise" char(3) NOT NULL,
	"montant_estime" integer,
	"montant_indemnise" integer,
	"reference_assureur" text,
	"transmis_le" timestamp with time zone,
	"cloture_le" timestamp with time zone,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL,
	"modifie_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "journal_audit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auteur_id" uuid,
	"auteur_email" text,
	"action" text NOT NULL,
	"entite" text NOT NULL,
	"entite_id" text,
	"motif" text,
	"avant" jsonb,
	"apres" jsonb,
	"adresse_ip" text,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "document_legal" ADD CONSTRAINT "document_legal_pays_id_pays_id_fk" FOREIGN KEY ("pays_id") REFERENCES "public"."pays"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consentement" ADD CONSTRAINT "consentement_utilisateur_id_utilisateur_id_fk" FOREIGN KEY ("utilisateur_id") REFERENCES "public"."utilisateur"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "utilisateur" ADD CONSTRAINT "utilisateur_pays_id_pays_id_fk" FOREIGN KEY ("pays_id") REFERENCES "public"."pays"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "utilisateur" ADD CONSTRAINT "utilisateur_fiscalite_pays_id_pays_id_fk" FOREIGN KEY ("fiscalite_pays_id") REFERENCES "public"."pays"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicule_tracteur" ADD CONSTRAINT "vehicule_tracteur_utilisateur_id_utilisateur_id_fk" FOREIGN KEY ("utilisateur_id") REFERENCES "public"."utilisateur"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "annonce" ADD CONSTRAINT "annonce_proprietaire_id_utilisateur_id_fk" FOREIGN KEY ("proprietaire_id") REFERENCES "public"."utilisateur"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "annonce" ADD CONSTRAINT "annonce_categorie_id_categorie_id_fk" FOREIGN KEY ("categorie_id") REFERENCES "public"."categorie"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "annonce" ADD CONSTRAINT "annonce_pays_id_pays_id_fk" FOREIGN KEY ("pays_id") REFERENCES "public"."pays"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "annonce_document" ADD CONSTRAINT "annonce_document_annonce_id_annonce_id_fk" FOREIGN KEY ("annonce_id") REFERENCES "public"."annonce"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "annonce_photo" ADD CONSTRAINT "annonce_photo_annonce_id_annonce_id_fk" FOREIGN KEY ("annonce_id") REFERENCES "public"."annonce"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "indisponibilite" ADD CONSTRAINT "indisponibilite_annonce_id_annonce_id_fk" FOREIGN KEY ("annonce_id") REFERENCES "public"."annonce"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tarif" ADD CONSTRAINT "tarif_annonce_id_annonce_id_fk" FOREIGN KEY ("annonce_id") REFERENCES "public"."annonce"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservation" ADD CONSTRAINT "reservation_annonce_id_annonce_id_fk" FOREIGN KEY ("annonce_id") REFERENCES "public"."annonce"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservation" ADD CONSTRAINT "reservation_locataire_id_utilisateur_id_fk" FOREIGN KEY ("locataire_id") REFERENCES "public"."utilisateur"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservation" ADD CONSTRAINT "reservation_proprietaire_id_utilisateur_id_fk" FOREIGN KEY ("proprietaire_id") REFERENCES "public"."utilisateur"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservation" ADD CONSTRAINT "reservation_pays_id_pays_id_fk" FOREIGN KEY ("pays_id") REFERENCES "public"."pays"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservation_transition" ADD CONSTRAINT "reservation_transition_reservation_id_reservation_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservation_transition" ADD CONSTRAINT "reservation_transition_acteur_id_utilisateur_id_fk" FOREIGN KEY ("acteur_id") REFERENCES "public"."utilisateur"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "caution" ADD CONSTRAINT "caution_reservation_id_reservation_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservation"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facture" ADD CONSTRAINT "facture_reservation_id_reservation_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservation"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facture" ADD CONSTRAINT "facture_destinataire_id_utilisateur_id_fk" FOREIGN KEY ("destinataire_id") REFERENCES "public"."utilisateur"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paiement" ADD CONSTRAINT "paiement_reservation_id_reservation_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservation"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reversement" ADD CONSTRAINT "reversement_reservation_id_reservation_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservation"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reversement" ADD CONSTRAINT "reversement_beneficiaire_id_utilisateur_id_fk" FOREIGN KEY ("beneficiaire_id") REFERENCES "public"."utilisateur"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "avis" ADD CONSTRAINT "avis_reservation_id_reservation_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservation"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "avis" ADD CONSTRAINT "avis_auteur_id_utilisateur_id_fk" FOREIGN KEY ("auteur_id") REFERENCES "public"."utilisateur"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "avis" ADD CONSTRAINT "avis_destinataire_id_utilisateur_id_fk" FOREIGN KEY ("destinataire_id") REFERENCES "public"."utilisateur"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "avis" ADD CONSTRAINT "avis_annonce_id_annonce_id_fk" FOREIGN KEY ("annonce_id") REFERENCES "public"."annonce"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_annonce_id_annonce_id_fk" FOREIGN KEY ("annonce_id") REFERENCES "public"."annonce"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_reservation_id_reservation_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservation"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_locataire_id_utilisateur_id_fk" FOREIGN KEY ("locataire_id") REFERENCES "public"."utilisateur"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_proprietaire_id_utilisateur_id_fk" FOREIGN KEY ("proprietaire_id") REFERENCES "public"."utilisateur"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "etat_des_lieux" ADD CONSTRAINT "etat_des_lieux_reservation_id_reservation_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "etat_des_lieux_photo" ADD CONSTRAINT "etat_des_lieux_photo_etat_des_lieux_id_etat_des_lieux_id_fk" FOREIGN KEY ("etat_des_lieux_id") REFERENCES "public"."etat_des_lieux"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "litige" ADD CONSTRAINT "litige_reservation_id_reservation_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservation"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "litige" ADD CONSTRAINT "litige_ouvert_par_id_utilisateur_id_fk" FOREIGN KEY ("ouvert_par_id") REFERENCES "public"."utilisateur"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "litige" ADD CONSTRAINT "litige_arbitre_id_utilisateur_id_fk" FOREIGN KEY ("arbitre_id") REFERENCES "public"."utilisateur"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "litige_piece" ADD CONSTRAINT "litige_piece_litige_id_litige_id_fk" FOREIGN KEY ("litige_id") REFERENCES "public"."litige"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "litige_piece" ADD CONSTRAINT "litige_piece_depose_par_id_utilisateur_id_fk" FOREIGN KEY ("depose_par_id") REFERENCES "public"."utilisateur"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message" ADD CONSTRAINT "message_conversation_id_conversation_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message" ADD CONSTRAINT "message_auteur_id_utilisateur_id_fk" FOREIGN KEY ("auteur_id") REFERENCES "public"."utilisateur"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sinistre" ADD CONSTRAINT "sinistre_reservation_id_reservation_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservation"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sinistre" ADD CONSTRAINT "sinistre_declare_par_id_utilisateur_id_fk" FOREIGN KEY ("declare_par_id") REFERENCES "public"."utilisateur"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_audit" ADD CONSTRAINT "journal_audit_auteur_id_utilisateur_id_fk" FOREIGN KEY ("auteur_id") REFERENCES "public"."utilisateur"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "document_legal_unique" ON "document_legal" USING btree ("pays_id","type","version");--> statement-breakpoint
CREATE UNIQUE INDEX "pays_code_unique" ON "pays" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "pays_marche_unique" ON "pays" USING btree ("marche");--> statement-breakpoint
CREATE INDEX "consentement_utilisateur_idx" ON "consentement" USING btree ("utilisateur_id");--> statement-breakpoint
CREATE UNIQUE INDEX "utilisateur_email_unique" ON "utilisateur" USING btree ("email");--> statement-breakpoint
CREATE INDEX "utilisateur_stripe_compte_idx" ON "utilisateur" USING btree ("stripe_compte_id");--> statement-breakpoint
CREATE INDEX "vehicule_utilisateur_idx" ON "vehicule_tracteur" USING btree ("utilisateur_id");--> statement-breakpoint
CREATE UNIQUE INDEX "annonce_slug_unique" ON "annonce" USING btree ("ville_slug","slug");--> statement-breakpoint
CREATE INDEX "annonce_proprietaire_idx" ON "annonce" USING btree ("proprietaire_id");--> statement-breakpoint
CREATE INDEX "annonce_statut_idx" ON "annonce" USING btree ("statut");--> statement-breakpoint
CREATE INDEX "annonce_ville_idx" ON "annonce" USING btree ("ville_slug");--> statement-breakpoint
CREATE INDEX "annonce_position_idx" ON "annonce" USING gist ((position::geography));--> statement-breakpoint
CREATE INDEX "annonce_document_annonce_idx" ON "annonce_document" USING btree ("annonce_id");--> statement-breakpoint
CREATE INDEX "annonce_photo_annonce_idx" ON "annonce_photo" USING btree ("annonce_id");--> statement-breakpoint
CREATE UNIQUE INDEX "categorie_slug_unique" ON "categorie" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "indisponibilite_annonce_idx" ON "indisponibilite" USING btree ("annonce_id","debut");--> statement-breakpoint
CREATE INDEX "tarif_annonce_idx" ON "tarif" USING btree ("annonce_id");--> statement-breakpoint
CREATE UNIQUE INDEX "reservation_numero_unique" ON "reservation" USING btree ("numero");--> statement-breakpoint
CREATE INDEX "reservation_annonce_idx" ON "reservation" USING btree ("annonce_id","debut");--> statement-breakpoint
CREATE INDEX "reservation_locataire_idx" ON "reservation" USING btree ("locataire_id");--> statement-breakpoint
CREATE INDEX "reservation_proprietaire_idx" ON "reservation" USING btree ("proprietaire_id");--> statement-breakpoint
CREATE INDEX "reservation_statut_idx" ON "reservation" USING btree ("statut");--> statement-breakpoint
CREATE INDEX "reservation_transition_reservation_idx" ON "reservation_transition" USING btree ("reservation_id","cree_le");--> statement-breakpoint
CREATE INDEX "caution_reservation_idx" ON "caution" USING btree ("reservation_id");--> statement-breakpoint
CREATE INDEX "facture_destinataire_idx" ON "facture" USING btree ("destinataire_id");--> statement-breakpoint
CREATE INDEX "facture_numero_idx" ON "facture" USING btree ("numero");--> statement-breakpoint
CREATE INDEX "paiement_reservation_idx" ON "paiement" USING btree ("reservation_id");--> statement-breakpoint
CREATE INDEX "paiement_intent_idx" ON "paiement" USING btree ("stripe_payment_intent_id");--> statement-breakpoint
CREATE INDEX "reversement_reservation_idx" ON "reversement" USING btree ("reservation_id");--> statement-breakpoint
CREATE INDEX "reversement_beneficiaire_idx" ON "reversement" USING btree ("beneficiaire_id");--> statement-breakpoint
CREATE UNIQUE INDEX "avis_unique_par_auteur" ON "avis" USING btree ("reservation_id","auteur_id");--> statement-breakpoint
CREATE INDEX "avis_destinataire_idx" ON "avis" USING btree ("destinataire_id");--> statement-breakpoint
CREATE INDEX "avis_annonce_idx" ON "avis" USING btree ("annonce_id");--> statement-breakpoint
CREATE INDEX "conversation_locataire_idx" ON "conversation" USING btree ("locataire_id");--> statement-breakpoint
CREATE INDEX "conversation_proprietaire_idx" ON "conversation" USING btree ("proprietaire_id");--> statement-breakpoint
CREATE UNIQUE INDEX "etat_des_lieux_unique" ON "etat_des_lieux" USING btree ("reservation_id","type");--> statement-breakpoint
CREATE INDEX "etat_des_lieux_photo_idx" ON "etat_des_lieux_photo" USING btree ("etat_des_lieux_id","angle");--> statement-breakpoint
CREATE INDEX "litige_reservation_idx" ON "litige" USING btree ("reservation_id");--> statement-breakpoint
CREATE INDEX "litige_piece_litige_idx" ON "litige_piece" USING btree ("litige_id");--> statement-breakpoint
CREATE INDEX "message_conversation_idx" ON "message" USING btree ("conversation_id","cree_le");--> statement-breakpoint
CREATE INDEX "sinistre_reservation_idx" ON "sinistre" USING btree ("reservation_id");--> statement-breakpoint
CREATE INDEX "journal_audit_entite_idx" ON "journal_audit" USING btree ("entite","entite_id");--> statement-breakpoint
CREATE INDEX "journal_audit_auteur_idx" ON "journal_audit" USING btree ("auteur_id","cree_le");--> statement-breakpoint
CREATE INDEX "journal_audit_date_idx" ON "journal_audit" USING btree ("cree_le");