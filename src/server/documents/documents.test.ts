import { inflateSync } from "node:zlib";

import { describe, expect, it } from "vitest";

import { POINTS_CONTROLE } from "@/domain/location/constat";
import type { ConstatDocument, DossierDocument } from "./depot";
import {
  attestationAssurance,
  constatPdf,
  contratDeLocation,
} from "./generateurs";

/**
 * Ce que ces tests protègent : que le document s'engendre, et qu'il ne mente
 * pas par omission.
 *
 * Le piège des documents PDF n'est pas la mise en page, c'est le caractère
 * qu'une police standard ne sait pas écrire : pdf-lib lève **à l'écriture du
 * fichier**, donc au téléchargement, chez l'usager. Un titre d'annonce avec une
 * espace insécable fine suffirait. On engendre donc pour de bon, avec des
 * données hostiles.
 */

const DOSSIER: DossierDocument = {
  numero: "FT-2026-0042",
  statut: "confirmee",
  debut: new Date("2026-09-04T08:00:00Z"),
  fin: new Date("2026-09-06T18:00:00Z"),
  nombreJours: 2,
  devise: "EUR",
  loyer: 7000,
  fraisService: 840,
  totalLocataire: 7840,
  caution: 40000,
  // Guillemets courbes, tiret cadratin, points de suspension, espace fine :
  // tout ce qui échappe à l'encodage des polices standard.
  annonceTitre: "Benne « basculante » 750 kg — modèle 2024…",
  annonceVille: "Bruxelles",
  ptacKg: 750,
  chargeUtileKg: 500,
  locataireNom: "Élodie Vasseur",
  proprietaireNom: "Yanis Benali",
  paysNom: "Belgique",
  assureurNom: "Assureur partenaire",
  confirmeeLe: new Date("2026-08-20T10:00:00Z"),
  jeSuisLocataire: true,
};

const CONSTATS: ConstatDocument[] = [
  {
    type: "depart",
    controles: Object.fromEntries(POINTS_CONTROLE.map((point) => [point, true])),
    kilometrage: 12480,
    commentaire: "Matériel conforme, feux vérifiés au départ.",
    signatureLocataireLe: new Date("2026-09-04T08:10:00Z"),
    signatureProprietaireLe: new Date("2026-09-04T08:10:00Z"),
    finaliseLe: new Date("2026-09-04T08:10:00Z"),
  },
  {
    type: "retour",
    controles: { ...Object.fromEntries(POINTS_CONTROLE.map((p) => [p, true])), feux: false },
    kilometrage: 12610,
    commentaire: "Feu arrière gauche endommagé, constaté au retour.",
    signatureLocataireLe: new Date("2026-09-06T18:05:00Z"),
    signatureProprietaireLe: new Date("2026-09-06T18:05:00Z"),
    finaliseLe: new Date("2026-09-06T18:05:00Z"),
  },
];

/** Un PDF valide commence par « %PDF- » et finit par « %%EOF ». */
function estPdf(octets: Uint8Array): boolean {
  const texte = Buffer.from(octets).toString("latin1");
  return texte.startsWith("%PDF-") && texte.trimEnd().endsWith("%%EOF");
}

/**
 * Le texte des flux de contenu, décompressé.
 *
 * Vérifier que le fichier s'engendre ne dit pas qu'il porte les bonnes
 * phrases : un gabarit dont la clé de traduction manque produirait un PDF
 * parfaitement valide affichant « documents.contrat.titre ».
 */
function texteDuPdf(octets: Uint8Array): string {
  const brut = Buffer.from(octets);
  const chaine = brut.toString("latin1");
  const morceaux: string[] = [];

  let position = 0;
  while (true) {
    const debut = chaine.indexOf("stream", position);
    if (debut < 0) break;

    const apres = chaine[debut + 6] === "\r" ? debut + 8 : debut + 7;
    const fin = chaine.indexOf("endstream", apres);
    if (fin < 0) break;
    position = fin;

    const flux = brut.subarray(apres, fin);
    try {
      morceaux.push(inflateSync(flux).toString("latin1"));
    } catch {
      morceaux.push(flux.toString("latin1"));
    }
  }

  // pdf-lib écrit les chaînes en hexadécimal — « <48656C6C6F> Tj » — et non
  // entre parenthèses : les octets sont ceux de l'encodage WinAnsi, que
  // `latin1` restitue pour tout ce que le français emploie.
  return [...morceaux.join("\n").matchAll(/<([0-9A-Fa-f]+)>\s*Tj/g)]
    .map((occurrence) => Buffer.from(occurrence[1], "hex").toString("latin1"))
    .join("\n");
}

describe("documents PDF", () => {
  it("engendre un contrat lisible malgré les caractères hostiles", async () => {
    const pdf = await contratDeLocation(DOSSIER);
    expect(estPdf(pdf)).toBe(true);
    expect(pdf.byteLength).toBeGreaterThan(1000);
  });

  it("écrit les phrases traduites, non les clés de traduction", async () => {
    const texte = texteDuPdf(await contratDeLocation(DOSSIER));

    // Une clé absente ressort telle quelle : c'est ce que l'assertion attrape.
    expect(texte).not.toContain("documents.");
    expect(texte).toContain("Contrat de location");
    expect(texte).toContain(DOSSIER.numero);
    expect(texte).toContain(DOSSIER.locataireNom);
    expect(texte).toContain(DOSSIER.proprietaireNom);
  });

  it("porte les montants du dossier, jamais recalculés", async () => {
    const texte = texteDuPdf(await contratDeLocation(DOSSIER));

    // 7 840 centimes affichés « 78,40 € », et la caution « 400,00 € ». Un
    // document qui recalculerait à partir du loyer divergerait de la
    // comptabilité au premier changement de barème.
    expect(texte).toContain("78,40");
    expect(texte).toContain("400,00");
  });

  it("engendre une attestation d'assurance", async () => {
    const pdf = await attestationAssurance(DOSSIER);
    expect(estPdf(pdf)).toBe(true);
  });

  it("dit franchement qu'aucun assureur n'est renseigné", async () => {
    // Le document doit rester engendrable **et** ne pas se faire passer pour
    // une couverture réelle : la mention remplace le blanc.
    const pdf = await attestationAssurance({ ...DOSSIER, assureurNom: null });
    expect(estPdf(pdf)).toBe(true);
  });

  it("engendre le constat des deux états des lieux", async () => {
    const pdf = await constatPdf(DOSSIER, CONSTATS);
    expect(estPdf(pdf)).toBe(true);
  });

  it("engendre un constat même sans aucun état des lieux signé", async () => {
    const pdf = await constatPdf(DOSSIER, []);
    expect(estPdf(pdf)).toBe(true);
  });

  it("engendre un contrat sur une réservation non confirmée", async () => {
    // Le cas où `confirmeeLe` est nul : le document doit le signaler plutôt
    // que d'imprimer une date vide.
    const pdf = await contratDeLocation({ ...DOSSIER, confirmeeLe: null });
    expect(estPdf(pdf)).toBe(true);
  });
});
