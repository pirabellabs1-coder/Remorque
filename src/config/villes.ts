/**
 * Villes couvertes par les pages locales, dans toute l'Europe visée.
 *
 * Section 4.1 du cadrage : « le poste le plus rentable du projet ». Les pages
 * `/location-remorque/[ville]` représentent 60 à 80 % du trafic d'une place de
 * marché locale.
 *
 * Trois conséquences directes sur ce fichier :
 *
 * 1. **Plusieurs pays, dès maintenant.** La plateforme est européenne : refaire
 *    l'internationalisation après coup coûte trois fois le prix (section 10).
 *    L'ordre du tableau `PAYS` est l'ordre d'ouverture retenu, et l'ordre
 *    d'affichage partout dans l'interface — la Belgique en tête.
 * 2. **Une ville figure ici même sans une seule annonce.** Les pages de ville
 *    mettent trois à six mois à se positionner : elles doivent être en ligne
 *    avant l'ouverture du service (section 14, étape 6). Une page sans annonce
 *    n'est pas une page vide — elle capte la demande et montre où recruter des
 *    propriétaires.
 * 3. **Aucune donnée inventée.** Nom, province ou département, région et
 *    coordonnées sont des faits publics. Le nombre d'annonces n'est jamais
 *    écrit ici : il est toujours compté sur le catalogue réel.
 *
 * Les coordonnées sont celles du centre de la commune, en WGS 84. Elles ne
 * servent qu'à ordonner les villes voisines pour le maillage interne — les
 * voisines traversent donc les frontières, ce qui est exactement ce qu'on veut
 * entre Lille et Tournai, ou entre Bâle et Mulhouse.
 */

export type CodePays = (typeof PAYS)[number];

/**
 * Nom des pays, pour les phrases qui les nomment.
 *
 * Le code ISO suffit aux machines ; « Aller sur BE » ne se dit pas à un
 * visiteur. Ces noms ne sont pas dans les fichiers de traduction parce
 * qu'ils sont indexés par un code de configuration, non par une clé de
 * message — les traduire viendra avec le premier marché non francophone.
 */
const NOMS_PAYS: Record<string, string> = {
  BE: "Belgique",
  FR: "France",
  LU: "Luxembourg",
  CH: "Suisse",
  NL: "Pays-Bas",
  DE: "Allemagne",
  IT: "Italie",
  ES: "Espagne",
  PT: "Portugal",
};

export function nomDuPays(code: string): string {
  return NOMS_PAYS[code] ?? code;
}

/**
 * La ville appartient-elle au pays servi par ce marché ?
 *
 * Une page de ville n'a de sens que sur le marché de son pays. Rendue
 * ailleurs, elle affiche un catalogue vide — le catalogue étant lui-même
 * borné au pays — et fait concurrence à sa jumelle dans les moteurs : deux
 * adresses, le même sujet, dont l'une sans annonce.
 */
export function villeDuPays(villeSlug: string, codePays: string): boolean {
  const ville = VILLES.find((entree) => entree.slug === villeSlug);
  return ville?.pays === codePays;
}

/**
 * Ordre d'ouverture des marchés. Il suit la séquence de la section 10, la
 * Belgique passant en tête à la demande du client.
 */
export const PAYS = ["BE", "FR", "LU", "CH", "NL", "DE", "IT", "ES", "PT"] as const;

export type Ville = {
  slug: string;
  nom: string;
  pays: CodePays;
  /** Province, département, canton ou région, selon le pays. */
  province: string;
  /**
   * Code du département français. Les autres pays n'ont pas d'équivalent
   * d'usage courant : la métadonnée reprend alors la province.
   */
  code?: string;
  latitude: number;
  longitude: number;
};

type VilleSansPays = Omit<Ville, "pays">;

const dansLePays = (pays: CodePays, villes: VilleSansPays[]): Ville[] =>
  villes.map((ville) => ({ ...ville, pays }));

