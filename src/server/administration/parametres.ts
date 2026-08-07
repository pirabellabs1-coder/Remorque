"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { compteConnecte } from "@/server/authentification/session";
import { db } from "@/server/db";
import { journalAudit, parametrePlateforme } from "@/server/db/schema";

/**
 * Réglages de la plateforme.
 *
 * Toute modification écrit au journal d'audit avec son auteur, son motif et
 * l'état avant et après — règle 5. C'est plus qu'une formalité ici : ces
 * réglages changent le comportement du site pour tout le monde, et « qui a
 * activé le mode maintenance un mardi soir » est une question qui se pose.
 */

export type Reponse = { ok: true } | { ok: false; cle: string };

const CLES = [
  "nomPlateforme",
  "courrielContact",
  "delaiReponse",
  "delaiAvis",
  "moderationApriori",
  "verificationObligatoire",
] as const;

/** Cases à cocher : absentes du formulaire quand elles sont décochées. */
const BOOLEENS = new Set(["moderationApriori", "verificationObligatoire"]);

export async function lireParametres(): Promise<Record<string, string>> {
  const lignes = await db
    .select({ cle: parametrePlateforme.cle, valeur: parametrePlateforme.valeur })
    .from(parametrePlateforme);

  return Object.fromEntries(lignes.map((ligne) => [ligne.cle, ligne.valeur]));
}

export async function enregistrerParametres(donnees: FormData): Promise<Reponse> {
  const moi = await compteConnecte();
  if (!moi?.role) return { ok: false, cle: "connexionRequise" };

  const avant = await lireParametres();
  const enTetes = await headers();
  const adresseIp = enTetes.get("x-forwarded-for")?.split(",")[0]?.trim();

  const apres: Record<string, string> = {};
  for (const cle of CLES) {
    apres[cle] = BOOLEENS.has(cle)
      ? String(donnees.get(cle) === "on")
      : String(donnees.get(cle) ?? "");
  }

  await db.transaction(async (tx) => {
    for (const [cle, valeur] of Object.entries(apres)) {
      await tx
        .insert(parametrePlateforme)
        .values({ cle, valeur, modifiePar: moi.email })
        .onConflictDoUpdate({
          target: parametrePlateforme.cle,
          set: { valeur, modifiePar: moi.email, modifieLe: new Date() },
        });
    }

    // Une seule entrée d'audit pour l'ensemble : c'est un acte
    // d'administration, non six. Six lignes rendraient le journal illisible
    // sans rien apprendre de plus.
    const changes = Object.keys(apres).filter((cle) => avant[cle] !== apres[cle]);

    if (changes.length > 0) {
      await tx.insert(journalAudit).values({
        auteurId: moi.id,
        auteurEmail: moi.email,
        action: "Réglages de la plateforme modifiés",
        entite: "parametre_plateforme",
        entiteId: changes.join(", "),
        motif: `${changes.length} réglage(s) modifié(s)`,
        avant: Object.fromEntries(changes.map((cle) => [cle, avant[cle] ?? null])),
        apres: Object.fromEntries(changes.map((cle) => [cle, apres[cle]])),
        adresseIp,
      });
    }
  });

  revalidatePath("/[locale]/(espaces)/admin", "layout");
  return { ok: true };
}
