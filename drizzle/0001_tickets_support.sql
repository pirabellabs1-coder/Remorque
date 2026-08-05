CREATE TYPE "public"."canal_support" AS ENUM('courriel', 'formulaire', 'telephone');--> statement-breakpoint
CREATE TYPE "public"."priorite_support" AS ENUM('basse', 'normale', 'haute');--> statement-breakpoint
CREATE TYPE "public"."statut_support" AS ENUM('ouvert', 'en_cours', 'resolu');--> statement-breakpoint
CREATE TABLE "ticket_support" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" text NOT NULL,
	"demandeur_id" uuid,
	"demandeur_email" text,
	"reservation_id" uuid,
	"sujet" text NOT NULL,
	"message" text,
	"canal" "canal_support" DEFAULT 'formulaire' NOT NULL,
	"priorite" "priorite_support" DEFAULT 'normale' NOT NULL,
	"statut" "statut_support" DEFAULT 'ouvert' NOT NULL,
	"assigne_a_id" uuid,
	"premiere_reponse_le" timestamp with time zone,
	"resolu_le" timestamp with time zone,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL,
	"modifie_le" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ticket_support_reference_unique" UNIQUE("reference")
);
--> statement-breakpoint
ALTER TABLE "ticket_support" ADD CONSTRAINT "ticket_support_demandeur_id_utilisateur_id_fk" FOREIGN KEY ("demandeur_id") REFERENCES "public"."utilisateur"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_support" ADD CONSTRAINT "ticket_support_assigne_a_id_utilisateur_id_fk" FOREIGN KEY ("assigne_a_id") REFERENCES "public"."utilisateur"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ticket_support_statut_idx" ON "ticket_support" USING btree ("statut","cree_le");--> statement-breakpoint
CREATE INDEX "ticket_support_demandeur_idx" ON "ticket_support" USING btree ("demandeur_id");