# Recette du paiement Stripe

Protocole à dérouler avant toute mise en service du règlement en ligne.

Le code du paiement a été écrit et typé, ses règles de montants sont couvertes
par des tests unitaires, mais **il n'a jamais vu un vrai paiement** : aucune clé
Stripe n'était configurée sur le poste de développement. Ce document est ce qui
manque entre « cela compile » et « cela encaisse ».

## Ce que cette recette prouve — et ce qu'elle ne prouve pas

Elle prouve que le chemin nominal fonctionne de bout en bout, que les chemins
d'échec ne laissent pas d'écriture douteuse, et qu'un événement rejoué ou forgé
ne déplace rien.

Elle ne prouve rien sur le reversement au propriétaire (Stripe Connect), le
débit d'une caution après dommage, ni la facture : ces trois-là ne sont pas
écrits. Voir « Hors périmètre » en fin de document.

## 1. Prérequis

- Un compte Stripe en **mode test**. Aucune clé de production ne doit approcher
  un poste de développement.
- L'interface en ligne de commande Stripe (`stripe`), authentifiée par
  `stripe login`.
- La base de démonstration amorcée : `npm run db:demo`.

## 2. Configuration

Dans `.env.local` :

```
STRIPE_SECRET_KEY=sk_test_…
STRIPE_WEBHOOK_SECRET=whsec_…
```

