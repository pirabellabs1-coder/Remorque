/**
 * Villes couvertes par les pages locales.
 *
 * Section 4.1 du cadrage : « le poste le plus rentable du projet ». Les pages
 * `/location-remorque/[ville]` représentent 60 à 80 % du trafic d'une place de
 * marché locale.
 *
 * Deux conséquences directes sur ce fichier :
 *
 * 1. **Une ville figure ici même sans une seule annonce.** Les pages de ville
 *    mettent trois à six mois à se positionner : elles doivent être en ligne
 *    avant l'ouverture du service (section 14, étape 6). Une page sans annonce
 *    n'est pas une page vide — elle capte la demande et permet de mesurer où
 *    recruter des propriétaires.
 * 2. **Aucune donnée inventée.** Nom, département, région et coordonnées sont
 *    des faits publics. Le nombre d'annonces n'est jamais écrit ici : il est
 *    toujours compté sur le catalogue réel.
 *
 * Les coordonnées sont celles du centre de la commune, en WGS 84. Elles ne
 * servent qu'à ordonner les villes voisines pour le maillage interne.
 */

export type Ville = {
  slug: string;
  nom: string;
  /** Code du département, tel qu'il s'écrit (« 06 », « 2A »). */
  departement: string;
  departementNom: string;
  region: string;
  latitude: number;
  longitude: number;
};

