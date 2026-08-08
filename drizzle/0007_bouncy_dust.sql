CREATE TABLE "favori" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"utilisateur_id" uuid NOT NULL,
	"annonce_id" uuid NOT NULL,
	"prix_jour_ajout" integer NOT NULL,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL,
	"modifie_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "favori" ADD CONSTRAINT "favori_utilisateur_id_utilisateur_id_fk" FOREIGN KEY ("utilisateur_id") REFERENCES "public"."utilisateur"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favori" ADD CONSTRAINT "favori_annonce_id_annonce_id_fk" FOREIGN KEY ("annonce_id") REFERENCES "public"."annonce"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "favori_unique" ON "favori" USING btree ("utilisateur_id","annonce_id");--> statement-breakpoint
CREATE INDEX "favori_utilisateur_idx" ON "favori" USING btree ("utilisateur_id");