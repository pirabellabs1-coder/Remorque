"use server";

import { headers } from "next/headers";
import { z } from "zod";

import {
  appliquerNouveauMotDePasse,
  demanderReinitialisation,
} from "./reinitialisation";
import { consignerTentative, tentativeAutorisee } from "./limitation";

/**
 * Actions du parcours « mot de passe oublié ».
 *
 * Elles rendent un résultat plutôt que de lever : un lien périmé est un cas
 * ordinaire du parcours, pas une panne.
 */

export type Resultat =
  | { ok: true }
  | { ok: false; cle: string; secondes?: number };

const schemaDemande = z.object({
  email: z
    .string()
    .email()
    .transform((valeur) => valeur.trim().toLowerCase()),
});

/**
 * Ouvre une demande.
 *
 * **Répond toujours la même chose.** Que l'adresse ait un compte ou non, le
 * message est « si un compte existe, un courriel part ». Un formulaire qui
 * répondrait « compte introuvable » serait un annuaire d'adresses valides,
 * offert à qui monte une campagne d'hameçonnage.
 *
 * La limitation de débit est celle de la connexion, et pour la même raison :
 * sans elle, ce formulaire devient un moyen d'inonder de courriels une boîte
 * qu'on n'aime pas, en notre nom.
 */
export async function demanderLien(donnees: FormData): Promise<Resultat> {
  const analyse = schemaDemande.safeParse({ email: donnees.get("email") });
  // Même une adresse mal formée reçoit la réponse neutre : dire « adresse
  // invalide » d'un côté et « courriel envoyé » de l'autre suffirait à
  // distinguer les deux cas.
  if (!analyse.success) return { ok: true };

  const enTetes = await headers();
  const adresseIp =
    enTetes.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined;

  const verdict = await tentativeAutorisee(analyse.data.email, adresseIp);
  if (!verdict.autorise) {
    return {
      ok: false,
      cle: "tropDeTentatives",
      secondes: verdict.secondesAvant,
    };
  }

  // Consignée comme une tentative infructueuse : c'est ce qui alimente le
  // compteur. Une demande de lien n'est pas une connexion réussie, et compter
  // autrement laisserait le formulaire sans plafond.
  await consignerTentative(analyse.data.email, adresseIp, false);

  await demanderReinitialisation(analyse.data.email);
  return { ok: true };
}

const schemaNouveau = z.object({
  jeton: z.string().min(1),
  motDePasse: z.string().min(1),
});

/** Applique le nouveau mot de passe, si le jeton l'autorise encore. */
export async function definirNouveauMotDePasse(
  donnees: FormData,
): Promise<Resultat> {
  const analyse = schemaNouveau.safeParse({
    jeton: donnees.get("jeton"),
    motDePasse: donnees.get("motDePasse"),
  });

  if (!analyse.success) return { ok: false, cle: "invalide" };

  return appliquerNouveauMotDePasse(
    analyse.data.jeton,
    analyse.data.motDePasse,
  );
}
