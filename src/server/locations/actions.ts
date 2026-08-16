"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { POINTS_CONTROLE } from "@/domain/location/constat";
import type { CategoriePermis } from "@/domain/compatibilite/permis";
import {
  manquesDuConducteur,
  QUALITES_CONDUCTEUR,
} from "@/domain/location/conducteur";
import { constatSuffisammentIllustre } from "@/domain/location/medias";
import { compteConnecte } from "@/server/authentification/session";
import { db } from "@/server/db";
import { etatDesLieux, etatDesLieuxPhoto, reservation } from "@/server/db/schema";
import { cheminObjet, deposerObjet } from "@/server/stockage/objets";
import { changerStatut } from "@/server/reservations/transitions";

/**
 * Enregistrement d'un état des lieux.
 *
 * Le constat est contradictoire : il n'est enregistré que signé des deux
 * parties, sur le même appareil, sur le terrain. Un brouillon signé d'un seul
 * côté n'aurait aucune valeur probante et donnerait l'illusion d'une pièce qui
 * n'existe pas — c'est tout ou rien.
 *
 * La machine à états le dit elle-même : « demarrer » suppose l'état des lieux
 * de départ signé, « restituer » celui de retour. Signer le constat **est**
 * l'événement ; la transition s'enchaîne donc ici, par le seul chemin permis
 * (règle 4), jamais par un `UPDATE` direct.
 */

export type Reponse = { ok: true } | { ok: false; cle: string };

/**
 * Dépose un tracé de signature et rend son adresse.
 *
 * Le pavé rend une image encodée en base64 dans une adresse `data:`. On la
 * reconvertit en octets ici plutôt que de stocker la chaîne : une signature
 * pèse quelques dizaines de kilo-octets, et deux par constat, lues à chaque
 * affichage, finiraient par peser plus que le constat lui-même.
 */
async function deposerSignature(
  donneesImage: string,
  reservationId: string,
  partie: "locataire" | "proprietaire",
): Promise<string> {
  const base64 = donneesImage.slice("data:image/png;base64,".length);
  const octets = Uint8Array.from(Buffer.from(base64, "base64"));

  // Privée, comme les pièces du constat : une signature manuscrite se recopie,
  // et une adresse publique la met à portée de qui la trouve.
  return deposerObjet(
    cheminObjet(`signatures/${reservationId}/${partie}`, "png"),
    octets,
    "image/png",
    { prive: true },
  );
}

const schema = z.object({
  reservationId: z.string().uuid(),
  type: z.enum(["depart", "retour"]),
  kilometrage: z.coerce.number().int().min(0).max(1_000_000).nullable(),
  commentaire: z.string().trim().max(2000),
  // Un tracé, non une case cochée. La case prouvait qu'un bouton avait été
  // cliqué sur un appareil, pas qu'une personne avait signé.
  signatureLocataire: z.string().startsWith("data:image/png;base64,"),
  signatureProprietaire: z.string().startsWith("data:image/png;base64,"),
  // Le conducteur n'est relevé qu'au départ : au retour, la remorque revient,
  // et qui la ramène n'engage plus rien de neuf.
  conducteurQualite: z.enum(QUALITES_CONDUCTEUR).optional(),
  conducteurNom: z.string().trim().max(120).optional(),
  conducteurCategories: z.array(z.enum(["B", "B96", "BE"])).optional(),
});

/** Statuts depuis lesquels chaque constat a un sens. */
const STATUTS_PERMIS = {
  // Le départ se constate au retrait ; on tolère la régularisation tardive
  // d'une location déjà partie, jamais d'une location close.
  depart: ["confirmee", "en_cours", "restituee"],
  retour: ["en_cours", "restituee"],
} as const;

