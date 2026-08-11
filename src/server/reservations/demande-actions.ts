"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/server/db";
import { utilisateur } from "@/server/db/schema";
import { compteConnecte } from "@/server/authentification/session";

import { demanderReservation } from "./demande";

/**
 * Demande de location : les coordonnées du preneur, puis la réservation.
 *
 * Jusqu'ici, réserver se faisait d'un bouton depuis la fiche : deux dates et
 * c'était parti. Cela suffit à créer une ligne, pas à louer une remorque. Le
 * contrat de location, la facture et l'attestation d'assurance nomment un
 * preneur et le situent — sans adresse, aucune des trois n'est émettable, et
 * le propriétaire remet un bien de plusieurs milliers d'euros à quelqu'un dont
 * il ne sait rien.
 *
 * Les coordonnées sont demandées **ici et non à l'inscription** : rien ne les
 * justifie tant qu'on se contente de regarder le catalogue, et un formulaire
 * d'inscription long fait fuir. Elles sont ensuite conservées sur le compte,
 * si bien que la deuxième location ne les redemande pas.
 *
 * Les erreurs reviennent champ par champ plutôt que par une redirection : un
 * formulaire de dix champs qui se vide sur une faute de frappe au téléphone
 * est un formulaire qu'on abandonne.
 */

const schema = z.object({
  prenom: z.string().trim().min(2, "prenom").max(60),
  nom: z.string().trim().min(2, "nom").max(60),
  // Volontairement permissif : les formats nationaux varient, l'indicatif est
  // parfois omis, et le numéro sera de toute façon vérifié par SMS avant la
  // remise des clés. Refuser ici sur une expression trop stricte écarterait
  // des numéros valides.
  telephone: z.string().trim().min(6, "telephone").max(30),
  adresseLigne1: z.string().trim().min(4, "adresseLigne1").max(120),
  adresseLigne2: z.string().trim().max(120).optional(),
  codePostal: z.string().trim().min(3, "codePostal").max(12),
  ville: z.string().trim().min(2, "ville").max(80),
  message: z.string().trim().max(1000).optional(),
  conditions: z.literal("on", { message: "conditions" }),
});

export type EtatDemande =
  | { statut: "inactif" }
  | { statut: "erreur"; champs: Record<string, string>; general?: string }
  | { statut: "envoyee"; numero: string };

export async function demanderLocation(
  _precedent: EtatDemande,
  donnees: FormData,
): Promise<EtatDemande> {
  const moi = await compteConnecte();
  if (!moi) {
    return { statut: "erreur", champs: {}, general: "connexionRequise" };
  }

  const analyse = schema.safeParse({
    prenom: donnees.get("prenom"),
    nom: donnees.get("nom"),
    telephone: donnees.get("telephone"),
    adresseLigne1: donnees.get("adresseLigne1"),
    adresseLigne2: donnees.get("adresseLigne2") || undefined,
    codePostal: donnees.get("codePostal"),
    ville: donnees.get("ville"),
    message: donnees.get("message") || undefined,
    conditions: donnees.get("conditions"),
  });

  if (!analyse.success) {
    // Un message par champ : le formulaire les affiche sous chacun, et rien
    // de ce qui a été saisi n'est perdu.
    const champs: Record<string, string> = {};
    for (const probleme of analyse.error.issues) {
      const champ = String(probleme.path[0] ?? "");
      if (champ && !champs[champ]) champs[champ] = champ;
    }
    return { statut: "erreur", champs };
  }

  const annonceId = String(donnees.get("annonceId") ?? "");
  const debut = new Date(String(donnees.get("debut") ?? ""));
  const fin = new Date(String(donnees.get("fin") ?? ""));

  if (!annonceId || Number.isNaN(debut.getTime()) || Number.isNaN(fin.getTime())) {
    return { statut: "erreur", champs: {}, general: "datesManquantes" };
  }

  const valeurs = analyse.data;

  // Les coordonnées sont enregistrées avant la demande : si la réservation
  // échoue — dates prises entre-temps, durée hors bornes —, la personne n'a
  // pas à tout ressaisir pour retenter d'autres dates.
  await db
    .update(utilisateur)
    .set({
      prenom: valeurs.prenom,
      nom: valeurs.nom,
      telephone: valeurs.telephone,
      adresseLigne1: valeurs.adresseLigne1,
      adresseLigne2: valeurs.adresseLigne2 ?? null,
      codePostal: valeurs.codePostal,
      ville: valeurs.ville,
    })
    .where(eq(utilisateur.id, moi.id));

  const resultat = await demanderReservation({
    annonceId,
    locataireId: moi.id,
    debut,
    fin,
  });

  if (!resultat.ok) {
    return { statut: "erreur", champs: {}, general: resultat.cle };
  }

  // Les deux espaces changent : le locataire voit sa demande, le loueur la
  // reçoit. Sans invalidation, l'un comme l'autre verraient la version en
  // cache jusqu'au prochain rechargement complet.
  revalidatePath("/[locale]/(espaces)/compte", "layout");
  revalidatePath("/[locale]/(espaces)/proprietaire", "layout");

  return { statut: "envoyee", numero: resultat.numero };
}
