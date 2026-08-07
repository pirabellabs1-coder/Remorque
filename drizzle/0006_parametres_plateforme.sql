CREATE TABLE "parametre_plateforme" (
	"cle" text PRIMARY KEY NOT NULL,
	"valeur" text NOT NULL,
	"modifie_par" text,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL,
	"modifie_le" timestamp with time zone DEFAULT now() NOT NULL
);