export async function enregistrerConstat(donnees: FormData): Promise<Reponse> {
  const moi = await compteConnecte();
  if (!moi) return { ok: false, cle: "connexionRequise" };

  const analyse = schema.safeParse({
    reservationId: donnees.get("reservationId"),
    type: donnees.get("type"),
    kilometrage: String(donnees.get("kilometrage") ?? "") || null,
    commentaire: donnees.get("commentaire") ?? "",
    signatureLocataire: donnees.get("signatureLocataire") ?? "",
    signatureProprietaire: donnees.get("signatureProprietaire") ?? "",
    conducteurQualite: donnees.get("conducteurQualite") ?? undefined,
    conducteurNom: donnees.get("conducteurNom") ?? undefined,
    conducteurCategories: donnees.getAll("conducteurCategories").map(String),
  });

  if (!analyse.success) return { ok: false, cle: "invalide" };
  const { reservationId, type } = analyse.data;

  // Chaque point de contrôle doit avoir été examiné : une valeur absente n'est
  // pas un « conforme » par défaut, c'est un point qu'on n'a pas regardé.
  const controles: Record<string, boolean> = {};
  for (const point of POINTS_CONTROLE) {
    const valeur = donnees.get(`controle_${point}`);
    if (valeur !== "conforme" && valeur !== "defaut") {
      return { ok: false, cle: "invalide" };
    }
    controles[point] = valeur === "conforme";
  }

  // On ne constate que sur sa propre location, dans un état qui s'y prête.
  const [dossier] = await db
    .select({ statut: reservation.statut })
    .from(reservation)
    .where(
      and(
        eq(reservation.id, reservationId),
        eq(reservation.proprietaireId, moi.id),
      ),
    )
    .limit(1);

  if (!dossier) return { ok: false, cle: "interdit" };

  const statut = dossier.statut as string;
  if (!(STATUTS_PERMIS[type] as readonly string[]).includes(statut)) {
    return { ok: false, cle: "statutIncompatible" };
  }

  const existants = await db
    .select({
      id: etatDesLieux.id,
      type: etatDesLieux.type,
      finaliseLe: etatDesLieux.finaliseLe,
    })
    .from(etatDesLieux)
    .where(eq(etatDesLieux.reservationId, reservationId));

  const courant = existants.find((constat) => constat.type === type);

  // **La finalisation fait foi, non l'existence de la ligne.** Depuis que les
  // photos peuvent être déposées avant la signature, un constat existe en
  // brouillon dès la première prise de vue. Refuser sur la seule présence
  // d'une ligne rendrait impossible de signer ce qu'on vient d'illustrer.
  //
  // Un constat *signé*, lui, ne se refait pas : il fait foi, et le corriger
  // relèverait d'un avenant, pas d'un écrasement silencieux.
  if (courant?.finaliseLe) return { ok: false, cle: "dejaRealise" };

  // Le départ d'abord : un retour sans point de comparaison ne prouve rien.
  const depart = existants.find((constat) => constat.type === "depart");
  if (type === "retour" && !depart?.finaliseLe) {
    return { ok: false, cle: "departManquant" };
  }

  // Sans photographies, le constat ne prouve rien : « le plancher était fendu
  // au départ » contre « il ne l'était pas » se tranche par une image, ou ne
  // se tranche pas. L'écran affiche le compte en permanence, pour que le refus
  // ne soit jamais une surprise au moment de signer.
  const pieces = courant
    ? await db
        .select({ type: etatDesLieuxPhoto.media })
        .from(etatDesLieuxPhoto)
        .where(eq(etatDesLieuxPhoto.etatDesLieuxId, courant.id))
    : [];

  if (!constatSuffisammentIllustre(pieces)) {
    return { ok: false, cle: "photosInsuffisantes" };
  }

  // Le conducteur, relevé au départ seulement.
  //
  // C'est ici que se fait le contrôle du permis, et non à la réservation :
  // celui qui réserve n'est pas toujours celui qui conduit, et le propriétaire
  // est le seul à voir à la fois le document et le visage. Une catégorie
  // insuffisante n'interdit pas d'enregistrer le constat — le propriétaire
  // reste maître de sa remorque — mais elle est consignée, et c'est ce qui
  // comptera si l'assureur pose la question.
  if (type === "depart") {
    const conducteur = {
      qualite: analyse.data.conducteurQualite ?? "locataire",
      nom: analyse.data.conducteurNom ?? "",
      categories: (analyse.data.conducteurCategories ?? []) as CategoriePermis[],
      // La photographie du permis compte parmi les pièces du constat : on ne
      // demande pas un second dépôt pour la même image.
      permisPhotographie: pieces.length > 0,
    };

    const manques = manquesDuConducteur(conducteur, "B").filter(
      (manque) => manque !== "categorieInsuffisante",
    );

    if (manques.length > 0) {
      return { ok: false, cle: "conducteurIncomplet" };
    }
  }

  const maintenant = new Date();

  // Les tracés partent au stockage plutôt qu'en base : ce sont des images, et
  // une chaîne de données de plusieurs dizaines de kilo-octets par signature
  // alourdirait chaque lecture du constat pour deux images qu'on ne regarde
  // qu'en cas de litige.
  const [urlLocataire, urlProprietaire] = await Promise.all([
    deposerSignature(analyse.data.signatureLocataire, reservationId, "locataire"),
    deposerSignature(
      analyse.data.signatureProprietaire,
      reservationId,
      "proprietaire",
    ),
  ]);

  const valeurs = {
    controles,
    conducteurQualite:
      type === "depart" ? (analyse.data.conducteurQualite ?? "locataire") : null,
    conducteurNom: type === "depart" ? (analyse.data.conducteurNom ?? null) : null,
    conducteurCategories:
      type === "depart" ? (analyse.data.conducteurCategories ?? []) : [],
    kilometrage: analyse.data.kilometrage,
    commentaire: analyse.data.commentaire || null,
    signatureLocataireUrl: urlLocataire,
    signatureLocataireLe: maintenant,
    signatureProprietaireUrl: urlProprietaire,
    signatureProprietaireLe: maintenant,
    finaliseLe: maintenant,
  };

  if (courant) {
    await db
      .update(etatDesLieux)
      .set(valeurs)
      .where(eq(etatDesLieux.id, courant.id));
  } else {
    await db.insert(etatDesLieux).values({ reservationId, type, ...valeurs });
  }

  // La transition s'enchaîne quand le constat est l'événement qui la fonde.
  // Si la machine la refuse, le constat reste acquis : la pièce signée existe,
  // et l'écran des réservations garde son bouton pour régulariser.
  if (type === "depart" && statut === "confirmee") {
    await changerStatut({
      reservationId,
      evenement: "demarrer",
      acteur: "proprietaire",
      acteurId: moi.id,
      motif: "État des lieux de départ signé des deux parties",
    });
  }

  if (type === "retour" && statut === "en_cours") {
    await changerStatut({
      reservationId,
      evenement: "restituer",
      acteur: "proprietaire",
      acteurId: moi.id,
      motif: "État des lieux de retour signé des deux parties",
    });
  }

  revalidatePath("/[locale]/(espaces)/proprietaire", "layout");
  revalidatePath("/[locale]/(espaces)/compte", "layout");
  return { ok: true };
}
