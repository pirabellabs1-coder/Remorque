# Remorque — plateforme européenne de location de remorques

Place de marché transactionnelle : des propriétaires — particuliers comme
professionnels — publient leur matériel, des locataires réservent et paient en
ligne, la plateforme assure le matériel pendant la location, prélève une
commission et reverse le solde au propriétaire.

Le cadrage produit de référence est le document *« Cartographie fonctionnelle
et technique — v1.0 »* (Pirabel Labs, juillet 2026) : 4 espaces applicatifs,
24 modules, plus de 210 fonctionnalités réparties entre MVP, V2 et V3.

## Démarrage

La base est hébergée sur **Supabase**, l'application est déployée sur
**Vercel**. Aucune installation locale n'est nécessaire.

1. Créer un projet Supabase en **région européenne** — `eu-central-1`
   (Francfort) ou `eu-west-3` (Paris). C'est une exigence de la section 11 du
   cadrage, pas une préférence.
2. Dans le tableau de bord, bouton **Connect**, relever les deux chaînes de
   connexion : celle du gestionnaire de connexions (port 6543) et la connexion
   directe (port 5432).
3. Puis :

```bash
cp .env.example .env.local     # y coller les deux chaînes de connexion
npm install
npm run db:setup               # extensions, migrations, amorçage
npm run dev
```

Le site est servi sur <http://localhost:3000>.

### Pourquoi deux chaînes de connexion

| Variable | Port | Usage |
| --- | --- | --- |
| `DATABASE_URL` | 6543 | L'application. Passe par le gestionnaire de connexions — indispensable sur Vercel, où chaque requête peut ouvrir la sienne. |
| `DATABASE_URL_DIRECT` | 5432 | Migrations et scripts d'administration. Le gestionnaire travaille en mode transaction et ne sait pas exécuter d'instruction de définition de schéma. |

Les confondre est le piège classique : l'application épuise ses connexions, ou
les migrations échouent sans message clair.

### Alternative locale

Un `docker-compose.yml` fournit PostgreSQL + PostGIS et Redis pour travailler
hors ligne : `docker compose up -d`, puis `npm run db:setup` avec
`DATABASE_URL=postgresql://remorque:remorque@localhost:5432/remorque`.
N'importe quelle base PostgreSQL 16+ avec les extensions `postgis` et
`pgcrypto` convient également.

## Commandes

| Commande | Rôle |
| --- | --- |
| `npm run dev` | Serveur de développement |
| `npm run build` | Compilation de production |
| `npm run typecheck` | TypeScript, sans émission |
| `npm run lint` | ESLint |
| `npm test` | Tests unitaires (Vitest) |
| `npm run db:setup` | Extensions, migrations et amorçage en une commande |
| `npm run db:prepare` | Installe les extensions PostgreSQL requises |
| `npm run db:generate` | Génère une migration à partir du schéma |
| `npm run db:migrate` | Applique les migrations |
| `npm run db:studio` | Explorateur de base |
| `npm run db:seed` | Amorce pays et catégories |

## Pile technique

Conforme à la section 08 du cadrage — aucun choix exotique sur un projet qui
doit pouvoir être repris par une autre équipe.

| Brique | Technologie |
| --- | --- |
| Interface et rendu serveur | Next.js 16 (App Router), TypeScript |
| Style | Tailwind CSS 4, jetons de design |
| Base de données | PostgreSQL + PostGIS (Supabase, région européenne) |
| Hébergement | Vercel |
| Accès aux données | Drizzle ORM, migrations versionnées |
| Internationalisation | next-intl, rendu serveur |
| Paiement | Stripe Connect |
| Cache et files d'attente | Redis |
| Tests | Vitest |

## Organisation du code

```
src/
  app/[locale]/      pages, un segment par marché (fr-FR, fr-BE, de-DE…)
  config/            catalogue des marchés, variables d'environnement validées
  domain/            logique métier pure — machine à états, tarification
  i18n/              routage localisé, messages, formats
  messages/          fichiers de traduction, un par marché
  server/db/         schéma Drizzle, connexion, amorçage
drizzle/             migrations générées
scripts/             initialisation de la base
```

`src/domain/` ne dépend ni de la base, ni du réseau, ni de l'interface : les
règles métier sensibles — transitions d'une réservation, décomposition
financière — sont testables isolément et servent de spécification de recette.

## État d'avancement

| Phase | Intitulé | État |
| --- | --- | --- |
| 0 | Cadrage et conception | Document de cadrage v1.0 remis ; 10 décisions en attente (section 16) |
| 1 | Socle technique | **En cours** — routage multi-marchés, jetons de design, modèle de données, machine à états |
| 2 | Annonces et recherche | À venir |
| 3 | Réservation et paiement | À venir |
| 4 | Super administration | À venir |
| 5 | Référencement et contenu | À venir |
| 6 | Recette et lancement | À venir |

## Règles non négociables

Elles sont détaillées dans [CLAUDE.md](CLAUDE.md) et s'appliquent à toute
contribution : montants entiers en centimes portant leur devise, aucun taux
codé en dur, aucune chaîne de caractères en dur dans l'interface, transitions
de réservation tracées, journal d'audit systématique, gel des fonds sur litige.
