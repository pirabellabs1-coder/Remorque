"use server";

import { and, eq, inArray } from "drizzle-orm";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { PIECES, type Piece } from "@/domain/verification/dossier";
import { compteConnecte } from "@/server/authentification/session";
import { db } from "@/server/db";
import {
  fichier,
  journalAudit,
  pieceVerification,
  utilisateur,
} from "@/server/db/schema";
import { typeReel } from "@/server/stockage/signature-image";

/**
 * Dépôt et contrôle des pièces d'un dossier de vérification.
 *
 * **Les octets ne partent pas au stockage objet.** Les photos d'annonce y vont
 * et sont servies par un réseau de diffusion, avec un an de cache : c'est ce
 * qu'il faut pour une remorque, et c'est exactement ce qu'il ne faut pas pour
 * une carte d'identité. Une pièce va donc toujours dans la table `fichier`,
 * même quand les clés S3 sont configurées, et n'est lisible que par la route
 * gardée. Le surcoût est nul à l'échelle qui nous concerne — deux fichiers par
 * compte, lus par un contrôleur et par personne d'autre.
 *
 * **Ce que fait un nouveau dépôt.** Il remet le statut de la pièce à « en
 * attente » et annule les décisions précédentes du même type. Sans cela, un
 * compte refusé qui redépose resterait refusé jusqu'à ce qu'un contrôleur
 * pense à rouvrir son dossier — c'est-à-dire jamais.
 */

export type Reponse = { ok: true } | { ok: false; cle: string };

/** Une pièce photographiée au téléphone tient largement là-dedans. */
const TAILLE_MAXIMUM = 8 * 1024 * 1024;

/* -------------------------------------------------------------------------- */
/*  Côté déposant                                                             */
/* -------------------------------------------------------------------------- */

export async function deposerPieces(donnees: FormData): Promise<Reponse> {
  const moi = await compteConnecte();
  if (!moi) return { ok: false, cle: "connexionRequise" };

  const type = String(donnees.get("type") ?? "") as Piece;
  if (!(PIECES as readonly string[]).includes(type)) {
    return { ok: false, cle: "typeInconnu" };
  }

  const faces: { face: "recto" | "verso"; fichier: File }[] = [];

  for (const face of ["recto", "verso"] as const) {
    const envoye = donnees.get(face);
    if (envoye instanceof File && envoye.size > 0) {
      faces.push({ face, fichier: envoye });
    }
  }

  // Les deux faces sont exigées ensemble : la date de fin de validité et le
  // numéro sont au dos des deux documents, et un contrôleur qui ne voit que
  // l'avant ne peut pas relever ce qui rend la vérification périssable.
  if (faces.length < 2) return { ok: false, cle: "deuxFaces" };

  const preparees: { face: "recto" | "verso"; octets: Uint8Array; mime: string }[] =
    [];

  for (const { face, fichier: envoye } of faces) {
    if (envoye.size > TAILLE_MAXIMUM) return { ok: false, cle: "taille" };

    const octets = new Uint8Array(await envoye.arrayBuffer());
    const reel = typeReel(octets);
    // Le type déclaré par le navigateur ne prouve rien : on lit les premiers
    // octets. Images seulement — une pièce se photographie, et accepter un
    // document arbitraire ouvrirait un dépôt de fichiers sous notre domaine.
    if (!reel) return { ok: false, cle: "type" };

    preparees.push({ face, octets, mime: `image/${reel}` });
  }

  await db.transaction(async (tx) => {
    // Les pièces précédentes du même type sortent de la file : elles sont
    // remplacées, pas complétées. Les laisser ferait décider deux fois.
    await tx
      .update(pieceVerification)
      .set({ statut: "refusee", motif: "Remplacée par un nouveau dépôt" })
      .where(
        and(
          eq(pieceVerification.utilisateurId, moi.id),
          eq(pieceVerification.type, type),
          inArray(pieceVerification.statut, ["en_attente"]),
        ),
      );

    for (const { face, octets, mime } of preparees) {
      const [range] = await tx
        .insert(fichier)
        .values({
          chemin: `verification/${moi.id}/${type}-${face}`,
          typeMime: mime,
          taille: octets.byteLength,
          contenu: octets,
        })
        .returning({ id: fichier.id });

      await tx.insert(pieceVerification).values({
        utilisateurId: moi.id,
        type,
        face,
        chemin: `fichier:${range.id}`,
        typeMime: mime,
      });
    }

    // Le statut du compte repasse en attente, y compris s'il était refusé.
    await tx
      .update(utilisateur)
      .set(
        type === "identite"
          ? { identiteStatut: "en_attente" }
          : { permisStatut: "en_attente" },
      )
      .where(eq(utilisateur.id, moi.id));
  });

  revalidatePath("/", "layout");
  return { ok: true };
}

