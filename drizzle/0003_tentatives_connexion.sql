CREATE TABLE "tentative_connexion" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"courriel" text NOT NULL,
	"adresse_ip" text,
	"reussie" boolean DEFAULT false NOT NULL,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "tentative_courriel_idx" ON "tentative_connexion" USING btree ("courriel","cree_le");--> statement-breakpoint
CREATE INDEX "tentative_ip_idx" ON "tentative_connexion" USING btree ("adresse_ip","cree_le");