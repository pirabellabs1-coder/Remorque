/**
 * Déplacement d'une position avant publication.
 *
 * La fiche publique dessinait un cercle d'imprécision autour du point **exact**
 * du matériel. Le cercle était décoratif ; le centre était la vérité, et il
 * voyageait dans le HTML de chaque annonce. Moissonner le catalogue rendait
 * donc l'adresse précise de toutes les remorques du pays — c'est-à-dire une
 * liste de courses pour qui vole des remorques.
 *
 * Le point publié est désormais **faux**, d'un écart tiré au hasard à
 * l'intérieur du cercle annoncé. Le vrai point ne quitte le serveur qu'après
 * confirmation de la réservation, pour les deux parties.
 *
 * **L'écart est déterministe, et c'est le point important.** Un déplacement
 * retiré à chaque requête paraîtrait plus sûr ; il serait bien pire. Vingt
 * chargements de la même fiche donneraient vingt points dispersés autour du
 * vrai, dont la moyenne le désigne à quelques mètres. Une graine stable — ici
 * l'identifiant de l'annonce — produit toujours le même faux point : on peut
 * le recharger mille fois, il ne dit rien de plus.
 */

/**
 * Hachage court et stable d'une chaîne.
 *
 * FNV-1a : quelques lignes, sans dépendance, et suffisamment dispersant pour
 * un usage qui n'est pas cryptographique. On ne cherche pas à résister à un
 * adversaire qui connaîtrait la graine — il connaîtrait alors l'identifiant de
 * l'annonce, donc rien qu'il n'ait déjà.
 */
function empreinte(graine: string): number {
  let valeur = 0x811c9dc5;
  for (let rang = 0; rang < graine.length; rang += 1) {
    valeur ^= graine.charCodeAt(rang);
    valeur = Math.imul(valeur, 0x01000193);
  }
  return valeur >>> 0;
}

/** Deux nombres entre 0 et 1, tirés de la même graine. */
function tirages(graine: string): [number, number] {
  const a = empreinte(graine);
  const b = empreinte(`${graine}:second`);
  return [a / 0xffffffff, b / 0xffffffff];
}

export type Position = { latitude: number; longitude: number };

/** Un degré de latitude, en mètres. Constante à la précision qui nous occupe. */
const METRES_PAR_DEGRE = 111_320;

/**
 * Déplace une position d'un écart stable, borné par le rayon annoncé.
 *
 * La racine carrée du tirage répartit les points uniformément **en surface**.
 * Sans elle, ils se concentreraient près du centre — et le centre est
 * exactement ce qu'on cherche à ne pas désigner.
 *
 * L'écart maximal vaut le rayon annoncé : le vrai point reste donc à
 * l'intérieur du cercle affiché, ce qui rend le cercle honnête. Un écart plus
 * grand mentirait dans l'autre sens, en montrant une zone qui ne contient pas
 * le matériel.
 */
export function approximerPosition(
  position: Position,
  rayonM: number,
  graine: string,
): Position {
  if (rayonM <= 0) return position;

  const [tirageDistance, tirageAngle] = tirages(graine);

  const distance = Math.sqrt(tirageDistance) * rayonM;
  const angle = tirageAngle * 2 * Math.PI;

  const deltaLatitude = (distance * Math.cos(angle)) / METRES_PAR_DEGRE;

  // Un degré de longitude rétrécit avec la latitude : sans ce cosinus, l'écart
  // vers l'est serait deux fois trop petit à Oslo et presque juste à Lisbonne.
  const cosinus = Math.cos((position.latitude * Math.PI) / 180);
  const deltaLongitude =
    cosinus === 0
      ? 0
      : (distance * Math.sin(angle)) / (METRES_PAR_DEGRE * cosinus);

  return {
    latitude: position.latitude + deltaLatitude,
    longitude: position.longitude + deltaLongitude,
  };
}

/**
 * Distance en mètres entre deux positions — formule de Haversine.
 *
 * Sert aux tests, qui doivent pouvoir affirmer que l'écart reste dans le
 * cercle annoncé.
 */
export function distanceM(a: Position, b: Position): number {
  const rayonTerre = 6_371_000;
  const rad = (degres: number) => (degres * Math.PI) / 180;

  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;

  return 2 * rayonTerre * Math.asin(Math.min(1, Math.sqrt(h)));
}
