/**
 * Rôles proposés à l'inscription.
 *
 * Logique pure, sans dépendance : ni React, ni base, ni traduction. Elle vivait
 * d'abord dans le composant du sélecteur, ce qui rendait l'action serveur
 * impossible à exécuter hors de Next — importer un fichier `"use client"`
 * entraîne tout `next-intl` avec lui. Le symptôme était un test qui ne pouvait
 * pas tourner ; la cause était une règle métier logée dans un composant.
 *
 * Les deux rôles correspondent aux deux booléens de la table `utilisateur` —
 * `profil_locataire` et `profil_proprietaire` — et non à une colonne « rôle »
 * qui n'existe pas. C'est délibéré : un compte n'est pas *soit* locataire
 * *soit* loueur, il porte l'un, l'autre, ou les deux. Une énumération à trois
 * valeurs aurait rendu impossible d'activer le second profil sans migration.
 *
 * Un troisième choix « les deux » existait à l'inscription. Il a disparu :
 * poser trois questions là où il n'y a qu'une décision — « je loue » ou « je
 * mets en location » — retardait l'entrée sans rien apprendre de plus. Les
 * deux booléens demeurent, et le second profil s'active d'un geste depuis les
 * paramètres le jour où l'on passe de l'un à l'autre.
 */

export const ROLES = ["locataire", "proprietaire"] as const;

export type Role = (typeof ROLES)[number];

export type Profils = {
  profilLocataire: boolean;
  profilProprietaire: boolean;
};

/** Traduction d'un rôle d'interface vers les deux booléens de la base. */
export function profilsDuRole(role: Role): Profils {
  return {
    profilLocataire: role === "locataire",
    profilProprietaire: role === "proprietaire",
  };
}

/**
 * Espace d'accueil correspondant aux profils d'un compte.
 *
 * Un loueur qui arrive sur « mes locations » vides croit que la plateforme n'a
 * pas compris sa demande. C'est tout l'objet de la question posée à
 * l'inscription — encore faut-il en tirer la conséquence à l'arrivée.
 *
 * Le locataire l'emporte quand les deux profils sont actifs : c'est le côté
 * par lequel on entre le plus souvent, et la bascule vers l'espace loueur est
 * à un clic dans la navigation.
 */
export function espaceDaccueil(profils: Profils): "/compte" | "/proprietaire" {
  return profils.profilProprietaire && !profils.profilLocataire
    ? "/proprietaire"
    : "/compte";
}
