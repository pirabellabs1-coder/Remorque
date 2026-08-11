/**
 * Référence publique d'une annonce.
 *
 * Un identifiant à montrer et à dire. L'identifiant technique est un UUID :
 * trente-six caractères qu'on ne lit pas au téléphone, qu'on ne recopie pas
 * sans faute et qu'on n'imprime pas sur un autocollant. Il en faut une forme
 * courte — pour l'assistance, pour le constat au départ, pour le code QR collé
 * sur le timon.
 *
 * **Elle est dérivée, non stockée.** C'est un choix, et voici son revers.
 *
 * L'avantage : rien à écrire en base, rien à sauvegarder, rien à réconcilier,
 * et surtout aucune valeur à générer — donc aucune occasion qu'une annonce
 * naisse sans référence ou en change. Elle est stable par construction, un
 * UUID ne bougeant jamais.
 *
 * Le revers : deux UUID peuvent commencer par les mêmes trente-deux bits. Sur
 * quatre milliards de valeurs possibles et quelques milliers d'annonces, la
 * probabilité est de l'ordre du cent-millième. Une collision ne casse rien —
 * l'adresse publique reste le slug, l'identifiant reste l'UUID — elle rendrait
 * seulement une recherche par référence ambiguë à l'assistance. Le jour où ce
 * risque cesse d'être théorique, la référence reste **réversible** vers le
 * début de l'UUID : un index d'expression suffit alors à la rendre
 * recherchable, sans changer une seule valeur déjà affichée ou imprimée.
 */

/** Préfixe de marque, pour qu'une référence lue seule dise d'où elle vient. */
const PREFIXE = "FT";

/**
 * Référence lisible d'une annonce, de la forme `FT-3F7A-91C2`.
 *
 * L'hexadécimal plutôt qu'un alphabet plus dense : il se dicte sans
 * ambiguïté, il se retrouve tel quel au début de l'identifiant technique, et
 * personne n'a besoin d'une table de correspondance pour faire le lien.
 */
export function referenceAnnonce(identifiant: string): string {
  const brut = identifiant.replace(/-/g, "").slice(0, 8).toUpperCase();

  if (brut.length < 8) {
    throw new Error(`Identifiant d'annonce inattendu : ${identifiant}`);
  }

  return `${PREFIXE}-${brut.slice(0, 4)}-${brut.slice(4, 8)}`;
}

/**
 * Le début d'UUID que désigne une référence, ou `null`.
 *
 * C'est ce qui rend la dérivation réversible : l'assistance saisit
 * « FT-3F7A-91C2 », on en retire les huit caractères hexadécimaux et l'on
 * cherche les identifiants qui commencent par eux.
 */
export function debutIdentifiantDepuisReference(
  reference: string,
): string | null {
  const nettoyee = reference.trim().toUpperCase().replace(/[\s-]/g, "");
  const attendu = new RegExp(`^${PREFIXE}([0-9A-F]{8})$`);
  const trouve = attendu.exec(nettoyee);

  return trouve ? trouve[1].toLowerCase() : null;
}
