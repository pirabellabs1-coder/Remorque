CREATE TABLE "ticket_message" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"auteur_id" uuid,
	"auteur_role" text NOT NULL,
	"corps" text NOT NULL,
	"interne" boolean DEFAULT false NOT NULL,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL,
	"modifie_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ticket_message" ADD CONSTRAINT "ticket_message_ticket_id_ticket_support_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."ticket_support"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_message" ADD CONSTRAINT "ticket_message_auteur_id_utilisateur_id_fk" FOREIGN KEY ("auteur_id") REFERENCES "public"."utilisateur"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ticket_message_ticket_idx" ON "ticket_message" USING btree ("ticket_id","cree_le");