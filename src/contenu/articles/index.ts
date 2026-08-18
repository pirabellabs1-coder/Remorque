/**
 * Articles du journal.
 *
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  UN ARTICLE EST DU CONTENU VERSIONNÉ, PAS UNE LIGNE EN BASE             ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * **Pourquoi en fichiers plutôt qu'en base.** Un article se relit, se corrige,
 * se discute avant publication — exactement ce qu'un dépôt sait faire et
 * qu'une table ne sait pas. Il n'a pas d'auteur multiple, pas de flux de
 * validation, pas de brouillon concurrent : lui donner une table, une
 * administration et un éditeur serait construire un journal de rédaction pour
 * publier quatre pages par an.
 *
 * Le jour où plusieurs personnes écriront sans toucher au code, cette décision
 * se renversera — et ce sera le bon moment, pas avant.
 *
 * **Le corps est du texte structuré, pas du HTML.** Aucun article ne peut donc
 * injecter de balise, ce qui ôte la question de l'échappement plutôt que de la
 * traiter. Les paragraphes, intertitres et listes suffisent à ce qu'on écrit
 * ici ; le jour où il faudra un tableau, on ajoutera un type de bloc.
 */

export type Bloc =
  | { type: "paragraphe"; texte: string }
  | { type: "intertitre"; texte: string }
  | { type: "liste"; entrees: string[] };

export type Article = {
  /** Segment d'adresse. Stable : le changer casse les liens entrants. */
  slug: string;
  titre: string;
  /** Résumé d'une ou deux phrases, employé en liste et en métadonnée. */
  chapo: string;
  /** Date de publication, au format ISO. */
  publieLe: string;
  /** Durée de lecture en minutes, mesurée et non devinée. */
  minutes: number;
  corps: Bloc[];
};

/**
 * Le seul article publié à ce jour.
 *
 * Il n'y en a pas cinq, et il n'y en aura pas cinq parce que la page en
 * réclamerait cinq : chacun demande un vrai travail d'écriture. Celui-ci part
 * d'une règle que le code applique déjà et que les tests couvrent, ce qui le
 * rend vérifiable — un article de plateforme qui avance des chiffres invérifiés
 * dessert plus qu'il ne sert.
 */
const CHARGE_UTILE: Article = {
  slug: "ptac-charge-utile-ce-qu-on-peut-vraiment-charger",
  titre: "PTAC, poids à vide, charge utile : ce qu'on peut vraiment charger",
  chapo:
    "Trois nombres figurent sur la carte grise d'une remorque, et le seul qui réponde à « combien puis-je mettre dedans » n'est presque jamais celui qu'on regarde.",
  publieLe: "2026-08-17",
  minutes: 4,
  corps: [
    {
      type: "paragraphe",
      texte:
        "Une annonce de remorque affiche souvent « 750 kg » en gros. Ce nombre est le PTAC — le poids total autorisé en charge — et il comprend la remorque elle-même. Une benne de 750 kg de PTAC qui pèse 180 kg à vide n'emporte donc pas 750 kg de gravats, mais 570.",
    },
    {
      type: "intertitre",
      texte: "Les trois nombres, et celui qui compte",
    },
    {
      type: "liste",
      entrees: [
        "Le poids à vide : ce que pèse la remorque seule, ridelles et roue de secours comprises.",
        "Le PTAC : ce que l'ensemble ne doit jamais dépasser une fois chargé.",
        "La charge utile : la différence entre les deux. C'est elle, et elle seule, qui répond à la question qu'on se pose.",
      ],
    },
    {
      type: "paragraphe",
      texte:
        "C'est pourquoi le filtre de recherche de cette plateforme porte sur la charge utile et non sur le PTAC. Filtrer sur le PTAC ferait remonter des remorques qui ne peuvent pas transporter ce qu'on veut y mettre, et l'on ne s'en apercevrait qu'une fois sur place.",
    },
    {
      type: "intertitre",
      texte: "Ce que votre voiture ajoute à l'équation",
    },
    {
      type: "paragraphe",
      texte:
        "La charge utile de la remorque n'est qu'une des deux limites. La seconde vient du véhicule tracteur : sa masse tractable freinée, inscrite sur sa carte grise, et la catégorie de votre permis. La plus basse des trois l'emporte, toujours.",
    },
    {
      type: "paragraphe",
      texte:
        "Un permis B suffit tant que le PTAC de la remorque ne dépasse pas 750 kg, ou tant que l'ensemble reste sous 3,5 tonnes. Au-delà, il faut le B96 jusqu'à 4,25 tonnes, puis le BE. Ces seuils sont réglementaires : ils ne se négocient pas, et un contrôle routier ne s'intéresse pas à ce qu'annonçait l'annonce.",
    },
    {
      type: "intertitre",
      texte: "Vérifier avant de réserver, pas sur le parking",
    },
    {
      type: "paragraphe",
      texte:
        "Chaque fiche indique la charge utile réelle, et le calculateur de charge croise les trois limites à partir de votre véhicule et de votre permis. Cinq minutes avant de réserver valent mieux qu'un aller-retour pour rien, et qu'un chargement qu'on répartit à l'œil parce qu'on est déjà en retard.",
    },
  ],
};

export const ARTICLES: readonly Article[] = [CHARGE_UTILE];

/** Un article par son segment d'adresse, ou rien. */
export function articleParSlug(slug: string): Article | undefined {
  return ARTICLES.find((article) => article.slug === slug);
}

/** Les articles, du plus récent au plus ancien. */
export function articlesRecents(): Article[] {
  return [...ARTICLES].sort((a, b) => b.publieLe.localeCompare(a.publieLe));
}