const BELGIQUE = dansLePays("BE", [
  { slug: "bruxelles", nom: "Bruxelles", province: "Bruxelles-Capitale", latitude: 50.8503, longitude: 4.3517 },
  { slug: "anvers", nom: "Anvers", province: "Anvers", latitude: 51.2194, longitude: 4.4025 },
  { slug: "gand", nom: "Gand", province: "Flandre-Orientale", latitude: 51.0543, longitude: 3.7174 },
  { slug: "charleroi", nom: "Charleroi", province: "Hainaut", latitude: 50.4108, longitude: 4.4446 },
  { slug: "liege", nom: "Liège", province: "Liège", latitude: 50.6326, longitude: 5.5797 },
  { slug: "bruges", nom: "Bruges", province: "Flandre-Occidentale", latitude: 51.2093, longitude: 3.2247 },
  { slug: "namur", nom: "Namur", province: "Namur", latitude: 50.4674, longitude: 4.872 },
  { slug: "louvain", nom: "Louvain", province: "Brabant flamand", latitude: 50.8798, longitude: 4.7005 },
  { slug: "mons", nom: "Mons", province: "Hainaut", latitude: 50.4542, longitude: 3.9563 },
  { slug: "malines", nom: "Malines", province: "Anvers", latitude: 51.0259, longitude: 4.4776 },
  { slug: "alost", nom: "Alost", province: "Flandre-Orientale", latitude: 50.9378, longitude: 4.0409 },
  { slug: "la-louviere", nom: "La Louvière", province: "Hainaut", latitude: 50.487, longitude: 4.1875 },
  { slug: "courtrai", nom: "Courtrai", province: "Flandre-Occidentale", latitude: 50.8279, longitude: 3.2649 },
  { slug: "hasselt", nom: "Hasselt", province: "Limbourg", latitude: 50.9307, longitude: 5.3378 },
  { slug: "ostende", nom: "Ostende", province: "Flandre-Occidentale", latitude: 51.2247, longitude: 2.9125 },
  { slug: "tournai", nom: "Tournai", province: "Hainaut", latitude: 50.6071, longitude: 3.3891 },
  { slug: "genk", nom: "Genk", province: "Limbourg", latitude: 50.9659, longitude: 5.5006 },
  { slug: "seraing", nom: "Seraing", province: "Liège", latitude: 50.5858, longitude: 5.5017 },
  { slug: "wavre", nom: "Wavre", province: "Brabant wallon", latitude: 50.7167, longitude: 4.6119 },
  { slug: "verviers", nom: "Verviers", province: "Liège", latitude: 50.5911, longitude: 5.8626 },
  { slug: "mouscron", nom: "Mouscron", province: "Hainaut", latitude: 50.7442, longitude: 3.2069 },
  { slug: "arlon", nom: "Arlon", province: "Luxembourg", latitude: 49.6833, longitude: 5.8167 },
]);

