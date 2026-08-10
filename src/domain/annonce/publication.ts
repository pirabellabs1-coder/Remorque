/**
 * Assistant de publication en six étapes (M02).
 *
 * Le schéma portait déjà `annonce.etape_publication` et le statut `brouillon` ;
 * personne ne s'en servait. Le dépôt écrivait « étape 6 » en dur et publiait
 * d'un bloc, ce qui obligeait le propriétaire à tout renseigner d'une traite,
 * sans jamais pouvoir s'interrompre. Un particulier qui met sa remorque en
 * location le fait depuis son téléphone, dans sa cour, entre deux photos : il
 * lui faut pouvoir s'arrêter et reprendre.
 *
 * Ce module ne connaît ni la base ni le réseau : il dit seulement, d'un état
 * donné, ce qui manque encore. C'est ce qui permet de le vérifier en recette
 * sans monter une base, et d'utiliser la même règle des deux côtés — le
 * formulaire affiche ce qui manque, l'action serveur refuse de passer à la
 * suite tant que cela manque.
 */

export const ETAPES = [
  "categorie",
  "materiel",
  "caracteristiques",
  "photos",
  "retrait",
  "tarifs",
] as const;

export type Etape = (typeof ETAPES)[number];

/** Nombre d'étapes de l'assistant, pour l'affichage « étape 3 sur 6 ». */
export const NOMBRE_ETAPES = ETAPES.length;

/** Bornes du nombre de photos exigées par annonce. */
export const PHOTOS_MINIMUM = 3;
export const PHOTOS_MAXIMUM = 12;

/**
 * Le rang affiché d'une étape, de 1 à 6.
 *
 * Il est dérivé de la position dans `ETAPES` et non écrit à côté : deux listes
 * à tenir en cohérence finissent toujours par diverger.
 */
export function rangDe(etape: Etape): number {
  return ETAPES.indexOf(etape) + 1;
}

/** L'étape correspondant à un rang, ou la première si le rang est aberrant. */
export function etapeDeRang(rang: number): Etape {
  return ETAPES[rang - 1] ?? ETAPES[0];
}

/** L'étape suivante, ou `null` si l'on est déjà à la dernière. */
export function etapeSuivante(etape: Etape): Etape | null {
  return ETAPES[ETAPES.indexOf(etape) + 1] ?? null;
}

/** L'étape précédente, ou `null` si l'on est déjà à la première. */
export function etapePrecedente(etape: Etape): Etape | null {
  const rang = ETAPES.indexOf(etape);
  return rang > 0 ? ETAPES[rang - 1] : null;
}

/**
 * Quelle étape afficher, pour un rang demandé dans l'adresse.
 *
 * Le rang vient du navigateur : il peut désigner une étape qu'on n'a pas les
 * moyens de dessiner. Trois cas, et un seul repli.
 *
 * Le piège est à l'étape 2. Le brouillon naît à la *fin* de cette étape —
 * la ligne `annonce` exige une ville, une position et une devise, qu'on ne
 * connaît pas avant. Exiger un brouillon pour l'afficher renvoie donc à
 * l'étape 1 celui qui vient tout juste de choisir sa catégorie, et l'assistant
 * ne démarre jamais : le bouton « Continuer » semble sans effet alors qu'il a
 * bien fonctionné. C'est exactement le défaut que cette fonction existe pour
 * rendre impossible, et que les tests ci-contre verrouillent.
 */
export function etapeAffichable(contexte: {
  rangDemande: number;
  /** Un brouillon existe déjà et appartient au demandeur. */
  aBrouillon: boolean;
  /** Une catégorie a été choisie, fût-ce seulement dans l'adresse. */
  aCategorie: boolean;
}): Etape {
  const { rangDemande, aBrouillon, aCategorie } = contexte;

  if (!Number.isInteger(rangDemande) || rangDemande < 1 || rangDemande > NOMBRE_ETAPES) {
    return "categorie";
  }

  if (rangDemande === 1) return "categorie";

  // Étape 2 : la catégorie suffit, elle voyage dans l'adresse.
  if (rangDemande === 2) {
    return aCategorie || aBrouillon ? "materiel" : "categorie";
  }

  // Au-delà, il faut de quoi enregistrer : sans brouillon, il n'y a rien à
  // remplir ni où le mettre.
  return aBrouillon ? etapeDeRang(rangDemande) : "categorie";
}

