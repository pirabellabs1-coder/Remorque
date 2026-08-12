import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { and, eq, isNull } from "drizzle-orm";

import {
  expirationDepuis,
  motDePasseRecevable,
  verdictJeton,
  type VerdictJeton,
} from "@/domain/compte/reinitialisation";
import { db } from "@/server/db";
import {
  identifiant,
  jetonUsageUnique,
  notification,
  session,
  utilisateur,
} from "@/server/db/schema";

import { hacherMotDePasse } from "./mots-de-passe";

/**
 * Réinitialisation d'un mot de passe oublié.
 *
 * **Le jeton n'est pas stocké.** Comme pour les sessions, la base ne garde que
 * son empreinte : une fuite de `jeton_usage_unique` ne permet donc de prendre
 * aucun compte. SHA-256 suffit — un tirage de 256 bits n'est pas devinable, il
 * n'y a rien à ralentir.
 *
 * **La demande ne dit jamais si l'adresse existe.** Un formulaire qui répond
 * « compte introuvable » est un annuaire : on y essaie des adresses jusqu'à
 * trouver lesquelles ont un compte, ce qui vaut de l'argent à qui monte une
 * campagne d'hameçonnage. La réponse est la même dans les deux cas, et le
 * travail réel n'a lieu que si le compte existe.
 */

const USAGE = "reinitialisation_mot_de_passe";

function empreinteDe(jeton: string): string {
  return createHash("sha256").update(jeton).digest("hex");
}

/**
 * Ouvre une demande et met le courriel en file.
 *
 * Ne rend rien d'exploitable : ni le jeton, ni l'existence du compte. Le jeton
 * ne sort d'ici que par le courriel — le retourner à l'appelant ferait de la
 * réponse HTTP un canal de prise de compte.
 */
export async function demanderReinitialisation(
  courriel: string,
): Promise<void> {
  const [compte] = await db
    .select({ id: utilisateur.id, prenom: utilisateur.prenom })
    .from(utilisateur)
    .where(
      and(
        eq(utilisateur.email, courriel.trim().toLowerCase()),
        isNull(utilisateur.anonymiseLe),
      ),
    )
    .limit(1);

  if (!compte) return;

  const jeton = randomBytes(32).toString("base64url");
  const maintenant = new Date();

  await db.transaction(async (tx) => {
    // Les demandes précédentes tombent. Sans cela, trois clics sur « Mot de
    // passe oublié » laisseraient trois liens vivants dans trois courriels,
    // dont deux que l'usager croit périmés.
    await tx
      .update(jetonUsageUnique)
      .set({ consommeLe: maintenant })
      .where(
        and(
          eq(jetonUsageUnique.utilisateurId, compte.id),
          eq(jetonUsageUnique.usage, USAGE),
          isNull(jetonUsageUnique.consommeLe),
        ),
      );

    await tx.insert(jetonUsageUnique).values({
      utilisateurId: compte.id,
      usage: USAGE,
      empreinteJeton: empreinteDe(jeton),
      expireLe: expirationDepuis(maintenant),
    });

    // Le lien passe par la file de notifications, comme tout le reste : c'est
    // elle qui porte le rendu traduit et la trace de l'envoi. Le jeton voyage
    // en clair dans les données du courriel — c'est sa raison d'être.
    await tx.insert(notification).values({
      destinataireId: compte.id,
      canal: "courriel",
      gabarit: "reinitialisationMotDePasse",
      donnees: { prenom: compte.prenom ?? "", jeton },
    });
  });
}

/** Ce que vaut un jeton présenté, sans rien y changer. */
export async function examinerJeton(jeton: string): Promise<VerdictJeton> {
  const [ligne] = await db
    .select({
      expireLe: jetonUsageUnique.expireLe,
      consommeLe: jetonUsageUnique.consommeLe,
    })
    .from(jetonUsageUnique)
    .where(
      and(
        eq(jetonUsageUnique.empreinteJeton, empreinteDe(jeton)),
        eq(jetonUsageUnique.usage, USAGE),
      ),
    )
    .limit(1);

  return verdictJeton(ligne ?? null, new Date());
}

export type ResultatReinitialisation =
  | { ok: true }
  | { ok: false; cle: string };

/**
 * Applique le nouveau mot de passe.
 *
 * **Toutes les sessions tombent.** C'est le point le moins évident et le plus
 * important : si le mot de passe est réinitialisé parce que quelqu'un d'autre
 * s'était introduit, le laisser connecté rendrait l'opération inutile. Celui
 * qui change son mot de passe se reconnecte — c'est un petit prix pour la
 * seule garantie qui compte ici.
 *
 * Le jeton est consommé dans la même transaction que l'écriture : deux clics
 * sur le même lien ne peuvent pas produire deux mots de passe.
 */
export async function appliquerNouveauMotDePasse(
  jeton: string,
  motDePasse: string,
): Promise<ResultatReinitialisation> {
  if (!motDePasseRecevable(motDePasse)) {
    return { ok: false, cle: "motDePasseCourt" };
  }

  const empreinte = empreinteDe(jeton);

  const [ligne] = await db
    .select({
      id: jetonUsageUnique.id,
      utilisateurId: jetonUsageUnique.utilisateurId,
      expireLe: jetonUsageUnique.expireLe,
      consommeLe: jetonUsageUnique.consommeLe,
    })
    .from(jetonUsageUnique)
    .where(
      and(
        eq(jetonUsageUnique.empreinteJeton, empreinte),
        eq(jetonUsageUnique.usage, USAGE),
      ),
    )
    .limit(1);

  const verdict = verdictJeton(ligne ?? null, new Date());
  if (!verdict.valide) return { ok: false, cle: verdict.cle };

  const empreinteMotDePasse = await hacherMotDePasse(motDePasse);

  await db.transaction(async (tx) => {
    await tx
      .update(identifiant)
      .set({ empreinte: empreinteMotDePasse })
      .where(
        and(
          eq(identifiant.utilisateurId, ligne.utilisateurId),
          eq(identifiant.fournisseur, "mot_de_passe"),
        ),
      );

    await tx
      .update(jetonUsageUnique)
      .set({ consommeLe: new Date() })
      .where(eq(jetonUsageUnique.id, ligne.id));

    await tx
      .update(session)
      .set({ revoqueeLe: new Date() })
      .where(
        and(
          eq(session.utilisateurId, ligne.utilisateurId),
          isNull(session.revoqueeLe),
        ),
      );
  });

  return { ok: true };
}
