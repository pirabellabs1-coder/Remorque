-- Extensions requises par le schéma.
--
-- Exécuté automatiquement à la création du volume PostgreSQL (Docker), ou
-- manuellement via `npm run db:prepare` sur une base hébergée (Supabase).
-- Idempotent : peut être rejoué sans risque.

-- Recherche géolocalisée par rayon, en mètres sur le sphéroïde.
-- Le schéma `public` est imposé explicitement : sur Supabase, une installation
-- dans le schéma `extensions` ne serait pas résolue par le type
-- `geometry(Point, 4326)` déclaré dans les migrations.
CREATE EXTENSION IF NOT EXISTS postgis SCHEMA public;

-- gen_random_uuid() pour les clés primaires.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Recherche texte tolérante aux fautes de frappe (M03, phase V2).
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Suppression des accents dans les slugs de villes et de catégories.
CREATE EXTENSION IF NOT EXISTS unaccent;