const FRANCE = dansLePays("FR", [
  { slug: "paris", nom: "Paris", province: "Paris", code: "75", latitude: 48.8566, longitude: 2.3522 },
  { slug: "lille", nom: "Lille", province: "Nord", code: "59", latitude: 50.6292, longitude: 3.0573 },
  { slug: "lyon", nom: "Lyon", province: "Rhône", code: "69", latitude: 45.764, longitude: 4.8357 },
  { slug: "marseille", nom: "Marseille", province: "Bouches-du-Rhône", code: "13", latitude: 43.2965, longitude: 5.3698 },
  { slug: "toulouse", nom: "Toulouse", province: "Haute-Garonne", code: "31", latitude: 43.6045, longitude: 1.4442 },
  { slug: "bordeaux", nom: "Bordeaux", province: "Gironde", code: "33", latitude: 44.8378, longitude: -0.5792 },
  { slug: "nantes", nom: "Nantes", province: "Loire-Atlantique", code: "44", latitude: 47.2184, longitude: -1.5536 },
  { slug: "strasbourg", nom: "Strasbourg", province: "Bas-Rhin", code: "67", latitude: 48.5734, longitude: 7.7521 },
  { slug: "nice", nom: "Nice", province: "Alpes-Maritimes", code: "06", latitude: 43.7102, longitude: 7.262 },
  { slug: "montpellier", nom: "Montpellier", province: "Hérault", code: "34", latitude: 43.6108, longitude: 3.8767 },
  { slug: "rennes", nom: "Rennes", province: "Ille-et-Vilaine", code: "35", latitude: 48.1173, longitude: -1.6778 },
  { slug: "reims", nom: "Reims", province: "Marne", code: "51", latitude: 49.2583, longitude: 4.0317 },
  { slug: "metz", nom: "Metz", province: "Moselle", code: "57", latitude: 49.1193, longitude: 6.1757 },
  { slug: "amiens", nom: "Amiens", province: "Somme", code: "80", latitude: 49.8941, longitude: 2.2958 },
  { slug: "rouen", nom: "Rouen", province: "Seine-Maritime", code: "76", latitude: 49.4432, longitude: 1.0993 },
  { slug: "grenoble", nom: "Grenoble", province: "Isère", code: "38", latitude: 45.1885, longitude: 5.7245 },
  { slug: "dijon", nom: "Dijon", province: "Côte-d'Or", code: "21", latitude: 47.322, longitude: 5.0415 },
  { slug: "tours", nom: "Tours", province: "Indre-et-Loire", code: "37", latitude: 47.3941, longitude: 0.6848 },
  { slug: "nancy", nom: "Nancy", province: "Meurthe-et-Moselle", code: "54", latitude: 48.6921, longitude: 6.1844 },
  { slug: "clermont-ferrand", nom: "Clermont-Ferrand", province: "Puy-de-Dôme", code: "63", latitude: 45.7772, longitude: 3.087 },
]);

const LUXEMBOURG = dansLePays("LU", [
  { slug: "luxembourg", nom: "Luxembourg", province: "Luxembourg", latitude: 49.6116, longitude: 6.1319 },
  { slug: "esch-sur-alzette", nom: "Esch-sur-Alzette", province: "Esch-sur-Alzette", latitude: 49.4958, longitude: 5.9806 },
  { slug: "differdange", nom: "Differdange", province: "Esch-sur-Alzette", latitude: 49.5242, longitude: 5.8914 },
]);

const SUISSE = dansLePays("CH", [
  { slug: "zurich", nom: "Zurich", province: "Zurich", latitude: 47.3769, longitude: 8.5417 },
  { slug: "geneve", nom: "Genève", province: "Genève", latitude: 46.2044, longitude: 6.1432 },
  { slug: "bale", nom: "Bâle", province: "Bâle-Ville", latitude: 47.5596, longitude: 7.5886 },
  { slug: "lausanne", nom: "Lausanne", province: "Vaud", latitude: 46.5197, longitude: 6.6323 },
  { slug: "berne", nom: "Berne", province: "Berne", latitude: 46.948, longitude: 7.4474 },
  { slug: "lucerne", nom: "Lucerne", province: "Lucerne", latitude: 47.0502, longitude: 8.3093 },
  { slug: "winterthour", nom: "Winterthour", province: "Zurich", latitude: 47.5001, longitude: 8.7501 },
  { slug: "saint-gall", nom: "Saint-Gall", province: "Saint-Gall", latitude: 47.4245, longitude: 9.3767 },
]);

