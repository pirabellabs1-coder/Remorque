CREATE TABLE "fichier" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chemin" text NOT NULL,
	"type_mime" text NOT NULL,
	"taille" integer NOT NULL,
	"contenu" "bytea" NOT NULL,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL,
	"modifie_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "fichier_chemin_idx" ON "fichier" USING btree ("chemin");