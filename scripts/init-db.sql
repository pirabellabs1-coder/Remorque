-- Extensions requises par le schéma.
-- Exécuté automatiquement à la création du volume PostgreSQL.

-- Recherche géolocalisée par rayon, en mètres sur le sphéroïde.
CREATE EXTENSION IF NOT EXISTS postgis;

-- gen_random_uuid() pour les clés primaires.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Recherche texte tolérante aux fautes de frappe (M03, phase V2).
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Suppression des accents dans les slugs de villes et de catégories.
CREATE EXTENSION IF NOT EXISTS unaccent;
