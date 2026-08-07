"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { compteConnecte } from "@/server/authentification/session";
import { db } from "@/server/db";
import { utilisateur, vehiculeTracteur } from "@/server/db/schema";

/**
 * Enregistrement du profil et des préférences.
 *
 * Ces cinq formulaires — profil et paramètres, dans les trois espaces —
 * affichaient un bouton « Enregistrer » qui ne faisait rien. On saisissait, on
 * validait, rien n'était écrit, et rien ne le disait. C'est pire qu'un écran
 * absent : l'usager croit avoir renseigné son véhicule, et découvre à la
 * réservation suivante que la plateforme ne le connaît pas.
 *
 * Chaque action renvoie un résultat traduisible plutôt que de lever : une
 * saisie invalide est un cas ordinaire, pas une panne.
 */

export type Reponse = { ok: true } | { ok: false; cle: string };

/** Chaîne facultative : un champ vide devient `null`, non une chaîne vide. */
const texteFacultatif = z
  .string()
  .trim()
  .max(120)
  .transform((valeur) => valeur || null)
  .nullable()
  .optional();

const schemaIdentite = z.object({
  prenom: z.string().trim().min(1).max(80),
  nom: texteFacultatif,
  telephone: texteFacultatif,
});

export async function enregistrerIdentite(donnees: FormData): Promise<Reponse> {
  const moi = await compteConnecte();
  if (!moi) return { ok: false, cle: "connexionRequise" };

  const analyse = schemaIdentite.safeParse({
    prenom: donnees.get("prenom"),
    nom: donnees.get("nom"),
    telephone: donnees.get("telephone"),
  });

  if (!analyse.success) return { ok: false, cle: "invalide" };

  // L'adresse électronique n'est **pas** modifiable ici : elle sert
  // d'identifiant de connexion, et la changer sans revérification permettrait
  // de détourner un compte dont on a obtenu la session un instant.
  await db
    .update(utilisateur)
    .set({
      prenom: analyse.data.prenom,
      nom: analyse.data.nom ?? null,
      telephone: analyse.data.telephone ?? null,
      modifieLe: new Date(),
    })
    .where(eq(utilisateur.id, moi.id));

  revalidatePath("/[locale]/(espaces)", "layout");
  return { ok: true };
}

/**
 * Véhicule tracteur.
 *
 * Ce n'est pas une coquetterie de formulaire : c'est l'entrée du moteur de
 * compatibilité. Les masses saisies décident quelles annonces sont proposées,
 * et une valeur fausse fait apparaître du matériel que le véhicule ne peut pas
 * tirer.
 */
const schemaVehicule = z.object({
  marque: z.string().trim().min(1).max(60),
  modele: z.string().trim().min(1).max(60),
  immatriculation: texteFacultatif,
  ptacKg: z.coerce.number().int().min(500).max(7_500),
  tractableFreineKg: z.coerce.number().int().min(0).max(3_500),
  tractableNonFreineKg: z.coerce.number().int().min(0).max(750),
  faisceauBroches: z.coerce.number().int().refine((valeur) => valeur === 7 || valeur === 13),
});

export async function enregistrerVehicule(donnees: FormData): Promise<Reponse> {
  const moi = await compteConnecte();
  if (!moi) return { ok: false, cle: "connexionRequise" };

  const analyse = schemaVehicule.safeParse({
    marque: donnees.get("marque"),
    modele: donnees.get("modele"),
    immatriculation: donnees.get("immatriculation"),
    ptacKg: donnees.get("ptacVehicule"),
    tractableFreineKg: donnees.get("tractableFreine"),
    tractableNonFreineKg: donnees.get("tractableNonFreine"),
    faisceauBroches: donnees.get("faisceau"),
  });

  if (!analyse.success) return { ok: false, cle: "vehiculeInvalide" };

  // La masse non freinée dépasse rarement la moitié de la freinée, et jamais
  // celle-ci. Une inversion des deux champs est l'erreur de saisie la plus
  // courante, et elle rendrait la compatibilité fausse dans le sens permissif.
  if (analyse.data.tractableNonFreineKg > analyse.data.tractableFreineKg) {
    return { ok: false, cle: "massesInversees" };
  }

  const [existant] = await db
    .select({ id: vehiculeTracteur.id })
    .from(vehiculeTracteur)
    .where(
      and(
        eq(vehiculeTracteur.utilisateurId, moi.id),
        eq(vehiculeTracteur.principal, true),
      ),
    )
    .limit(1);

  if (existant) {
    await db
      .update(vehiculeTracteur)
      .set({ ...analyse.data, modifieLe: new Date() })
      .where(eq(vehiculeTracteur.id, existant.id));
  } else {
    await db
      .insert(vehiculeTracteur)
      .values({ ...analyse.data, utilisateurId: moi.id, principal: true });
  }

  revalidatePath("/[locale]/(espaces)", "layout");
  return { ok: true };
}

/**
 * Préférences de notification.
 *
 * Les cases absentes du formulaire valent « décochée » : un formulaire HTML
 * n'envoie pas les cases non cochées, et lire seulement ce qui arrive
 * reviendrait à ne jamais pouvoir en désactiver une.
 */
export async function enregistrerPreferences(donnees: FormData): Promise<Reponse> {
  const moi = await compteConnecte();
  if (!moi) return { ok: false, cle: "connexionRequise" };

  const CLES = [
    "reservations-courriel",
    "reservations-sms",
    "messagesNotif-courriel",
    "messagesNotif-sms",
    "cautions-courriel",
    "cautions-sms",
    "promotions-courriel",
    "promotions-sms",
  ];

  const preferences: Record<string, boolean> = {};
  for (const cle of CLES) preferences[cle] = donnees.get(cle) === "on";

  await db
    .update(utilisateur)
    .set({ preferences, modifieLe: new Date() })
    .where(eq(utilisateur.id, moi.id));

  revalidatePath("/[locale]/(espaces)", "layout");
  return { ok: true };
}

/** Les préférences du compte, complétées par les valeurs par défaut. */
export async function lirePreferences(): Promise<Record<string, boolean>> {
  const moi = await compteConnecte();
  if (!moi) return {};

  const [ligne] = await db
    .select({ preferences: utilisateur.preferences })
    .from(utilisateur)
    .where(eq(utilisateur.id, moi.id))
    .limit(1);

  const stockees = (ligne?.preferences ?? {}) as Record<string, boolean>;

  // Les notifications liées à une réservation en cours sont actives par
  // défaut : les couper ferait manquer un retrait, et personne ne va les
  // chercher pour les activer.
  const DEFAUTS: Record<string, boolean> = {
    "reservations-courriel": true,
    "reservations-sms": true,
    "messagesNotif-courriel": true,
    "messagesNotif-sms": false,
    "cautions-courriel": true,
    "cautions-sms": false,
    "promotions-courriel": false,
    "promotions-sms": false,
  };

  return { ...DEFAUTS, ...stockees };
}

/** Le véhicule principal du compte, s'il en a déclaré un. */
export async function lireVehicule() {
  const moi = await compteConnecte();
  if (!moi) return null;

  const [ligne] = await db
    .select()
    .from(vehiculeTracteur)
    .where(
      and(
        eq(vehiculeTracteur.utilisateurId, moi.id),
        eq(vehiculeTracteur.principal, true),
      ),
    )
    .limit(1);

  return ligne ?? null;
}
