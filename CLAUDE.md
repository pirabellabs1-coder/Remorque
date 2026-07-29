@AGENTS.md

# Remorque — plateforme européenne de location de remorques

> **Ce projet n'est pas le site vitrine Pirabel Labs.** Les consignes du
> `CLAUDE.md` parent (`C:\Users\HP\CLAUDE.md` — HTML statique, styles
> embarqués, JavaScript vanille, pas de build) ne s'appliquent **pas** ici et
> sont explicitement remplacées par le présent fichier.

Place de marché transactionnelle : des propriétaires publient du matériel, des
locataires réservent et paient en ligne, la plateforme assure le matériel,
prélève une commission et reverse le solde. Le cadrage produit de référence est
le document *« Cartographie fonctionnelle et technique — v1.0 »* (juillet 2026,
49 pages) : toute décision de périmètre s'y rapporte.

## Commandes

```bash
npm run dev          # serveur de développement
npm run build        # compilation de production
npm run typecheck    # TypeScript, sans émission
npm run lint         # ESLint
npm test             # Vitest
npm run db:generate  # génère une migration à partir du schéma
npm run db:migrate   # applique les migrations
npm run db:studio    # explorateur de base
docker compose up -d # PostgreSQL + PostGIS et Redis en local
```

## Architecture

```
src/
  app/[locale]/      pages, groupées par espace (public, compte, propriétaire, admin)
  config/            marchés, variables d'environnement validées
  domain/            logique métier pure, testable sans base ni réseau
  i18n/              routage localisé, messages, formats
  messages/          fichiers de traduction, un par marché
  server/db/         schéma Drizzle, connexion, migrations
```

- **`src/domain/` ne dépend de rien.** Machine à états, tarification, règles de
  compatibilité permis / véhicule : aucune importation de `server/`, de `app/`
  ni de bibliothèque d'accès aux données. C'est ce qui rend ces règles
  testables et vérifiables en recette.
- **Quatre espaces, un seul cœur.** Il n'y a jamais deux moteurs de réservation
  ni deux catalogues.

## Règles non négociables

1. **Aucun montant en flottant.** Tout montant est un entier de centimes et
   porte sa devise. Les taux sont en points de base (1 % = 100).
2. **Aucun taux codé en dur.** Commission, TVA, plafond de caution, délai de
   libération : tout vient de la table `pays`, pilotable depuis
   l'administration sans redéploiement.
3. **Aucune chaîne de caractères en dur dans l'interface.** Tout passe par
   `next-intl`, y compris les e-mails et les documents PDF.
4. **La réservation est une machine à états.** Toute transition passe par
   `src/domain/reservation/machine.ts`, est tracée dans
   `reservation_transition` et déclenche ses notifications. Aucun `UPDATE`
   direct sur `reservation.statut`.
5. **Journal d'audit systématique.** Toute action administrative écrit dans
   `journal_audit` avec auteur, motif, état avant et après. La table est en
   écriture seule.
6. **Gel des fonds.** Un litige ou un sinistre ouvert interdit le transfert au
   propriétaire et la libération de la caution.
7. **Multi-pays dès la première ligne.** Toute entité publiée porte son pays,
   toute entité monétaire porte sa devise. Refaire l'internationalisation après
   coup coûte trois fois le prix.
8. **Rendu serveur sur tout l'espace public.** C'est la condition du
   référencement local, qui représente 60 à 80 % du trafic attendu.
9. **Mobile d'abord.** Plus de 70 % du trafic sera mobile ; l'état des lieux se
   fait sur le terrain, parfois sans réseau.
10. **Français impeccable.** Interface, commentaires, noms de tables et de
    colonnes sont en français, accentués correctement, y compris sur les
    majuscules.

## Conventions

- Noms de code en français (tables, colonnes, fonctions du domaine), sans
  accent ni espace dans les identifiants SQL (`etat_des_lieux`, `cree_le`).
- Composants et pages : uniquement des jetons de design (`bg-accent`,
  `text-texte-attenue`) — aucune couleur écrite en dur hors `globals.css`.
- Navigation : toujours `@/i18n/navigation`, jamais `next/link` directement.