La clé secrète vient du tableau de bord Stripe (Développeurs → Clés d'API). Le
secret du point d'entrée est **rendu par `stripe listen`** à l'étape suivante :
celui du tableau de bord ne vaut que pour un point d'entrée déclaré sur une
adresse publique.

Vérification préalable, sans clé encore renseignée — c'est le comportement de
repli, et il doit être constaté avant d'être remplacé :

| Vérification | Attendu |
|---|---|
| Bouton « Régler la location » cliqué | « Le paiement en ligne n'est pas encore ouvert sur cette installation. » |
| `POST /api/stripe/webhook` | **503**, aucune écriture |

## 3. Tunnel des événements

Dans un terminal séparé, laissé ouvert pendant toute la recette :

```bash
stripe listen --forward-to http://localhost:3000/api/stripe/webhook
```

Reporter le `whsec_…` affiché dans `.env.local`, puis **redémarrer le serveur de
développement** — les variables d'environnement ne sont lues qu'au démarrage.

Le port doit correspondre à celui du serveur (`npm run dev` affiche le sien ; il
n'est pas toujours 3000 si le port est occupé).

## 4. Mise en situation

Le règlement n'est proposé que sur une réservation **acceptée**. Se connecter en
loueur (`yanis@demonstration.flexitrailer.eu`, mot de passe
`Demonstration2026!`), écran « Réservations », puis « Accepter » sur une demande
du compte locataire de démonstration.

À défaut, en base :

```sql
UPDATE reservation SET statut = 'acceptee', acceptee_le = now()
WHERE numero = 'FT-2026-XXXX';
```

Noter l'identifiant de la réservation : toutes les vérifications s'y réfèrent.

## 5. Scénarios

Cartes de test Stripe — toutes avec une date future et n'importe quel
cryptogramme.

### S1 — Règlement nominal

Carte `4242 4242 4242 4242`.

1. Se connecter en locataire (`moi@demonstration.flexitrailer.eu`).
2. Écran « Réservations » → « Régler la location ».
3. Payer sur la page Stripe.

| Vérification | Attendu |
|---|---|
| Redirection | `/compte/reservations?paiement=succes`, bandeau « Paiement reçu. Votre réservation est en cours de confirmation. » |
| Terminal `stripe listen` | `checkout.session.completed` → `[200]` |
| `reservation.statut` | `payee` |
| Ligne `paiement` | une seule, `statut = 'capture'`, `montant` = `reservation.total_locataire`, `stripe_payment_intent_id` renseigné |
| Ligne `caution` | créée, `statut = 'constituee'`, `stripe_payment_method_id` **renseigné** |
| `reservation_transition` | une ligne `acceptee → payee`, `acteur = 'systeme'`, motif citant l'intention |
| Notification | une ligne `gabarit = 'reservation.payee'` pour le propriétaire |

```sql
SELECT r.statut,
       p.statut  AS paiement, p.montant, p.stripe_payment_intent_id,
       c.statut  AS caution,  c.stripe_payment_method_id
FROM reservation r
LEFT JOIN paiement p ON p.reservation_id = r.id
LEFT JOIN caution  c ON c.reservation_id = r.id
WHERE r.id = '<identifiant>';
```

Le moyen de paiement enregistré sur la caution est le point le plus important
de cette recette : **sans lui, la garantie de caution est un mot** — rien ne
pourrait être débité en cas de dommage.

Vérifier enfin le courriel enfilé :

```bash
npm run courriels
```

### S2 — Abandon

Ouvrir le paiement, puis revenir en arrière sans payer.

| Vérification | Attendu |
|---|---|
| Redirection | `?paiement=abandon`, message neutre |
| `reservation.statut` | reste `acceptee` |
| Lignes `paiement` / `caution` | **aucune** |

### S3 — Authentification forte (3-D Secure)

Carte `4000 0025 0000 3155`, puis valider l'authentification.

Attendu : identique à S1. Une authentification refusée doit se comporter comme
S4.

### S4 — Carte refusée

Carte `4000 0000 0000 0002`.

| Vérification | Attendu |
|---|---|
| Page Stripe | refus affiché, l'usager reste sur place |
| `reservation.statut` | reste `acceptee` |
| Lignes `paiement` / `caution` | **aucune** |

Le point à surveiller : aucun `checkout.session.completed` ne doit être reçu.
Un refus n'est pas un paiement.

### S5 — Rejeu d'événement (idempotence)

Stripe rejoue les événements qu'il croit perdus, parfois des jours plus tard.

```bash
stripe events list --limit 5
stripe events resend <evt_…>
```

| Vérification | Attendu |
|---|---|
| Réponse | `[200]` |
| Lignes `paiement` | **toujours une seule** |
| `reservation_transition` | **aucune nouvelle ligne** |

```sql
SELECT count(*) FROM paiement WHERE reservation_id = '<identifiant>';
```

C'est le scénario le plus facile à négliger et le plus coûteux à découvrir en
production : un double comptage fausse la comptabilité et le reversement.

### S6 — Signature invalide

```bash
curl -i -X POST http://localhost:3000/api/stripe/webhook \
  -H "Content-Type: application/json" \
  -H "stripe-signature: t=1,v1=faux" \
  -d '{"type":"checkout.session.completed","data":{"object":{"metadata":{"reservationId":"<identifiant>"}}}}'
```

| Vérification | Attendu |
|---|---|
| Réponse | **400** |
| Base | strictement inchangée |

Le même appel sans en-tête `stripe-signature` doit également répondre 400. Sans
cette garde, n'importe qui déclarerait un paiement qui n'a pas eu lieu.

### S7 — Statut incompatible

Depuis une réservation `demandee`, `payee` ou `cloturee`, appeler l'action de
règlement (le bouton n'est pas affiché — le forcer depuis la console).

Attendu : refus `statutIncompatible`, aucune session créée.

### S8 — Dossier d'autrui

Se connecter en locataire A, appeler le règlement avec l'identifiant d'une
réservation du locataire B.

Attendu : refus `interdit`. La garde est dans la clause SQL : le dossier n'est
pas même rapporté du serveur.

### S9 — Montants incohérents

Introduire volontairement un écart, puis tenter le règlement :

```sql
UPDATE reservation SET frais_livraison = 500 WHERE id = '<identifiant>';
```

| Vérification | Attendu |
|---|---|
| Message | « Le détail des montants ne correspond pas au total de la réservation. Contactez-nous avant de régler. » |
| Session Stripe | **aucune** |

Rétablir ensuite (`frais_livraison = 0`). Ce refus est délibéré : mieux vaut ne
rien encaisser qu'encaisser une somme que le locataire n'a pas acceptée.

### S10 — Double clic

Cliquer deux fois de suite sur « Régler la location ».

Attendu : une seule session ouverte — la clé d'idempotence est
`reglement-<identifiant de réservation>`.

## 6. Confirmation, code de retrait et reçu

La confirmation s'enchaîne au paiement, dans le même événement. Après S1 :

| Vérification | Attendu |
|---|---|
| `reservation.statut` | `confirmee` |
| `reservation.code_retrait` | quatre chiffres, zéros de tête compris (`0042` est valide) |
| `reservation.contrat_url` / `attestation_assurance_url` | adresses `/api/documents/…` |
| Ligne `facture` | une seule, `type = 'recu_locataire'`, numéro `FA-<année>-00001` |
| Écran locataire | le code s'affiche sous la référence |
| Écran loueur | le même code, colonne « Statut » |
| Documents proposés | contrat, attestation **et reçu** côté locataire ; sans le reçu côté loueur |

```sql
SELECT r.statut, r.code_retrait, f.numero, f.montant_ht, f.montant_tva, f.montant_ttc
FROM reservation r LEFT JOIN facture f ON f.reservation_id = r.id
WHERE r.id = '<identifiant>';
```

Contrôle fiscal du reçu : `montant_ht + montant_tva = montant_ttc`, et la taxe
ne porte **que sur les frais de service** — le loyer est perçu par un
particulier. Avec 70,00 € de loyer et 8,40 € de frais à 20 % : 1,40 € de taxe,
et non 13,07 €.

Le code de retrait ne part par aucun courriel : il s'échange de vive voix devant
le matériel. Vérifier qu'il n'apparaît pas dans `npm run courriels`.

## 6 bis. Réservation instantanée

Sur une annonce en réservation instantanée, la demande s'accepte d'elle-même,
au nom du propriétaire — c'est son consentement permanent, donné en publiant
l'annonce, qui s'exerce.

| Vérification | Attendu |
|---|---|
| `reservation.statut` juste après la demande | `acceptee` |
| `reservation_transition` | deux lignes : `→ demandee` (locataire) puis `demandee → acceptee` (proprietaire, motif « Réservation instantanée ») |
| Notifications | `reservation.acceptee` au locataire, `reservation.instantanee` au propriétaire, **aucune** `reservation.demandee` |
| Écran locataire | « Régler la location » immédiatement disponible |

## 6 ter. Décision d'arbitrage et effets financiers

La décision emporte son effet dans la même transaction, selon qui a ouvert :

| Cas | Attendu |
|---|---|
| Litige ouvert par le **propriétaire**, décision X | `caution.montant_debite` += X, statut `debitee_partiellement` (ou `retenue` si tout), `debit_motif` = motif de la décision |
| Litige ouvert par le **locataire**, décision X | `reversement.montant` −= X (si encore `planifie`/`gele`) **et** `paiement.montant_rembourse` += X — l'argent retranché revient au gagnant ; ligne « remboursement » sur le relevé du locataire ; la caution du locataire **jamais** touchée |
| Décision à zéro | aucun effet financier, dégel seul |
| Reversement déjà parti | rien n'est réduit, rien n'est remboursé ; `resteARecouvrer` au journal d'audit |
| Journal d'audit | `retenueCaution` / `reductionReversement` / `remboursementLocataire` / `resteARecouvrer` inscrits dans `apres` |
| Compte administrateur qui tente d'**ouvrir** un litige | refusé (`interdit`) — les parties réclament, la plateforme arbitre ; un dossier ouvert par elle n'aurait pas de direction financière |

Avec une clé Stripe, la décision s'exécute juste après la transaction qui la
rend : débit hors session de la caution (mêmes garde-fous que le débit manuel)
et remboursement du paiement d'origine, chacun inscrit au journal d'audit sous
« Litige — exécution bancaire », y compris en cas de refus de carte. Sans clé,
la décision reste un fait comptable : `caution.stripe_payment_intent_id` vide
et aucune entrée d'exécution — c'est le marqueur honnête de ce qui n'est pas
encore exécuté.

## 6 ter 0. Annulation — le barème rend l'argent

L'annulation d'une location encaissée applique la politique de l'annonce,
celle que les conditions générales promettent, dans la transaction même de la
transition :

| Cas | Attendu |
|---|---|
| Locataire annule, **souple**, ≥ 24 h avant | loyer rendu à 100 % ; frais de service conservés ; assurance et livraison rendues |
| Locataire annule, **modérée**, < 3 jours | loyer rendu de moitié |
| Locataire annule, **stricte**, < 7 jours | loyer conservé en entier ; seules assurance et livraison reviennent |
| **Propriétaire** (ou plateforme) annule | tout est rendu, frais de service compris, quel que soit le délai |
| `paiement.montant_rembourse` | += le total rendu, statut `rembourse` / `rembourse_partiellement` ; ligne « remboursement » sur le relevé |
| `reversement.montant` | recalculé au prorata du loyer conservé — zéro si tout revient au locataire (soldé « payé » sans virement) |
| Caution | libérée (comportement existant) |
| Avec clé Stripe | `refunds.create` sur le paiement d'origine, idempotence `annulation-<réservation>-<montant>` |
| Charge déjà entamée (litige tranché avant l'annulation) | le cumul s'arrête au montant payé, et ce qui part à la banque est le **delta** réellement écrit — pas le total du barème, que Stripe rejetterait comme supérieur au restant remboursable |
| Demande jamais payée (refus, expiration, annulation avant paiement) | **aucun mouvement** : ni caution ni reversement n'existent — les deux naissent au passage à « payée » |
| Ouverture d'un litige avant le retrait | refusée (`statutInadapte`) — comme le sinistre : sans matériel parti ni argent encaissé, il n'y a rien à contester ni à geler |

## 6 ter bis. Sinistres — déclaration, instruction, dégel croisé

Le sinistre se déclare par les parties (location `en_cours`, `restituee` ou
`cloturee` uniquement — et jamais par l'administration, qui transmet sans
avoir rien constaté), s'instruit par l'administration, et se conclut par
l'assureur.

| Vérification | Attendu |
|---|---|
| Déclaration (description + estimation) | `sinistre.statut = 'declare'`, gel posé : `fonds_geles`, caution `contestee`, reversement `gele` ; `sinistre.declare` aux deux parties |
| Transmission (admin, référence obligatoire) | `transmis`, `reference_assureur` et `transmis_le` remplis, journal d'audit |
| Instruction ouverte | `en_cours` — le statut n'est plus masqué en « transmis » sur la page assurance |
| Indemnisation (montant obligatoire) | `indemnise`, `montant_indemnise`, `cloture_le`, dégel |
| Refus (motif obligatoire) | `refuse`, `refus_motif` lisible par les parties, dégel |
| **Dégel croisé** | un litige classé ne dégèle **pas** si un sinistre court sur la même location, et réciproquement — la levée se constate en base (`leverGelSiPlusRienOuvert`), elle ne se décrète pas |
| Second sinistre pendant le premier | refusé (`dejaDeclare`) |
| Écrans | les trois espaces lisent le même dossier ; seules les actions diffèrent (instruction : administration seule) |

## 6 quinquies. Assistance — la demande s'ouvre, se répond et se clôt

La page de contact publique reste **sans formulaire**, délibérément. La
demande d'assistance s'ouvre depuis le compte, où l'usager a une identité, un
historique et une location à rattacher.

| Vérification | Attendu |
|---|---|
| Ouverture (`/compte/assistance`) | `ticket_support` en `ouvert`, référence `AS-<année>-0001`, message d'ouverture **aussi** dans `ticket_message` ; `support.ouverte` au demandeur |
| Rattachement à la location d'autrui | refusé (`locationInconnue`) |
| Prise en charge (assistance) | `en_cours`, `assigne_a_id` renseigné, journal d'audit |
| Réponse | `en_cours` même depuis `ouvert` — répondre vaut prise en charge, sans quoi l'indicateur daterait une réponse sur un dossier « en attente » ; `premiere_reponse_le` figé au premier envoi seulement ; `support.reponse` au demandeur |
| **Note interne** | reste dans le fil de l'assistance, ne part pas au demandeur, **ne date pas** la première réponse et ne suffit donc pas à autoriser la clôture |
| Clôture sans aucune réponse | refusée — c'est la règle qui justifie le module : un dossier clos que personne n'a lu sort des indicateurs en annonçant un traitement qui n'a pas eu lieu |
| Clôture après réponse | `resolu`, `resolu_le`, `support.resolue` au demandeur |
| Demandeur | relance tant que le dossier vit, retire tant que personne ne s'en est saisi ; ne prend ni ne clôt jamais |
| Agent qui a écrit pour son propre compte | traité en demandeur — il n'instruit pas sa propre demande |
| Retard | signalé tant que la première réponse manque **et que le dossier vit** : 4 h en urgente, 24 h en normale, 72 h sans urgence ; une demande retirée cesse d'être en retard |
| Identité de l'agent | jamais montrée au demandeur — le fil signe « Assistance », et « Suivie par » n'apparaît que côté plateforme |
| Demande sans fil (canal courriel ou téléphone, jeu d'amorçage) | la colonne `message` sert de message d'ouverture : l'échange ne s'ouvre jamais vide |
| Espace loueur | `/proprietaire/assistance` existe aussi : un compte sans profil locataire ne franchit pas la garde de `/compte` et serait sinon sans recours |
| Deux ouvertures simultanées | la référence se calcule sur le rang le plus haut, jamais sur le nombre de lignes ; en cas de collision l'ouverture se rejoue, et l'échec éventuel se dit à l'écran |

## 6 quater. Tâches quotidiennes

`npm run taches` — à planifier une fois par jour, avant `npm run courriels`.

| Vérification | Attendu |
|---|---|
| Demande `demandee` avec `expire_le` passé | passe à `expiree` **par la machine** (transition `systeme` tracée), notification au locataire |
| Caution `constituee`, échéance passée, location close, sans dossier ouvert | `liberee` |
| Caution avec litige ou sinistre ouvert | **intouchée** — le gel prime |
| Seconde exécution immédiate | zéro partout — idempotence |

## 7. Débit de caution après dommage

Réservé à l'administration. Depuis un compte administrateur, sur une location
restituée dont le constat de retour porte une réserve.

| Scénario | Attendu |
|---|---|
| Montant supérieur à la caution | refus `plafondDepasse`, aucun prélèvement |
| Motif de moins de dix caractères | refus `invalide` |
| Caution déjà libérée | refus `dejaLiberee` |
| Débit valide | `caution.montant_debite` mis à jour, statut `debitee_partiellement` ou `retenue`, ligne au journal d'audit avec l'état avant et après |
| Double clic | un seul prélèvement — clé d'idempotence `caution-<id>-<montant>` |
| Carte expirée ou authentification exigée | refus `debitRefuse`, **aucune écriture** |

La libération, elle, doit être refusée tant qu'un litige ou un sinistre est
ouvert (`fondsGeles`) — règle 6.

## 8. Reversement au propriétaire (Connect)

| Scénario | Attendu |
|---|---|
| Écran « Revenus » sans compte | « Aucun compte de reversement » et bouton d'ouverture |
| Ouverture | redirection vers l'inscription Stripe ; aucune coordonnée bancaire saisie sur nos pages |
| Retour d'inscription incomplète | « Compte de reversement incomplet », bouton « Terminer l'inscription » |
| Inscription terminée | « Compte de reversement actif » |
| Clôture d'une location | le reversement reste **`planifie`** — il n'est pas marqué payé tant que rien n'est viré |
| Envoi avec dossier ouvert | statut `gele`, motif inscrit, aucun virement |
| Envoi nominal | statut `envoye`, `stripe_transfer_id` renseigné |
| Second envoi | sans effet — un seul virement |

Comptes de test Connect : utiliser le numéro de test `000 123 4567` et les
valeurs proposées par Stripe pendant l'inscription.

## 9. Hors périmètre

- **Remboursement** d'un locataire après annulation ou arbitrage : la colonne
  `paiement.montant_rembourse` existe, aucun code ne la remplit depuis Stripe.
- **Contestation bancaire** (`statut = 'conteste'`) : aucun événement
  `charge.dispute.created` n'est traité.
- **Facture de commission** au propriétaire : seul le reçu du locataire est
  émis.

## 10. Nettoyage

```sql
DELETE FROM facture  WHERE reservation_id = '<identifiant>';
DELETE FROM caution  WHERE reservation_id = '<identifiant>';
DELETE FROM paiement WHERE reservation_id = '<identifiant>';
DELETE FROM reservation_transition WHERE reservation_id = '<identifiant>';
UPDATE reservation SET statut = 'demandee', acceptee_le = NULL, payee_le = NULL,
  confirmee_le = NULL, code_retrait = NULL, contrat_url = NULL,
  attestation_assurance_url = NULL
WHERE id = '<identifiant>';
```

Ou, plus simplement, réamorcer : `npm run db:demo`.

Retirer enfin les clés de `.env.local` si le poste sert aussi à autre chose, et
arrêter `stripe listen`.
