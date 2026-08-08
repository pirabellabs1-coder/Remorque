CREATE TYPE "public"."statut_notification" AS ENUM('en_attente', 'envoyee', 'echec');--> statement-breakpoint
CREATE TABLE "notification" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"destinataire_id" uuid NOT NULL,
	"canal" text DEFAULT 'courriel' NOT NULL,
	"gabarit" text NOT NULL,
	"donnees" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"statut" "statut_notification" DEFAULT 'en_attente' NOT NULL,
	"envoye_le" timestamp with time zone,
	"erreur" text,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL,
	"modifie_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_destinataire_id_utilisateur_id_fk" FOREIGN KEY ("destinataire_id") REFERENCES "public"."utilisateur"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notification_file_idx" ON "notification" USING btree ("statut","cree_le");--> statement-breakpoint
CREATE INDEX "notification_destinataire_idx" ON "notification" USING btree ("destinataire_id");