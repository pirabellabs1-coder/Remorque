import "server-only";

/**
 * Les textes des jeux d'essai, réunis.
 *
 * Les commentaires d'avis étaient écrits deux fois, à deux endroits, avec des
 * variantes — le même avis se lisait différemment selon qu'on le consultait
 * depuis l'espace loueur ou depuis l'espace locataire.
 *
 * ⚠ Ces textes sont du **contenu de démonstration**, pas de l'interface. Ils
 * ne passent volontairement pas par `next-intl` : ils tiennent lieu de données
 * saisies par des usagers, au même titre qu'un titre d'annonce, et disparaîtront
 * le jour où la base fournira de vrais avis. Traduire un faux avis n'aurait pas
 * plus de sens que traduire le nom d'un locataire.
 */

/** Avis déposés par des locataires. Ton volontairement banal : c'est ce qu'on lit en vrai. */
export const AVIS_LOCATAIRES = [
  "Remorque conforme à l'annonce, attelage rapide. Rien à redire.",
  "Propriétaire très arrangeant sur l'horaire de retour. Je recommande.",
  "Matériel propre et bien entretenu, feux vérifiés devant moi au départ.",
  "Tout s'est bien passé, sangles fournies en plus. Parfait pour un déménagement.",
  "Bon rapport qualité-prix. La bâche était un peu usée, mais rien de gênant.",
  "Échange simple, état des lieux fait en deux minutes de part et d'autre.",
  "Remorque récente, freinage impeccable sur autoroute.",
] as const;

/** Réponses de loueurs à un avis. Courtes : personne n'écrit un paragraphe. */
export const REPONSES_LOUEURS = [
  "Merci beaucoup, au plaisir de vous revoir !",
  "Merci pour votre retour, la bâche sera remplacée cette semaine.",
  "Content que tout se soit bien passé. À bientôt.",
] as const;

/**
 * Messages d'un fil de discussion.
 *
 * `deMoi` est renseigné du point de vue du **locataire** : c'est lui qui pose
 * les questions et le loueur qui répond. Les écrans du loueur inversent la
 * valeur. Fixer un point de vue de référence évite d'avoir à se demander, à
 * chaque lecture, de quel côté on se trouve.
 */
export const MESSAGES_FIL: readonly { texte: string; deMoi: boolean }[] = [
  { texte: "Bonjour, la remorque est-elle disponible dès vendredi soir ?", deMoi: true },
  { texte: "Oui, sans problème. Je peux vous la remettre à partir de 18 h.", deMoi: false },
  { texte: "Est-ce que le faisceau 13 broches est fourni ?", deMoi: true },
  { texte: "Le faisceau est en 13 broches, j'ai un adaptateur si besoin.", deMoi: false },
  { texte: "Merci, je serai là vers 9 h samedi matin.", deMoi: true },
  { texte: "Bien reçu, la caution a été libérée hier. Bonne route !", deMoi: false },
];

/**
 * Sujets de demandes au support.
 *
 * Écrits comme un usager les écrit : en décrivant le symptôme, pas la cause.
 * « Caution non libérée après restitution » et non « anomalie de libération » —
 * c'est ce qui permet de juger si l'écran de support aide vraiment à trier.
 */
export const SUJETS_SUPPORT = [
  "Caution non libérée après restitution",
  "Impossible de téléverser la pièce d'identité",
  "Annonce refusée à la modération, motif incompris",
  "Demande de facture pour une location professionnelle",
  "Le locataire ne répond plus, matériel non restitué",
  "Erreur de calcul sur la commission du mois",
  "Modification d'IBAN refusée",
  "Suppression de compte et données personnelles",
] as const;

/**
 * Actions administratives, pour le journal d'audit.
 *
 * Chaque modèle porte son motif, et l'état avant et après quand l'action en a
 * un. C'est délibéré : un journal où tous les motifs seraient « mise à jour »
 * ne prouverait rien, et « commission modifiée » sans les deux valeurs
 * n'apprend rien à qui relit six mois plus tard pour comprendre un écart de
 * facturation. L'écran ne peut montrer à quoi ressemble un journal utile que
 * si le jeu d'essai en est un.
 */
export type ModeleAudit = {
  action: string;
  cible: string;
  motif: string;
  avant?: string;
  apres?: string;
};

export const ACTIONS_AUDIT: readonly ModeleAudit[] = [
  {
    action: "Annonce refusée",
    cible: "annonce",
    motif: "Photographies ne correspondant pas au matériel décrit",
  },
  {
    action: "Utilisateur suspendu",
    cible: "utilisateur",
    motif: "Trois signalements concordants",
  },
  {
    action: "Identité validée",
    cible: "utilisateur",
    motif: "Pièce lisible et concordante",
  },
  {
    action: "Litige tranché en faveur du locataire",
    cible: "litige",
    motif: "État des lieux de départ défavorable au propriétaire",
  },
  {
    action: "Caution libérée manuellement",
    cible: "reservation",
    motif: "Retard technique du prestataire de paiement",
  },
  {
    action: "Commission modifiée",
    cible: "pays",
    motif: "Alignement tarifaire sur le marché néerlandais",
    avant: "15,00 %",
    apres: "14,00 %",
  },
  {
    action: "Remboursement exceptionnel",
    cible: "reservation",
    motif: "Panne du matériel constatée au départ",
  },
  {
    action: "Sinistre transmis à l'assureur",
    cible: "sinistre",
    motif: "Dossier complet",
  },
];

/** Comptes du personnel apparaissant comme auteurs dans le journal d'audit. */
export const AUTEURS_ADMIN = [
  "marie.admin",
  "karim.support",
  "sophie.direction",
] as const;
