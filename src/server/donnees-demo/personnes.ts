import "server-only";

import { generateur, tirer } from "./graine";

/**
 * Les personnes des jeux d'essai.
 *
 * Deux listes de prénoms coexistaient, l'une abrégeant les noms en initiale,
 * l'autre les écrivant en entier. Résultat : le même compte apparaissait
 * « Camille D. » dans l'espace loueur et « Camille Deprez » dans
 * l'administration, sans qu'on puisse dire s'il s'agissait de la même personne.
 *
 * Une seule liste, donc, et deux façons de l'écrire :
 *
 * - `nomAffiche` — prénom et initiale. C'est ce que voit un usager, parce
 *   qu'un loueur n'a pas à connaître le patronyme de son locataire avant la
 *   réservation.
 * - `nomComplet` — prénom et nom. Réservé à l'administration, qui instruit des
 *   litiges et doit désigner quelqu'un sans ambiguïté.
 *
 * Le choix du registre est ainsi une décision d'écran, pas un accident de jeu
 * d'essai.
 */

export const PRENOMS = [
  "Camille", "Julien", "Fatima", "Marc", "Élodie", "Youssef", "Anne-Sophie",
  "Thomas", "Leïla", "Pieter", "Sofie", "Grégoire", "Nadia", "Bastien",
  "Margot", "Hicham", "Lucie", "Olivier", "Inès", "Damien", "Karim", "Manon",
] as const;

export const NOMS = [
  "Deprez", "Martin", "Bakker", "Lemaire", "Vandamme", "Rousseau", "Thys",
  "Claes", "Hendrickx", "Peeters", "Dubois", "Janssens",
] as const;

export type Personne = {
  prenom: string;
  nom: string;
  /** « Camille D. » — ce que voit un autre usager. */
  nomAffiche: string;
  /** « Camille Deprez » — ce que voit l'administration. */
  nomComplet: string;
  courriel: string;
};

/** Retire les accents et met en minuscules, pour fabriquer une adresse plausible. */
function sansAccent(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
}

export function composer(prenom: string, nom: string): Personne {
  return {
    prenom,
    nom,
    nomAffiche: `${prenom} ${nom.charAt(0)}.`,
    nomComplet: `${prenom} ${nom}`,
    // `example.fr` est réservé par la RFC 2606 : aucune de ces adresses ne peut
    // appartenir à quelqu'un, et un envoi accidentel n'atteindra personne.
    courriel: `${sansAccent(prenom)}.${sansAccent(nom)}@example.fr`,
  };
}

/** Tire une personne au hasard, de façon reproductible. */
export function tirerPersonne(hasard: () => number): Personne {
  return composer(tirer(hasard, PRENOMS), tirer(hasard, NOMS));
}

/**
 * L'annuaire complet, construit une fois.
 *
 * Les jeux d'essai y puisent au lieu d'inventer des noms chacun de leur côté :
 * c'est ce qui permet à une même personne d'apparaître comme locataire dans un
 * écran et dans la liste des utilisateurs de l'autre, avec le même nom.
 *
 * C'est le **produit croisé** des prénoms et des noms, soit plusieurs centaines
 * d'identités distinctes, et non un prénom tiré au hasard par nom. La liste des
 * utilisateurs de l'administration en compte plus de deux cents : un annuaire
 * réduit à la taille de la liste de prénoms y ferait apparaître dix fois le
 * même homonyme, et le tri par nom deviendrait illisible.
 *
 * L'ordre est mélangé une fois, de façon reproductible : sans cela, les vingt
 * premiers comptes affichés partageraient tous le même prénom.
 */
export const ANNUAIRE: Personne[] = (() => {
  const personnes = PRENOMS.flatMap((prenom) =>
    NOMS.map((nom) => composer(prenom, nom)),
  );

  // Mélange de Fisher-Yates, à graine fixe.
  const hasard = generateur(19870412);
  for (let index = personnes.length - 1; index > 0; index -= 1) {
    const cible = Math.floor(hasard() * (index + 1));
    [personnes[index], personnes[cible]] = [personnes[cible], personnes[index]];
  }

  return personnes;
})();