export const VILLES = [
  { slug: "paris", nom: "Paris", departement: "75", departementNom: "Paris", region: "Île-de-France", latitude: 48.8566, longitude: 2.3522 },
  { slug: "marseille", nom: "Marseille", departement: "13", departementNom: "Bouches-du-Rhône", region: "Provence-Alpes-Côte d'Azur", latitude: 43.2965, longitude: 5.3698 },
  { slug: "lyon", nom: "Lyon", departement: "69", departementNom: "Rhône", region: "Auvergne-Rhône-Alpes", latitude: 45.764, longitude: 4.8357 },
  { slug: "toulouse", nom: "Toulouse", departement: "31", departementNom: "Haute-Garonne", region: "Occitanie", latitude: 43.6045, longitude: 1.4442 },
  { slug: "nice", nom: "Nice", departement: "06", departementNom: "Alpes-Maritimes", region: "Provence-Alpes-Côte d'Azur", latitude: 43.7102, longitude: 7.262 },
  { slug: "nantes", nom: "Nantes", departement: "44", departementNom: "Loire-Atlantique", region: "Pays de la Loire", latitude: 47.2184, longitude: -1.5536 },
  { slug: "montpellier", nom: "Montpellier", departement: "34", departementNom: "Hérault", region: "Occitanie", latitude: 43.6108, longitude: 3.8767 },
  { slug: "strasbourg", nom: "Strasbourg", departement: "67", departementNom: "Bas-Rhin", region: "Grand Est", latitude: 48.5734, longitude: 7.7521 },
  { slug: "bordeaux", nom: "Bordeaux", departement: "33", departementNom: "Gironde", region: "Nouvelle-Aquitaine", latitude: 44.8378, longitude: -0.5792 },
  { slug: "lille", nom: "Lille", departement: "59", departementNom: "Nord", region: "Hauts-de-France", latitude: 50.6292, longitude: 3.0573 },
  { slug: "rennes", nom: "Rennes", departement: "35", departementNom: "Ille-et-Vilaine", region: "Bretagne", latitude: 48.1173, longitude: -1.6778 },
  { slug: "reims", nom: "Reims", departement: "51", departementNom: "Marne", region: "Grand Est", latitude: 49.2583, longitude: 4.0317 },
  { slug: "toulon", nom: "Toulon", departement: "83", departementNom: "Var", region: "Provence-Alpes-Côte d'Azur", latitude: 43.1242, longitude: 5.928 },
  { slug: "saint-etienne", nom: "Saint-Étienne", departement: "42", departementNom: "Loire", region: "Auvergne-Rhône-Alpes", latitude: 45.4397, longitude: 4.3872 },
  { slug: "le-havre", nom: "Le Havre", departement: "76", departementNom: "Seine-Maritime", region: "Normandie", latitude: 49.4944, longitude: 0.1079 },
  { slug: "grenoble", nom: "Grenoble", departement: "38", departementNom: "Isère", region: "Auvergne-Rhône-Alpes", latitude: 45.1885, longitude: 5.7245 },
  { slug: "dijon", nom: "Dijon", departement: "21", departementNom: "Côte-d'Or", region: "Bourgogne-Franche-Comté", latitude: 47.322, longitude: 5.0415 },
  { slug: "angers", nom: "Angers", departement: "49", departementNom: "Maine-et-Loire", region: "Pays de la Loire", latitude: 47.4784, longitude: -0.5632 },
  { slug: "nimes", nom: "Nîmes", departement: "30", departementNom: "Gard", region: "Occitanie", latitude: 43.8367, longitude: 4.3601 },
  { slug: "villeurbanne", nom: "Villeurbanne", departement: "69", departementNom: "Rhône", region: "Auvergne-Rhône-Alpes", latitude: 45.7719, longitude: 4.8902 },
  { slug: "clermont-ferrand", nom: "Clermont-Ferrand", departement: "63", departementNom: "Puy-de-Dôme", region: "Auvergne-Rhône-Alpes", latitude: 45.7772, longitude: 3.087 },
  { slug: "le-mans", nom: "Le Mans", departement: "72", departementNom: "Sarthe", region: "Pays de la Loire", latitude: 48.0061, longitude: 0.1996 },
  { slug: "aix-en-provence", nom: "Aix-en-Provence", departement: "13", departementNom: "Bouches-du-Rhône", region: "Provence-Alpes-Côte d'Azur", latitude: 43.5297, longitude: 5.4474 },
  { slug: "brest", nom: "Brest", departement: "29", departementNom: "Finistère", region: "Bretagne", latitude: 48.3904, longitude: -4.4861 },
  { slug: "tours", nom: "Tours", departement: "37", departementNom: "Indre-et-Loire", region: "Centre-Val de Loire", latitude: 47.3941, longitude: 0.6848 },
  { slug: "amiens", nom: "Amiens", departement: "80", departementNom: "Somme", region: "Hauts-de-France", latitude: 49.8941, longitude: 2.2958 },
  { slug: "limoges", nom: "Limoges", departement: "87", departementNom: "Haute-Vienne", region: "Nouvelle-Aquitaine", latitude: 45.8336, longitude: 1.2611 },
  { slug: "annecy", nom: "Annecy", departement: "74", departementNom: "Haute-Savoie", region: "Auvergne-Rhône-Alpes", latitude: 45.8992, longitude: 6.1294 },
  { slug: "perpignan", nom: "Perpignan", departement: "66", departementNom: "Pyrénées-Orientales", region: "Occitanie", latitude: 42.6887, longitude: 2.8948 },
  { slug: "besancon", nom: "Besançon", departement: "25", departementNom: "Doubs", region: "Bourgogne-Franche-Comté", latitude: 47.2378, longitude: 6.0241 },
  { slug: "metz", nom: "Metz", departement: "57", departementNom: "Moselle", region: "Grand Est", latitude: 49.1193, longitude: 6.1757 },
  { slug: "orleans", nom: "Orléans", departement: "45", departementNom: "Loiret", region: "Centre-Val de Loire", latitude: 47.9029, longitude: 1.9093 },
  { slug: "rouen", nom: "Rouen", departement: "76", departementNom: "Seine-Maritime", region: "Normandie", latitude: 49.4432, longitude: 1.0993 },
  { slug: "mulhouse", nom: "Mulhouse", departement: "68", departementNom: "Haut-Rhin", region: "Grand Est", latitude: 47.7508, longitude: 7.3359 },
  { slug: "caen", nom: "Caen", departement: "14", departementNom: "Calvados", region: "Normandie", latitude: 49.1829, longitude: -0.3707 },
  { slug: "nancy", nom: "Nancy", departement: "54", departementNom: "Meurthe-et-Moselle", region: "Grand Est", latitude: 48.6921, longitude: 6.1844 },
] as const satisfies readonly Ville[];

export type SlugVille = (typeof VILLES)[number]["slug"];

const PAR_SLUG = new Map<string, Ville>(VILLES.map((ville) => [ville.slug, ville]));

export function trouverVille(slug: string): Ville | undefined {
  return PAR_SLUG.get(slug);
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
    Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;

  return Math.round(rayonTerrestreKm * 2 * Math.asin(Math.sqrt(h)));
}

/**
 * Villes voisines, pour le maillage interne (M15).
 *
 * Le rayon est volontairement large : à défaut de voisine immédiate, mieux
 * vaut proposer une ville à cent kilomètres que rien du tout — une page sans
 * lien sortant est une impasse pour le visiteur comme pour l'indexation.
 */
export function villesVoisines(ville: Ville, nombre = 6): Array<Ville & { distanceKm: number }> {
  return VILLES.filter((autre) => autre.slug !== ville.slug)
    .map((autre) => ({ ...autre, distanceKm: distanceKm(ville, autre) }))
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, nombre);
}