/**
 * L'état d'une annonce en cours de rédaction, vu du domaine.
 *
 * Volontairement plat et sans dépendance : ce sont les colonnes de `annonce`
 * qui comptent pour la publication, plus le nombre de photos déposées. Tout ce
 * qui est nullable ici l'est aussi en base — un brouillon est par définition
 * incomplet.
 */
export type EtatAnnonce = {
  categorieSlug: string | null;
  titre: string | null;
  description: string | null;
  villeSlug: string | null;

  ptacKg: number | null;
  poidsVideKg: number | null;
  longueurUtileMm: number | null;
  largeurUtileMm: number | null;

  nombrePhotos: number;

  adresseLigne1: string | null;
  codePostal: string | null;

  prixJour: number | null;
  caution: number | null;
};

/**
 * Encadrement de la caution, lu dans la table `pays` (règle 2).
 *
 * Il est passé en paramètre plutôt que codé ici : le plafond belge n'est pas
 * le plafond français, et il doit rester pilotable depuis l'administration
 * sans redéploiement.
 */
export type BornesCaution = { minimum: number; maximum: number };

/**
 * Ce qui manque pour franchir une étape.
 *
 * La fonction rend des clés de traduction et non des phrases : la règle 3
 * interdit toute chaîne d'interface ici, et le domaine n'a de toute façon pas
 * à savoir dans quelle langue on la lui demande.
 */
export function manquesDeLEtape(
  etape: Etape,
  etat: EtatAnnonce,
  bornes?: BornesCaution,
): string[] {
  const manques: string[] = [];

  switch (etape) {
    case "categorie":
      if (!etat.categorieSlug) manques.push("categorie");
      break;

    case "materiel":
      if (!etat.titre || etat.titre.trim().length < 5) manques.push("titre");
      if (!etat.description || etat.description.trim().length < 20) {
        manques.push("description");
      }
      if (!etat.villeSlug) manques.push("ville");
      break;

    case "caracteristiques": {
      if (!etat.ptacKg) manques.push("ptac");
      if (!etat.poidsVideKg) manques.push("poidsVide");
      if (!etat.longueurUtileMm) manques.push("longueur");
      if (!etat.largeurUtileMm) manques.push("largeur");
      // La charge utile est dérivée : un poids à vide supérieur au PTAC
      // donnerait une charge utile négative, c'est-à-dire une annonce qui
      // affiche une aberration physique.
      if (etat.ptacKg && etat.poidsVideKg && etat.poidsVideKg >= etat.ptacKg) {
        manques.push("poidsVideSuperieur");
      }
      break;
    }

    case "photos":
      if (etat.nombrePhotos < PHOTOS_MINIMUM) manques.push("photos");
      break;

    case "retrait":
      if (!etat.adresseLigne1 || etat.adresseLigne1.trim().length < 4) {
        manques.push("adresse");
      }
      if (!etat.codePostal || etat.codePostal.trim().length < 4) {
        manques.push("codePostal");
      }
      break;

    case "tarifs": {
      if (!etat.prixJour || etat.prixJour <= 0) manques.push("prix");
      if (etat.caution === null) manques.push("caution");
      else if (bornes && (etat.caution < bornes.minimum || etat.caution > bornes.maximum)) {
        manques.push("cautionHorsBornes");
      }
      break;
    }
  }

  return manques;
}

/** Une étape est franchie quand plus rien ne lui manque. */
export function etapeComplete(
  etape: Etape,
  etat: EtatAnnonce,
  bornes?: BornesCaution,
): boolean {
  return manquesDeLEtape(etape, etat, bornes).length === 0;
}

/**
 * La première étape encore incomplète.
 *
 * C'est là que l'assistant ramène le propriétaire qui reprend un brouillon
 * abandonné : pas à la première étape, qu'il a déjà remplie, ni à la dernière,
 * où il ne comprendrait pas ce qu'on lui refuse.
 */
export function premiereEtapeIncomplete(
  etat: EtatAnnonce,
  bornes?: BornesCaution,
): Etape | null {
  return ETAPES.find((etape) => !etapeComplete(etape, etat, bornes)) ?? null;
}

/**
 * Une annonce est publiable quand les six étapes sont franchies.
 *
 * La vérification porte sur l'état complet et non sur le compteur
 * `etape_publication` : le compteur dit où en est la navigation, il ne prouve
 * pas que les champs sont remplis. Se fier à lui laisserait publier une annonce
 * vide à qui saurait forger l'adresse de la dernière étape.
 */
export function pretePourPublication(
  etat: EtatAnnonce,
  bornes?: BornesCaution,
): boolean {
  return premiereEtapeIncomplete(etat, bornes) === null;
}
