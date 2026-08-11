import "server-only";

import { cache } from "react";
import QRCode from "qrcode";

/**
 * Code QR d'une annonce.
 *
 * Il encode l'adresse publique de la fiche, rien d'autre : pas d'identifiant
 * technique, pas de paramètre de suivi. Un code QR se photocopie, se colle sur
 * un timon et survit à la plateforme — il ne doit donc contenir que ce qui
 * restera vrai, c'est-à-dire l'adresse canonique.
 *
 * Rendu en SVG et non en image matricielle : quelques centaines d'octets
 * inclus directement dans la page, nets à toute taille, y compris imprimés en
 * grand sur un autocollant. Aucune requête supplémentaire, aucun fichier à
 * stocker.
 *
 * Correction d'erreur au niveau moyen : un code QR reste lisible avec 15 % de
 * sa surface abîmée. Sur une remorque qui prend la boue et le gravier, c'est
 * le minimum ; le niveau supérieur densifierait le motif sans gagner grand
 * chose à cette taille.
 *
 * Mémorisé par requête : la fiche affiche le code, et le téléchargement le
 * redemande. Le calculer deux fois n'aurait aucun sens.
 */
export const codeQrSvg = cache(async (adresse: string): Promise<string> => {
  return QRCode.toString(adresse, {
    type: "svg",
    errorCorrectionLevel: "M",
    // Marge de deux modules au lieu de quatre : la « zone calme » exigée par
    // la norme est de quatre, mais nous encadrons déjà le code d'un blanc
    // généreux en CSS. Quatre modules de plus rétréciraient le motif utile.
    margin: 2,
    color: {
      // Noir sur blanc, en dur et non en jeton de design : un code QR gris sur
      // fond sombre ne se lit pas, et il doit rester lisible une fois imprimé
      // en noir et blanc comme en thème sombre.
      dark: "#000000",
      light: "#ffffff",
    },
  });
});
