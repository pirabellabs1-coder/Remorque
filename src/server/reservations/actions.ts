"use server";

import { revalidatePath } from "next/cache";

import type { Evenement } from "@/domain/reservation/machine";
import { compteConnecte } from "@/server/authentification/session";

import { demanderReservation } from "./demande";
import { changerStatut } from "./transitions";

/**
 * Actions de réservation.
 *
 * Elles ne décident de rien : la validité d'une demande relève de
 * `demande.ts`, la légitimité d'une transition de la machine à états. Ce
 * fichier lit la session, appelle, et rafraîchit les écrans concernés.
 *
 * Toutes renvoient un résultat plutôt que de lever. Une demande refusée parce
 * que les dates sont prises est un cas ordinaire du parcours, pas une panne — et
 * le message doit pouvoir être traduit, ce qu'une exception ne permet pas.
 */

export type Reponse = { ok: true; message?: string } | { ok: false; cle: string };

export async function reserver(donnees: FormData): Promise<Reponse> {
  const moi = await compteConnecte();
  if (!moi) return { ok: false, cle: "connexionRequise" };

  const annonceId = String(donnees.get("annonceId") ?? "");
  const debut = new Date(String(donnees.get("debut") ?? ""));
  const fin = new Date(String(donnees.get("fin") ?? ""));

  if (!annonceId || Number.isNaN(debut.getTime()) || Number.isNaN(fin.getTime())) {
    return { ok: false, cle: "datesManquantes" };
  }

  const resultat = await demanderReservation({
    annonceId,
    locataireId: moi.id,
    debut,
    fin,
  });

  if (!resultat.ok) return resultat;

  // Les deux espaces changent : le locataire voit sa demande, le loueur la
  // reçoit. Sans invalidation, l'un comme l'autre verraient la version en
  // cache jusqu'au prochain rechargement complet.
  revalidatePath("/[locale]/(espaces)/compte", "layout");
  revalidatePath("/[locale]/(espaces)/proprietaire", "layout");

  return { ok: true, message: resultat.numero };
}

/**
 * Fait franchir une étape à une réservation.
 *
 * L'acteur est déduit de la session et du rôle réel sur cette réservation
 * précise, jamais transmis par le formulaire : un champ caché « acteur » se
 * modifie depuis le navigateur, et permettrait à un locataire d'accepter sa
 * propre demande.
 */
export async function franchir(donnees: FormData): Promise<Reponse> {
  const moi = await compteConnecte();
  if (!moi) return { ok: false, cle: "connexionRequise" };

  const reservationId = String(donnees.get("reservationId") ?? "");
  const evenement = String(donnees.get("evenement") ?? "") as Evenement;
  const motif = String(donnees.get("motif") ?? "") || undefined;
  const role = String(donnees.get("role") ?? "locataire");

  if (!reservationId || !evenement) return { ok: false, cle: "invalide" };

  const resultat = await changerStatut({
    reservationId,
    evenement,
    acteur: role === "proprietaire" ? "proprietaire" : "locataire",
    acteurId: moi.id,
    motif,
  });

  if (!resultat.ok) return { ok: false, cle: resultat.motif };

  revalidatePath("/[locale]/(espaces)/compte", "layout");
  revalidatePath("/[locale]/(espaces)/proprietaire", "layout");

  return { ok: true };
}
