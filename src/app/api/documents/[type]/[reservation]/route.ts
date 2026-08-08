import { DEFAULT_MARKET, ENABLED_MARKETS, type Market } from "@/config/markets";
import { compteConnecte } from "@/server/authentification/session";
import { constatsDuDossier, dossierDocument } from "@/server/documents/depot";
import { factureDuDossier } from "@/server/documents/facture";
import {
  attestationAssurance,
  constatPdf,
  contratDeLocation,
  facturePdf,
} from "@/server/documents/generateurs";

/**
 * Téléchargement des documents de la location.
 *
 * Une route plutôt qu'un fichier stocké : le document est engendré à la demande
 * et reflète donc toujours la base. `dossierDocument` refuse déjà le dossier
 * dont on n'est pas partie — la garde est dans la lecture, pas ici, pour qu'on
 * ne puisse pas ajouter un appelant en oubliant le contrôle.
 *
 * Hors du segment `[locale]` : le proxy de `next-intl` ignore `/api`. La langue
 * du document est donc lue dans la requête, avec le marché par défaut en
 * dernier recours.
 */

const TYPES = ["contrat", "attestation", "constat", "facture"] as const;
type TypeDocument = (typeof TYPES)[number];

function estType(valeur: string): valeur is TypeDocument {
  return (TYPES as readonly string[]).includes(valeur);
}

function langueDemandee(url: URL): Market {
  const demandee = url.searchParams.get("langue");
  return (ENABLED_MARKETS as readonly string[]).includes(demandee ?? "")
    ? (demandee as Market)
    : DEFAULT_MARKET;
}

export async function GET(
  requete: Request,
  { params }: { params: Promise<{ type: string; reservation: string }> },
) {
  const { type, reservation } = await params;

  if (!estType(type)) {
    return new Response(null, { status: 404 });
  }

  const dossier = await dossierDocument(reservation);
  // Introuvable et interdit rendent la même chose : un 403 distinct
  // apprendrait à un curieux que la réservation existe.
  if (!dossier) return new Response(null, { status: 404 });

  const locale = langueDemandee(new URL(requete.url));

  // Le reçu n'existe que si une facture a été émise, et seulement pour son
  // destinataire : le propriétaire, lui, n'a pas à lire le reçu du locataire.
  if (type === "facture") {
    const moi = await compteConnecte();
    const document = moi ? await factureDuDossier(reservation, moi.id) : null;
    if (!document) return new Response(null, { status: 404 });

    return reponsePdf(await facturePdf(document, locale), `facture-${document.numero}`);
  }

  const pdf =
    type === "contrat"
      ? await contratDeLocation(dossier, locale)
      : type === "attestation"
        ? await attestationAssurance(dossier, locale)
        : await constatPdf(dossier, await constatsDuDossier(reservation), locale);

  return reponsePdf(pdf, `${type}-${dossier.numero}`);
}

function reponsePdf(pdf: Uint8Array, nom: string): Response {
  return new Response(pdf as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${nom}.pdf"`,
      // Jamais mis en cache par un intermédiaire : le document nomme les
      // parties et porte des montants.
      "Cache-Control": "private, no-store",
    },
  });
}