const PAYS_BAS = dansLePays("NL", [
  { slug: "amsterdam", nom: "Amsterdam", province: "Hollande-Septentrionale", latitude: 52.3676, longitude: 4.9041 },
  { slug: "rotterdam", nom: "Rotterdam", province: "Hollande-Méridionale", latitude: 51.9244, longitude: 4.4777 },
  { slug: "la-haye", nom: "La Haye", province: "Hollande-Méridionale", latitude: 52.0705, longitude: 4.3007 },
  { slug: "utrecht", nom: "Utrecht", province: "Utrecht", latitude: 52.0907, longitude: 5.1214 },
  { slug: "eindhoven", nom: "Eindhoven", province: "Brabant-Septentrional", latitude: 51.4416, longitude: 5.4697 },
  { slug: "tilbourg", nom: "Tilbourg", province: "Brabant-Septentrional", latitude: 51.5555, longitude: 5.0913 },
  { slug: "groningue", nom: "Groningue", province: "Groningue", latitude: 53.2194, longitude: 6.5665 },
  { slug: "breda", nom: "Bréda", province: "Brabant-Septentrional", latitude: 51.5719, longitude: 4.7683 },
  { slug: "nimegue", nom: "Nimègue", province: "Gueldre", latitude: 51.8126, longitude: 5.8372 },
  { slug: "maastricht", nom: "Maastricht", province: "Limbourg", latitude: 50.8514, longitude: 5.691 },
]);

const ALLEMAGNE = dansLePays("DE", [
  { slug: "berlin", nom: "Berlin", province: "Berlin", latitude: 52.52, longitude: 13.405 },
  { slug: "hambourg", nom: "Hambourg", province: "Hambourg", latitude: 53.5511, longitude: 9.9937 },
  { slug: "munich", nom: "Munich", province: "Bavière", latitude: 48.1351, longitude: 11.582 },
  { slug: "cologne", nom: "Cologne", province: "Rhénanie-du-Nord-Westphalie", latitude: 50.9375, longitude: 6.9603 },
  { slug: "francfort", nom: "Francfort-sur-le-Main", province: "Hesse", latitude: 50.1109, longitude: 8.6821 },
  { slug: "stuttgart", nom: "Stuttgart", province: "Bade-Wurtemberg", latitude: 48.7758, longitude: 9.1829 },
  { slug: "dusseldorf", nom: "Düsseldorf", province: "Rhénanie-du-Nord-Westphalie", latitude: 51.2277, longitude: 6.7735 },
  { slug: "dortmund", nom: "Dortmund", province: "Rhénanie-du-Nord-Westphalie", latitude: 51.5136, longitude: 7.4653 },
  { slug: "leipzig", nom: "Leipzig", province: "Saxe", latitude: 51.3397, longitude: 12.3731 },
  { slug: "breme", nom: "Brême", province: "Brême", latitude: 53.0793, longitude: 8.8017 },
  { slug: "dresde", nom: "Dresde", province: "Saxe", latitude: 51.0504, longitude: 13.7373 },
  { slug: "aix-la-chapelle", nom: "Aix-la-Chapelle", province: "Rhénanie-du-Nord-Westphalie", latitude: 50.7753, longitude: 6.0839 },
]);

const ITALIE = dansLePays("IT", [
  { slug: "rome", nom: "Rome", province: "Latium", latitude: 41.9028, longitude: 12.4964 },
  { slug: "milan", nom: "Milan", province: "Lombardie", latitude: 45.4642, longitude: 9.19 },
  { slug: "naples", nom: "Naples", province: "Campanie", latitude: 40.8518, longitude: 14.2681 },
  { slug: "turin", nom: "Turin", province: "Piémont", latitude: 45.0703, longitude: 7.6869 },
  { slug: "genes", nom: "Gênes", province: "Ligurie", latitude: 44.4056, longitude: 8.9463 },
  { slug: "bologne", nom: "Bologne", province: "Émilie-Romagne", latitude: 44.4949, longitude: 11.3426 },
  { slug: "florence", nom: "Florence", province: "Toscane", latitude: 43.7696, longitude: 11.2558 },
  { slug: "venise", nom: "Venise", province: "Vénétie", latitude: 45.4408, longitude: 12.3155 },
  { slug: "verone", nom: "Vérone", province: "Vénétie", latitude: 45.4384, longitude: 10.9916 },
  { slug: "bari", nom: "Bari", province: "Pouilles", latitude: 41.1171, longitude: 16.8719 },
  { slug: "palerme", nom: "Palerme", province: "Sicile", latitude: 38.1157, longitude: 13.3615 },
  { slug: "catane", nom: "Catane", province: "Sicile", latitude: 37.5079, longitude: 15.083 },
]);

