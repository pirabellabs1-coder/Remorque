/**
 * Ce qu'il faut avoir prouvé pour agir sur la place de marché.
 *
 * La base portait déjà `identite_statut` et `permis_statut`, avec le
 * commentaire « conditionnent la publication et la réservation ». Personne ne
 * les lisait. On pouvait publier une remorque et en réserver une sans jamais
 * avoir dit qui l'on était : les colonnes existaient, la règle non.
 *
 * **Pourquoi les deux côtés.** Un contrôle qui ne porte que sur le locataire
 * protège le propriétaire et laisse le locataire seul en face d'un inconnu ;
 * l'inverse fait la même injustice. Sur une place de marché entre
 * particuliers, la confiance ne circule que si elle est réciproque — et le
 * jour où un bien ne revient pas, la question posée par l'assureur puis par le
 * juge est la même des deux côtés : qui était l'autre ?
 *
 * **Le permis n'est pas une condition de réservation.** Il l'a été, et c'était
 * une erreur double. D'un côté elle écartait des cas parfaitement légitimes :
 * une entreprise qui réserve pour son employé, quelqu'un qui organise un
 * déménagement sans conduire, un couple dont un seul détient le BE. De l'autre
 * elle donnait une assurance fausse — vérifier le permis du titulaire du
 * compte ne dit rien de qui prendra le volant.
 *
 * Le contrôle qui compte se fait là où quelqu'un peut réellement l'exercer :
 * à la remise du matériel, par le propriétaire, face à la personne qui va
 * partir avec. Il est donc relevé dans l'état des lieux de départ — nom,
 * catégorie, photographie du permis — et porté par un constat signé des deux
 * côtés. Voir `domain/location/conducteur.ts`.
 *
 * Le fichier ne connaît ni la base, ni le réseau, ni l'interface : il prend un
 * état, il rend des manques. C'est ce qui permet à la porte du serveur et au
 * bandeau de l'écran de dire exactement la même chose.
 */

export const STATUTS_VERIFICATION = [
  "non_soumis",
  "en_attente",
  "verifie",
  "refuse",
] as const;

export type StatutVerification = (typeof STATUTS_VERIFICATION)[number];

/** Les deux pièces que la plateforme sait contrôler. */
export const PIECES = ["identite", "permis"] as const;
export type Piece = (typeof PIECES)[number];

/** L'état de vérification d'un compte, tel qu'il est rangé en base. */
export type EtatVerification = {
  emailVerifie: boolean;
  identiteStatut: StatutVerification;
  permisStatut: StatutVerification;
  /** Date de fin de validité du permis, nulle si elle n'a pas été relevée. */
  permisExpireLe: Date | null;
};

/**
 * Ce qui manque, exprimé par des clés stables.
 *
 * Des clés plutôt que des phrases : le domaine ne traduit pas, et la même clé
 * sert au refus du serveur, au bandeau de l'espace et au message d'erreur du
 * formulaire. Une phrase française ici obligerait à la répéter ailleurs, et
 * les deux finiraient par diverger.
 */
export type Manque =
  | "emailNonVerifie"
  | "identiteNonSoumise"
  | "identiteEnAttente"
  | "identiteRefusee"
  | "permisNonSoumis"
  | "permisEnAttente"
  | "permisRefuse"
  | "permisExpire";

/** Manques relatifs à une pièce, dans l'ordre où on les rencontre. */
function manquesDeLaPiece(
  piece: Piece,
  statut: StatutVerification,
): Manque[] {
  if (statut === "verifie") return [];

  if (piece === "identite") {
    if (statut === "non_soumis") return ["identiteNonSoumise"];
    if (statut === "en_attente") return ["identiteEnAttente"];
    return ["identiteRefusee"];
  }

  if (statut === "non_soumis") return ["permisNonSoumis"];
  if (statut === "en_attente") return ["permisEnAttente"];
  return ["permisRefuse"];
}

/**
 * Ce qui manque au propriétaire pour publier.
 *
 * L'adresse électronique en premier : c'est la seule voie par laquelle on
 * joindra le propriétaire pour une demande de location, et une annonce dont
 * le propriétaire est injoignable ne vaut rien pour personne.
 */
export function manquesPourPublier(etat: EtatVerification): Manque[] {
  const manques: Manque[] = [];
  if (!etat.emailVerifie) manques.push("emailNonVerifie");
  manques.push(...manquesDeLaPiece("identite", etat.identiteStatut));
  return manques;
}

/**
 * Ce qui manque au locataire pour demander une location.
 *
 * **L'identité, et elle seule.** Le permis n'y figure plus : celui qui réserve
 * n'est pas nécessairement celui qui conduit, et l'exiger ici écartait des
 * locataires légitimes tout en ne prouvant rien sur le conducteur réel. Le
 * permis se relève à la remise, dans le constat de départ.
 *
 * Ce qu'on exige en revanche, c'est de savoir **qui réserve** : quelqu'un
 * répond du matériel, paie la caution et signe le contrat, même s'il ne prend
 * pas le volant.
 */
export function manquesPourReserver(etat: EtatVerification): Manque[] {
  const manques: Manque[] = [];
  if (!etat.emailVerifie) manques.push("emailNonVerifie");
  manques.push(...manquesDeLaPiece("identite", etat.identiteStatut));
  return manques;
}

/** Le propriétaire peut-il publier ? */
export function peutPublier(etat: EtatVerification): boolean {
  return manquesPourPublier(etat).length === 0;
}

/** Le locataire peut-il demander une location ? */
export function peutReserver(etat: EtatVerification): boolean {
  return manquesPourReserver(etat).length === 0;
}

/**
 * Les pièces qu'un compte doit fournir, selon les profils qu'il porte.
 *
 * Un compte peut porter les deux profils — c'est le principe posé par le
 * schéma, « un compte, deux profils ». Il doit alors le dossier le plus
 * exigeant des deux, et non deux dossiers séparés : la même carte d'identité
 * ne se dépose pas deux fois.
 */
export function piecesRequises(profils: {
  profilLocataire: boolean;
  profilProprietaire: boolean;
}): Piece[] {
  const pieces: Piece[] = ["identite"];
  // Le permis reste proposé au locataire, sans être exigé : le déposer une
  // fois évite de le présenter à chaque retrait, et alimente le calcul de
  // compatibilité d'attelage affiché sur les fiches. C'est un service rendu à
  // celui qui conduit souvent, non une condition d'entrée.
  if (profils.profilLocataire) pieces.push("permis");
  return pieces;
}

/**
 * Avancement du dossier, pour la barre de progression de l'écran.
 *
 * Une pièce en attente compte comme faite : l'intéressé n'a plus rien à faire,
 * et lui montrer une barre incomplète l'inviterait à redéposer ce qui est déjà
 * chez nous. Une pièce refusée ne compte pas — il y a une action à reprendre.
 */
export function avancement(
  etat: EtatVerification,
  pieces: Piece[],
): { faits: number; total: number } {
  const statut = (piece: Piece) =>
    piece === "identite" ? etat.identiteStatut : etat.permisStatut;

  const faits = pieces.filter((piece) => {
    const valeur = statut(piece);
    return valeur === "verifie" || valeur === "en_attente";
  }).length;

  // L'adresse électronique fait partie du compte : elle entre dans le total,
  // sans quoi un dossier « complet » resterait bloqué sans qu'on voie pourquoi.
  return {
    faits: faits + (etat.emailVerifie ? 1 : 0),
    total: pieces.length + 1,
  };
}
