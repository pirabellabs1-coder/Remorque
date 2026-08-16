ALTER TABLE "etat_des_lieux" ADD COLUMN "conducteur_qualite" text;--> statement-breakpoint
ALTER TABLE "etat_des_lieux" ADD COLUMN "conducteur_nom" text;--> statement-breakpoint
ALTER TABLE "etat_des_lieux" ADD COLUMN "conducteur_categories" jsonb DEFAULT '[]'::jsonb NOT NULL;