/* -------------------------------------------------------------------------- */
/*  Côté contrôle                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Accepte ou refuse les pièces d'un type pour un compte.
 *
 * La décision porte sur le dossier, pas sur une face : on n'accepte pas un
 * recto. Elle écrit au journal d'audit avec son auteur, son motif et l'état
 * avant et après — règle 5, et ici plus qu'ailleurs : « qui a validé
 * l'identité de ce compte » est la première question posée le jour où un bien
 * ne revient pas.
 */
export async function deciderDossier(donnees: FormData): Promise<Reponse> {
  const moi = await compteConnecte();
  const controleur =
    moi?.role === "moderateur" || moi?.role === "super_administrateur";
  if (!moi || !controleur) return { ok: false, cle: "droitsInsuffisants" };

  const cible = String(donnees.get("utilisateur") ?? "");
  const type = String(donnees.get("type") ?? "") as Piece;
  const accepte = donnees.get("decision") === "accepter";
  const motif = String(donnees.get("motif") ?? "").trim();

  if (!cible || !(PIECES as readonly string[]).includes(type)) {
    return { ok: false, cle: "requeteInvalide" };
  }

  // Un refus sans motif est un mur sans poignée : l'intéressé ne saurait pas
  // quoi reprendre, et le support recevrait la question à la place.
  if (!accepte && motif.length < 5) return { ok: false, cle: "motifRequis" };

  const [avant] = await db
    .select({
      identiteStatut: utilisateur.identiteStatut,
      permisStatut: utilisateur.permisStatut,
      email: utilisateur.email,
    })
    .from(utilisateur)
    .where(eq(utilisateur.id, cible))
    .limit(1);

  if (!avant) return { ok: false, cle: "compteIntrouvable" };

  /**
   * Date de fin de validité relevée sur la pièce, pour le permis.
   *
   * Facultative : les anciens permis roses n'en portent pas d'exploitable, et
   * refuser faute d'avoir su lire une date punirait le titulaire pour la forme
   * de son document. Le domaine sait déjà traiter une date absente.
   */
  const expire = String(donnees.get("expireLe") ?? "").trim();
  const expireLe = expire ? new Date(expire) : null;
  if (expireLe && Number.isNaN(expireLe.getTime())) {
    return { ok: false, cle: "dateInvalide" };
  }

  const categories = String(donnees.get("categories") ?? "")
    .split(",")
    .map((entree) => entree.trim().toUpperCase())
    .filter(Boolean);

  const apres =
    type === "identite"
      ? {
          identiteStatut: accepte ? ("verifie" as const) : ("refuse" as const),
          identiteVerifieeLe: accepte ? new Date() : null,
        }
      : {
          permisStatut: accepte ? ("verifie" as const) : ("refuse" as const),
          permisExpireLe: accepte ? expireLe : null,
          permisCategories: accepte ? categories : [],
        };

  const entetes = await headers();

  await db.transaction(async (tx) => {
    await tx
      .update(pieceVerification)
      .set({
        statut: accepte ? "acceptee" : "refusee",
        motif: motif || null,
        decideLe: new Date(),
        decideurId: moi.id,
      })
      .where(
        and(
          eq(pieceVerification.utilisateurId, cible),
          eq(pieceVerification.type, type),
          eq(pieceVerification.statut, "en_attente"),
        ),
      );

    await tx.update(utilisateur).set(apres).where(eq(utilisateur.id, cible));

    await tx.insert(journalAudit).values({
      auteurId: moi.id,
      auteurEmail: moi.email,
      action: accepte ? "verification_acceptee" : "verification_refusee",
      entite: "utilisateur",
      entiteId: cible,
      motif: motif || null,
      avant: {
        type,
        statut:
          type === "identite" ? avant.identiteStatut : avant.permisStatut,
      },
      apres: { type, ...apres },
      adresseIp: entetes.get("x-forwarded-for"),
    });
  });

  revalidatePath("/", "layout");
  return { ok: true };
}
