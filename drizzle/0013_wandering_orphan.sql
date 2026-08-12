CREATE TYPE "public"."face_piece" AS ENUM('recto', 'verso');--> statement-breakpoint
CREATE TYPE "public"."statut_piece" AS ENUM('en_attente', 'acceptee', 'refusee');--> statement-breakpoint
CREATE TYPE "public"."type_piece" AS ENUM('identite', 'permis');--> statement-breakpoint
CREATE TABLE "piece_verification" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"utilisateur_id" uuid NOT NULL,
	"type" "type_piece" NOT NULL,
	"face" "face_piece" NOT NULL,
	"chemin" text NOT NULL,
	"type_mime" text NOT NULL,
	"statut" "statut_piece" DEFAULT 'en_attente' NOT NULL,
	"motif" text,
	"decide_le" timestamp with time zone,
	"decideur_id" uuid,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL,
	"modifie_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "piece_verification" ADD CONSTRAINT "piece_verification_utilisateur_id_utilisateur_id_fk" FOREIGN KEY ("utilisateur_id") REFERENCES "public"."utilisateur"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "piece_verification" ADD CONSTRAINT "piece_verification_decideur_id_utilisateur_id_fk" FOREIGN KEY ("decideur_id") REFERENCES "public"."utilisateur"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "piece_verification_utilisateur_idx" ON "piece_verification" USING btree ("utilisateur_id","type");--> statement-breakpoint
CREATE INDEX "piece_verification_attente_idx" ON "piece_verification" USING btree ("statut","cree_le");