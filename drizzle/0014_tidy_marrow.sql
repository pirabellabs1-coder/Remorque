CREATE TYPE "public"."type_media_constat" AS ENUM('photo', 'video');--> statement-breakpoint
ALTER TABLE "etat_des_lieux_photo" ADD COLUMN "media" "type_media_constat" DEFAULT 'photo' NOT NULL;--> statement-breakpoint
ALTER TABLE "etat_des_lieux_photo" ADD COLUMN "type_mime" text;