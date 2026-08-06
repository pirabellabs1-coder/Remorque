CREATE TABLE "consentement_inscription" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"utilisateur_id" uuid NOT NULL,
	"document" text NOT NULL,
	"version" text NOT NULL,
	"accepte" boolean DEFAULT true NOT NULL,
	"adresse_ip" text,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL,
	"modifie_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "identifiant" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"utilisateur_id" uuid NOT NULL,
	"fournisseur" text NOT NULL,
	"identifiant_externe" text NOT NULL,
	"empreinte" text,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL,
	"modifie_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jeton_usage_unique" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"utilisateur_id" uuid NOT NULL,
	"usage" text NOT NULL,
	"empreinte_jeton" text NOT NULL,
	"expire_le" timestamp with time zone NOT NULL,
	"consomme_le" timestamp with time zone,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL,
	"modifie_le" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "jeton_usage_unique_empreinte_jeton_unique" UNIQUE("empreinte_jeton")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"utilisateur_id" uuid NOT NULL,
	"empreinte_jeton" text NOT NULL,
	"expire_le" timestamp with time zone NOT NULL,
	"adresse_ip" text,
	"agent_utilisateur" text,
	"revoquee_le" timestamp with time zone,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL,
	"modifie_le" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "session_empreinte_jeton_unique" UNIQUE("empreinte_jeton")
);
--> statement-breakpoint
ALTER TABLE "consentement_inscription" ADD CONSTRAINT "consentement_inscription_utilisateur_id_utilisateur_id_fk" FOREIGN KEY ("utilisateur_id") REFERENCES "public"."utilisateur"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "identifiant" ADD CONSTRAINT "identifiant_utilisateur_id_utilisateur_id_fk" FOREIGN KEY ("utilisateur_id") REFERENCES "public"."utilisateur"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jeton_usage_unique" ADD CONSTRAINT "jeton_usage_unique_utilisateur_id_utilisateur_id_fk" FOREIGN KEY ("utilisateur_id") REFERENCES "public"."utilisateur"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_utilisateur_id_utilisateur_id_fk" FOREIGN KEY ("utilisateur_id") REFERENCES "public"."utilisateur"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "consentement_inscription_idx" ON "consentement_inscription" USING btree ("utilisateur_id");--> statement-breakpoint
CREATE INDEX "identifiant_utilisateur_idx" ON "identifiant" USING btree ("utilisateur_id");--> statement-breakpoint
CREATE INDEX "identifiant_fournisseur_idx" ON "identifiant" USING btree ("fournisseur","identifiant_externe");--> statement-breakpoint
CREATE INDEX "jeton_utilisateur_idx" ON "jeton_usage_unique" USING btree ("utilisateur_id","usage");--> statement-breakpoint
CREATE INDEX "session_utilisateur_idx" ON "session" USING btree ("utilisateur_id");--> statement-breakpoint
CREATE INDEX "session_expiration_idx" ON "session" USING btree ("expire_le");