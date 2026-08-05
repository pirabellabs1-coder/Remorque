import "server-only";

/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  DONNÉES DE DÉMONSTRATION — LA SEULE PORTE D'ENTRÉE                      ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * Tout ce que le site affiche et qui n'est pas encore réel passe par ici.
 * Avant ce fichier, les jeux d'essai vivaient dans quatre modules qui
 * s'ignoraient : le générateur pseudo-aléatoire était recopié trois fois, les
 * prénoms deux fois, les commentaires d'avis deux fois — avec des variantes.
 * Le même locataire s'appelait « Camille D. » ici et « Camille Deprez » là,
 * sans qu'on puisse dire s'il s'agissait de la même personne.
 *
 * ─── Où modifier quoi ────────────────────────────────────────────────────
 *
 *   Les annonces (titres, prix, photos, propriétaires)
 *      → `src/server/annonces/catalogue.ts`, tableau `JEU_DE_DEMONSTRATION`
 *
 *   Les personnes (prénoms, noms, adresses électroniques)
 *      → `./personnes.ts`
 *
 *   Les textes (avis, messages, motifs de litige, sujets de support)
 *      → `./textes.ts`
 *
 *   Le hasard (graines, tirages pondérés, dates)
 *      → `./graine.ts`
 *
 *   Les volumes et les répartitions (combien de réservations, quels statuts)
 *      → `./volumes.ts`
 *
 * ─── Comment supprimer tout cela ─────────────────────────────────────────
 *
 * Le jour où la base fournit de vraies données, il n'y a qu'un geste à faire :
 * réimplémenter les fonctions de lecture de `src/server/espaces/` et de
 * `src/server/annonces/depot.ts` sur PostgreSQL, puis effacer ce dossier. Les
 * écrans n'importent jamais d'ici — ils passent par les dépôts — et n'auront
 * donc pas une ligne à changer. C'est précisément pour cela que le dossier est
 * isolé plutôt que dispersé.
 *
 * ─── Ce que ce dossier n'est pas ─────────────────────────────────────────
 *
 * Ce n'est pas une base de données. Les données vivent en mémoire du serveur
 * et ne survivent pas à un redémarrage. C'est suffisant pour concevoir et
 * recetter un parcours de bout en bout — publier une annonce et la voir
 * apparaître dans le catalogue public — et délibérément insuffisant pour la
 * production.
 */

export {
  aujourdhui,
  decalerJours,
  generateur,
  GRAINES,
  joursEntre,
  tirer,
  tirerEntier,
  tirerPondere,
} from "./graine";

export {
  ANNUAIRE,
  composer,
  NOMS,
  type Personne,
  PRENOMS,
  tirerPersonne,
} from "./personnes";

export {
  ACTIONS_AUDIT,
  AUTEURS_ADMIN,
  AVIS_LOCATAIRES,
  MESSAGES_FIL,
  type ModeleAudit,
  REPONSES_LOUEURS,
  SUJETS_SUPPORT,
} from "./textes";

export {
  FENETRE_AVIS_JOURS,
  REPARTITION_LOCATAIRE,
  REPARTITION_LOUEUR,
  STATUTS_ENCAISSES,
  VOLUMES,
} from "./volumes";
