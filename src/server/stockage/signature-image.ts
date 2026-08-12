import "server-only";

/**
 * Reconnaît une image à ses premiers octets.
 *
 * Le type déclaré par le navigateur ne prouve rien : il est fixé par la page
 * qui envoie, donc par quiconque sait faire une requête. Sans cette
 * vérification, le stockage deviendrait un hébergeur de fichiers arbitraires
 * sous notre nom de domaine.
 *
 * La fonction vivait dans le module des photos d'annonce. Le dépôt des pièces
 * d'identité en avait besoin du mot pour mot : la recopier aurait produit deux
 * listes de signatures à tenir à jour, et c'est toujours celle qu'on oublie
 * qui laisse passer quelque chose.
 */
export type FormatImage = "jpeg" | "png" | "webp";

export function typeReel(octets: Uint8Array): FormatImage | null {
  if (octets.length < 12) return null;

  if (octets[0] === 0xff && octets[1] === 0xd8 && octets[2] === 0xff) {
    return "jpeg";
  }

  if (
    octets[0] === 0x89 &&
    octets[1] === 0x50 &&
    octets[2] === 0x4e &&
    octets[3] === 0x47
  ) {
    return "png";
  }

  const texte = (debut: number, fin: number) =>
    String.fromCharCode(...octets.slice(debut, fin));

  if (texte(0, 4) === "RIFF" && texte(8, 12) === "WEBP") return "webp";

  return null;
}