const ESPAGNE = dansLePays("ES", [
  { slug: "madrid", nom: "Madrid", province: "Madrid", latitude: 40.4168, longitude: -3.7038 },
  { slug: "barcelone", nom: "Barcelone", province: "Catalogne", latitude: 41.3851, longitude: 2.1734 },
  { slug: "valence", nom: "Valence", province: "Communauté valencienne", latitude: 39.4699, longitude: -0.3763 },
  { slug: "seville", nom: "Séville", province: "Andalousie", latitude: 37.3891, longitude: -5.9845 },
  { slug: "saragosse", nom: "Saragosse", province: "Aragon", latitude: 41.6488, longitude: -0.8891 },
  { slug: "malaga", nom: "Malaga", province: "Andalousie", latitude: 36.7213, longitude: -4.4214 },
  { slug: "bilbao", nom: "Bilbao", province: "Pays basque", latitude: 43.263, longitude: -2.935 },
  { slug: "alicante", nom: "Alicante", province: "Communauté valencienne", latitude: 38.3452, longitude: -0.481 },
]);

const PORTUGAL = dansLePays("PT", [
  { slug: "lisbonne", nom: "Lisbonne", province: "Lisbonne", latitude: 38.7223, longitude: -9.1393 },
  { slug: "porto", nom: "Porto", province: "Porto", latitude: 41.1579, longitude: -8.6291 },
  { slug: "braga", nom: "Braga", province: "Braga", latitude: 41.5454, longitude: -8.4265 },
  { slug: "coimbra", nom: "Coimbra", province: "Coimbra", latitude: 40.2033, longitude: -8.4103 },
  { slug: "faro", nom: "Faro", province: "Algarve", latitude: 37.0194, longitude: -7.9304 },
]);

/** L'ordre suit `PAYS` : la Belgique d'abord. */
export const VILLES: readonly Ville[] = [
  ...BELGIQUE,
  ...FRANCE,
  ...LUXEMBOURG,
  ...SUISSE,
  ...PAYS_BAS,
  ...ALLEMAGNE,
  ...ITALIE,
  ...ESPAGNE,
  ...PORTUGAL,
];

const PAR_SLUG = new Map<string, Ville>(
  VILLES.map((ville) => [ville.slug, ville]),
);

export function trouverVille(slug: string): Ville | undefined {
  return PAR_SLUG.get(slug);
}

export function villesDuPays(pays: CodePays): Ville[] {
  return VILLES.filter((ville) => ville.pays === pays);
}

/** Ce qui s'affiche en second, après le nom de la ville. */
export function zoneDe(ville: Ville): string {
  return ville.code ?? ville.province;
}

/**
 * Distance orthodromique entre deux villes, en kilomètres.
 * Suffisamment exacte pour classer des voisines ; ce n'est pas un itinéraire.
 */
export function distanceKm(a: Ville, b: Ville): number {
  const rayonTerrestreKm = 6371;
  const rad = (degres: number) => (degres * Math.PI) / 180;

  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.latitude)) *
      Math.cos(rad(b.latitude)) *
      Math.sin(dLon / 2) ** 2;

  return Math.round(rayonTerrestreKm * 2 * Math.asin(Math.sqrt(h)));
}

/**
 * Villes voisines, pour le maillage interne (M15).
 *
 * Le rayon est volontairement large : à défaut de voisine immédiate, mieux
 * vaut proposer une ville à cent kilomètres que rien du tout — une page sans
 * lien sortant est une impasse pour le visiteur comme pour l'indexation.
 */
export function villesVoisines(
  ville: Ville,
  nombre = 6,
): Array<Ville & { distanceKm: number }> {
  return VILLES.filter((autre) => autre.slug !== ville.slug)
    .map((autre) => ({ ...autre, distanceKm: distanceKm(ville, autre) }))
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, nombre);
}
