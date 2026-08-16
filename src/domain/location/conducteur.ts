import type { CategoriePermis } from "@/domain/compatibilite/permis";

/**
 * Qui conduit réellement, relevé au moment de la remise.
 *
 * **Le locataire n'est pas toujours le conducteur**, et toute la chaîne le
 * supposait. Une entreprise réserve pour son employé, un particulier organise
 * un déménagement sans prendre le volant, un couple réserve sur le compte de
 * celui qui n'a pas le BE. Exiger le permis du titulaire du compte à la
 * réservation écartait ces cas — et n'apportait aucune garantie, puisque rien
 * n'obligeait ce titulaire à être celui qui partirait avec la remorque.
 *
 * Le contrôle est donc déplacé là où quelqu'un peut réellement l'exercer : à
 * la remise, par le propriétaire, face à la personne. C'est le seul moment où
 * un être humain voit à la fois le document et le visage.
 *
 * **Ce que la plateforme fait, et ce qu'elle ne fait pas.** Elle rend le relevé
 * obligatoire, le range dans un constat signé des deux côtés et le conserve.
 * Elle ne certifie pas l'authenticité du permis présenté : personne sur un
 * parking ne le peut, et prétendre le contraire serait une promesse qu'aucun
 * assureur ne tiendrait pour nous. Ce qui est promis, c'est une trace
 * contradictoire — les deux parties ont vu la même chose et l'ont signée.
 */

/** Le conducteur est-il le titulaire du compte, ou un tiers ? */
export const QUALITES_CONDUCTEUR = ["locataire", "tiers"] as const;
export type QualiteConducteur = (typeof QUALITES_CONDUCTEUR)[number];

export type Conducteur = {
  qualite: QualiteConducteur;
  /** Nom tel qu'il figure sur le permis présenté. */
  nom: string;
  /** Catégories lues sur la pièce. */
  categories: CategoriePermis[];
  /** Une photographie du permis a-t-elle été jointe au constat ? */
  permisPhotographie: boolean;
};

export type ManqueConducteur =
  | "nomManquant"
  | "categorieManquante"
  | "permisNonPhotographie"
  | "categorieInsuffisante";

/**
 * Ce qui manque pour que le relevé vaille quelque chose.
 *
 * **La photographie est exigée pour un tiers, pas pour le titulaire.** Le
 * titulaire a déjà déposé ses pièces au dossier de vérification, contrôlées
 * par un opérateur ; les redemander à chaque retrait serait une formalité
 * vide. Le tiers, lui, n'est connu de personne : sans image de sa pièce, il ne
 * reste qu'un nom écrit à la main sur un parking, c'est-à-dire rien.
 */
export function manquesDuConducteur(
  conducteur: Conducteur,
  categorieRequise: CategoriePermis,
): ManqueConducteur[] {
  const manques: ManqueConducteur[] = [];

  if (conducteur.nom.trim().length < 3) manques.push("nomManquant");
  if (conducteur.categories.length === 0) manques.push("categorieManquante");

  if (conducteur.qualite === "tiers" && !conducteur.permisPhotographie) {
    manques.push("permisNonPhotographie");
  }

  if (
    conducteur.categories.length > 0 &&
    !categorieSuffisante(conducteur.categories, categorieRequise)
  ) {
    manques.push("categorieInsuffisante");
  }

  return manques;
}

/**
 * Les catégories détenues couvrent-elles celle qu'exige l'attelage ?
 *
 * L'ordre est une inclusion, non une simple égalité : le BE permet ce que
 * permet le B96, qui permet ce que permet le B. Comparer les chaînes une à une
 * refuserait un titulaire du BE devant une remorque qui ne demande que le B —
 * et le propriétaire, devant ce refus incompréhensible, passerait outre.
 */
const RANG: Record<CategoriePermis, number> = { B: 0, B96: 1, BE: 2 };

export function categorieSuffisante(
  detenues: CategoriePermis[],
  requise: CategoriePermis,
): boolean {
  return detenues.some((categorie) => RANG[categorie] >= RANG[requise]);
}

/** Le relevé est-il complet et cohérent ? */
export function conducteurReleve(
  conducteur: Conducteur,
  categorieRequise: CategoriePermis,
): boolean {
  return manquesDuConducteur(conducteur, categorieRequise).length === 0;
}
