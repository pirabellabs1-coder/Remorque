import "server-only";

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

/**
 * Composition des documents PDF.
 *
 * Une mise en page de traitement de texte, pas un moteur : un flux vertical,
 * quelques styles, et le saut de page quand la marge basse est atteinte. Les
 * trois documents de la plateforme — contrat, attestation, constat — sont des
 * pages de texte et de tableaux à deux colonnes ; leur donner un moteur de
 * gabarits reviendrait à écrire un navigateur pour afficher une facture.
 *
 * Helvetica, l'une des quatorze polices standard : aucune n'a besoin d'être
 * incorporée, ce qui garde les fichiers sous quelques kilo-octets et évite de
 * distribuer une fonte dont on n'a pas la licence.
 */

const A4 = { largeur: 595.28, hauteur: 841.89 };
const MARGE = 56;
const NOIR = rgb(0.06, 0.06, 0.06);
const GRIS = rgb(0.42, 0.42, 0.42);
const TRAIT = rgb(0.85, 0.85, 0.85);

/**
 * Les polices standard sont encodées en WinAnsi, qui couvre le français mais
 * pas tout : l'espace insécable fine, le tiret cadratin des claviers récents ou
 * une apostrophe exotique feraient lever pdf-lib **à l'écriture du fichier**,
 * c'est-à-dire au téléchargement, chez l'usager. On ramène donc au représentable
 * plutôt que de risquer un document qui ne s'engendre pas.
 */
function assainir(texte: string): string {
  return texte
    .replace(/[‘’‛]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/[   ]/g, " ")
    .replace(/→/g, "->")
    // Tout ce qui reste hors de WinAnsi : remplacé par un point d'interrogation
    // plutôt que de faire échouer le document entier.
    .replace(/[^\x20-\x7E -ÿ€Œœ]/g, "?");
}

export class Composeur {
  private readonly document: PDFDocument;
  private readonly normale: PDFFont;
  private readonly grasse: PDFFont;
  private page: PDFPage;
  private y: number;

  private constructor(document: PDFDocument, normale: PDFFont, grasse: PDFFont) {
    this.document = document;
    this.normale = normale;
    this.grasse = grasse;
    this.page = document.addPage([A4.largeur, A4.hauteur]);
    this.y = A4.hauteur - MARGE;
  }

  static async creer(): Promise<Composeur> {
    const document = await PDFDocument.create();
    const normale = await document.embedFont(StandardFonts.Helvetica);
    const grasse = await document.embedFont(StandardFonts.HelveticaBold);
    return new Composeur(document, normale, grasse);
  }

  private largeurUtile(): number {
    return A4.largeur - MARGE * 2;
  }

  /** Descend, en ouvrant une page si la marge basse est atteinte. */
  private avancer(hauteur: number): void {
    if (this.y - hauteur < MARGE) {
      this.page = this.document.addPage([A4.largeur, A4.hauteur]);
      this.y = A4.hauteur - MARGE;
    }
    this.y -= hauteur;
  }

  /** Découpe un paragraphe en lignes tenant dans la largeur utile. */
  private decouper(texte: string, police: PDFFont, taille: number): string[] {
    const lignes: string[] = [];

    for (const paragraphe of texte.split("\n")) {
      let courante = "";

      for (const mot of paragraphe.split(" ")) {
        const essai = courante ? `${courante} ${mot}` : mot;
        if (police.widthOfTextAtSize(essai, taille) > this.largeurUtile()) {
          if (courante) lignes.push(courante);
          courante = mot;
        } else {
          courante = essai;
        }
      }

      lignes.push(courante);
    }

    return lignes;
  }

  enTete(titre: string, sousTitre: string): this {
    this.avancer(24);
    this.page.drawText(assainir(titre), {
      x: MARGE,
      y: this.y,
      size: 20,
      font: this.grasse,
      color: NOIR,
    });

    this.avancer(18);
    this.page.drawText(assainir(sousTitre), {
      x: MARGE,
      y: this.y,
      size: 10,
      font: this.normale,
      color: GRIS,
    });

    this.avancer(16);
    this.page.drawLine({
      start: { x: MARGE, y: this.y },
      end: { x: A4.largeur - MARGE, y: this.y },
      thickness: 1,
      color: TRAIT,
    });

    return this;
  }

  titre(texte: string): this {
    this.avancer(26);
    this.page.drawText(assainir(texte), {
      x: MARGE,
      y: this.y,
      size: 12,
      font: this.grasse,
      color: NOIR,
    });
    return this;
  }

  paragraphe(texte: string, options?: { attenue?: boolean }): this {
    const taille = 10;
    for (const ligne of this.decouper(texte, this.normale, taille)) {
      this.avancer(14);
      this.page.drawText(assainir(ligne), {
        x: MARGE,
        y: this.y,
        size: taille,
        font: this.normale,
        color: options?.attenue ? GRIS : NOIR,
      });
    }
    return this;
  }

  /** Tableau à deux colonnes : libellé à gauche, valeur alignée à droite. */
  lignes(entrees: readonly (readonly [string, string])[]): this {
    for (const [libelle, valeur] of entrees) {
      this.avancer(16);
      this.page.drawText(assainir(libelle), {
        x: MARGE,
        y: this.y,
        size: 10,
        font: this.normale,
        color: GRIS,
      });

      const texte = assainir(valeur);
      const largeur = this.grasse.widthOfTextAtSize(texte, 10);
      this.page.drawText(texte, {
        x: A4.largeur - MARGE - largeur,
        y: this.y,
        size: 10,
        font: this.grasse,
        color: NOIR,
      });
    }
    return this;
  }

  separateur(): this {
    this.avancer(14);
    this.page.drawLine({
      start: { x: MARGE, y: this.y },
      end: { x: A4.largeur - MARGE, y: this.y },
      thickness: 0.5,
      color: TRAIT,
    });
    return this;
  }

  espace(hauteur = 10): this {
    this.avancer(hauteur);
    return this;
  }

  /** Mention de bas de document : référence, date d'édition, avertissement. */
  pied(texte: string): this {
    this.avancer(30);
    this.page.drawText(assainir(texte), {
      x: MARGE,
      y: MARGE - 20,
      size: 8,
      font: this.normale,
      color: GRIS,
    });
    return this;
  }

  async rendre(titre: string): Promise<Uint8Array> {
    this.document.setTitle(assainir(titre));
    this.document.setProducer("FlexiTrailer");
    return this.document.save();
  }
}
