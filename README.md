# Remorque — plateforme européenne de location de remorques

Place de marché transactionnelle : des propriétaires — particuliers comme
professionnels — publient leur matériel, des locataires réservent et paient en
ligne, la plateforme assure le matériel pendant la location, prélève une
commission et reverse le solde au propriétaire.

Le cadrage produit de référence est le document *« Cartographie fonctionnelle
et technique — v1.0 »* (Pirabel Labs, juillet 2026) : 4 espaces applicatifs,
24 modules, plus de 210 fonctionnalités réparties entre MVP, V2 et V3.

## Démarrage

```bash
cp .env.example .env.local     # puis renseigner les valeurs
docker compose up -d           # PostgreSQL + PostGIS et Redis
npm install
npm run db:migrate
npm run db:seed                # pays de lancement + catalogue des catégories
npm run dev
```

Le site est servi sur <http://localhost:3000>.

> **Sans Docker** : n'importe quelle base PostgreSQL 16+ avec les extensions
> `postgis` et `pgcrypto` convient, à condition qu'elle soit **hébergée dans
> l'Union européenne** (section 11 du cadrage — protection des données).
> Exécuter alors `scripts/init-db.sql` avant la première migration.

## Commandes

| Commande | Rôle |
| --- | --- |
| `npm run dev` | Serveur de développement |
| `npm run build` | Compilation de production |
| `npm run typecheck` | TypeScript, sans émission |
| `npm run lint` | ESLint |
| `npm test` | Tests unitaires (Vitest) |
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
| Base de données | PostgreSQL + PostGIS |
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
