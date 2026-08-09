"use server";

import { and, eq, inArray } from "drizzle-orm";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { effetsDecision, type EffetsDecision } from "@/domain/litige/decision";
import {
  evaluerLitige,
  gelActif,
  MOTIFS_LITIGE,
  STATUTS_GELANTS,
  type ActeurLitige,
  type EvenementLitige,
  type StatutLitige,
} from "@/domain/litige/machine";
import { compteConnecte } from "@/server/authentification/session";
import { db } from "@/server/db";
import {
  caution,
  journalAudit,
  litige,
  paiement,
  reservation,
  reversement,
} from "@/server/db/schema";
import { leverGelSiPlusRienOuvert, poserGel } from "@/server/finances/gel";
import { enfilerNotificationsLitige } from "@/server/notifications/file";

import { executerEffetsStripe } from "./execution";

/**
 * Ouverture et instruction des litiges.
 *
 * Le litige porte de l'argent : son ouverture gèle le transfert au
 * propriétaire et la libération de la caution — règle 6 — et sa résolution
 * décide qui touche quoi. Les effets financiers sont donc appliqués **dans la
 * transaction de la transition**, jamais après : un litige résolu dont les
 * fonds resteraient gelés, ou un gel sans litige, sont les deux incohérences
 * que ce montage rend impossibles.
 *
 * La décision revient à la plateforme seule. C'est le domaine qui le dit, et
 * ce module ne fait que lui obéir.
 */

export type Reponse = { ok: true; id?: string } | { ok: false; cle: string };

const ouverture = z.object({
  reservationId: z.string().uuid(),
  motif: z.enum(MOTIFS_LITIGE),
  description: z.string().trim().min(20).max(4000),
  // Un litige sans montant réclamé n'est pas instruisable : l'arbitre ne
  // saurait pas sur quoi trancher.
  montantReclame: z.coerce.number().int().positive(),
});

/** Le rôle du compte connecté **sur cette réservation précise**. */
async function roleSurDossier(
  reservationId: string,
  compteId: string,
  estAdmin: boolean,
): Promise<{ role: ActeurLitige; devise: string; caution: number } | null> {
  const [dossier] = await db
    .select({
      locataireId: reservation.locataireId,
      proprietaireId: reservation.proprietaireId,
      devise: reservation.devise,
      caution: reservation.caution,
      statut: reservation.statut,
    })
    .from(reservation)
    .where(eq(reservation.id, reservationId))
    .limit(1);

  if (!dossier) return null;

  if (dossier.locataireId === compteId) {
    return { role: "locataire", devise: dossier.devise, caution: dossier.caution };
  }
  if (dossier.proprietaireId === compteId) {
    return { role: "proprietaire", devise: dossier.devise, caution: dossier.caution };
  }
  if (estAdmin) {
    return { role: "administrateur", devise: dossier.devise, caution: dossier.caution };
  }

  return null;
}

export async function ouvrirLitige(donnees: FormData): Promise<Reponse> {
  const moi = await compteConnecte();
  if (!moi) return { ok: false, cle: "connexionRequise" };

  const analyse = ouverture.safeParse({
    reservationId: donnees.get("reservationId"),
    motif: donnees.get("motif"),
    description: donnees.get("description"),
    montantReclame: donnees.get("montantReclame"),
  });

  if (!analyse.success) return { ok: false, cle: "invalide" };
  const { reservationId, motif, description, montantReclame } = analyse.data;

  const partie = await roleSurDossier(reservationId, moi.id, Boolean(moi.role));
  if (!partie) return { ok: false, cle: "interdit" };

  // Seules les parties ouvrent un litige. Un administrateur arbitre, il ne
  // réclame pas : la direction financière de la décision se déduit de qui a
  // ouvert, et un dossier ouvert par la plateforme n'aurait pas de direction —
  // la retenue frapperait la caution du locataire par défaut, sans qu'il ait
  // rien réclamé ni qu'on ait rien constaté contre lui.
  if (partie.role === "administrateur") return { ok: false, cle: "interdit" };

  // Réclamer plus que la caution n'a pas de sens : c'est tout ce que la
  // plateforme peut retenir. Au-delà, le recours est judiciaire, pas ici.
  if (montantReclame > partie.caution) return { ok: false, cle: "montantExcessif" };

  // Un seul litige vivant à la fois par location : deux dossiers ouverts sur
  // les mêmes faits produiraient deux décisions, éventuellement contraires.
  // La requête cherche **un dossier vivant**, pas le premier venu — une
  // location qui porte un litige clos puis un litige ouvert doit refuser la
  // troisième ouverture, quel que soit l'ordre où la base rend ses lignes.
  const [vivant] = await db
    .select({ id: litige.id })
    .from(litige)
    .where(
      and(
        eq(litige.reservationId, reservationId),
        inArray(litige.statut, [...STATUTS_GELANTS]),
      ),
    )
    .limit(1);

  if (vivant) return { ok: false, cle: "dejaOuvert" };

  const cree = await db.transaction(async (tx) => {
    const [ligne] = await tx
      .insert(litige)
      .values({
        reservationId,
        ouvertParId: moi.id,
        statut: "ouvert",
        motif,
        description,
        devise: partie.devise,
        montantReclame,
      })
      .returning({ id: litige.id });

    await poserGel(tx, reservationId, "Litige ouvert sur cette location");
    await enfilerNotificationsLitige(tx, reservationId, "ouvert");
    return ligne;
  });

  revalidatePath("/[locale]/(espaces)", "layout");
  return { ok: true, id: cree.id };
}

/**
 * Applique l'effet financier d'une décision, dans la transaction qui la rend.
 *
 * Le calcul appartient au domaine (`effetsDecision`) ; ici on lit ce que les
 * deux gisements peuvent encore donner, et on écrit ce que le domaine a
 * décidé. Une caution retenue porte le motif de la décision : c'est lui qui
 * sera opposé au locataire, et une retenue sans motif est indéfendable.
 */
async function appliquerDecision(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  entree: {
    reservationId: string;
    ouvertPar: "locataire" | "proprietaire";
    montantAccorde: number;
    motif: string;
  },
): Promise<EffetsDecision> {
  const [garantie] = await tx
    .select({
      id: caution.id,
      statut: caution.statut,
      montant: caution.montant,
      montantDebite: caution.montantDebite,
    })
    .from(caution)
    .where(eq(caution.reservationId, entree.reservationId))
    .limit(1);

  const [versement] = await tx
    .select({
      id: reversement.id,
      statut: reversement.statut,
      montant: reversement.montant,
    })
    .from(reversement)
    .where(eq(reversement.reservationId, entree.reservationId))
    .limit(1);

  const [reglement] = await tx
    .select({
      id: paiement.id,
      montant: paiement.montant,
      montantRembourse: paiement.montantRembourse,
    })
    .from(paiement)
    .where(eq(paiement.reservationId, entree.reservationId))
    .limit(1);

  // Une caution libérée a rendu ses fonds : elle n'a plus rien à donner. Un
  // reversement déjà parti non plus — l'argent est chez le propriétaire.
  const cautionRestante =
    garantie && garantie.statut !== "liberee"
      ? garantie.montant - garantie.montantDebite
      : 0;

  const reversementRestant =
    versement && ["planifie", "gele"].includes(versement.statut ?? "")
      ? versement.montant
      : 0;

  const effets = effetsDecision({
    ouvertPar: entree.ouvertPar,
    montantAccorde: entree.montantAccorde,
    cautionRestante,
    reversementRestant,
  });

  if (effets.retenueCaution > 0 && garantie) {
    const debiteTotal = garantie.montantDebite + effets.retenueCaution;

    await tx
      .update(caution)
      .set({
        montantDebite: debiteTotal,
        statut: debiteTotal >= garantie.montant ? "retenue" : "debitee_partiellement",
        debitMotif: entree.motif,
        modifieLe: new Date(),
      })
      .where(eq(caution.id, garantie.id));
  }

  if (effets.reductionReversement > 0 && versement) {
    await tx
      .update(reversement)
      .set({
        montant: versement.montant - effets.reductionReversement,
        modifieLe: new Date(),
      })
      .where(eq(reversement.id, versement.id));
  }

  // La destination de la réduction : ce qui est retranché au propriétaire
  // revient au locataire, et son relevé doit le montrer dès la décision. Le
  // plafond est défensif — le reversement ne dépasse jamais le paiement, mais
  // un relevé qui afficherait plus remboursé qu'encaissé serait indéfendable.
  if (effets.remboursementLocataire > 0 && reglement) {
    const rembourseTotal = Math.min(
      reglement.montantRembourse + effets.remboursementLocataire,
      reglement.montant,
    );

    await tx
      .update(paiement)
      .set({
        montantRembourse: rembourseTotal,
        statut:
          rembourseTotal >= reglement.montant
            ? "rembourse"
            : "rembourse_partiellement",
        modifieLe: new Date(),
      })
      .where(eq(paiement.id, reglement.id));
  }

  return effets;
}

const instruction = z.object({
  litigeId: z.string().uuid(),
  evenement: z.enum(["proposer", "escalader", "trancher", "classer", "retirer"]),
  montant: z.coerce.number().int().min(0).optional(),
  decisionMotif: z.string().trim().max(2000).optional(),
});

/**
 * Fait franchir une étape au litige.
 *
 * Le domaine décide ; ce module lit l'état, vérifie la qualité de l'acteur sur
 * ce dossier précis, applique et trace. Aucune écriture directe sur
 * `litige.statut` ailleurs que par ici.
 */
export async function franchirLitige(donnees: FormData): Promise<Reponse> {
  const moi = await compteConnecte();
  if (!moi) return { ok: false, cle: "connexionRequise" };

  const analyse = instruction.safeParse({
    litigeId: donnees.get("litigeId"),
    evenement: donnees.get("evenement"),
    montant: donnees.get("montant") ?? undefined,
    decisionMotif: donnees.get("decisionMotif") ?? undefined,
  });

  if (!analyse.success) return { ok: false, cle: "invalide" };
  const { litigeId, evenement, montant, decisionMotif } = analyse.data;

  const [dossier] = await db
    .select({
      id: litige.id,
      statut: litige.statut,
      reservationId: litige.reservationId,
      ouvertParId: litige.ouvertParId,
      montantReclame: litige.montantReclame,
      locataireId: reservation.locataireId,
    })
    .from(litige)
    .innerJoin(reservation, eq(reservation.id, litige.reservationId))
    .where(eq(litige.id, litigeId))
    .limit(1);

  if (!dossier) return { ok: false, cle: "introuvable" };

  const partie = await roleSurDossier(
    dossier.reservationId,
    moi.id,
    Boolean(moi.role),
  );
  if (!partie) return { ok: false, cle: "interdit" };

  // Seul celui qui a ouvert peut retirer : l'autre partie n'a pas à faire
  // disparaître une réclamation qui la vise.
  if (evenement === "retirer" && dossier.ouvertParId !== moi.id) {
    return { ok: false, cle: "interdit" };
  }

  const verdict = evaluerLitige(evenement as EvenementLitige, {
    statut: dossier.statut as StatutLitige,
    acteur: partie.role,
    montantAccorde: montant,
    montantReclame: dossier.montantReclame ?? undefined,
    decisionMotif,
  });

  if (!verdict.autorise) return { ok: false, cle: verdict.motif };

  const suivant = verdict.statutSuivant;
  const enTetes = await headers();

  let effets: EffetsDecision = {
    retenueCaution: 0,
    reductionReversement: 0,
    remboursementLocataire: 0,
    resteARecouvrer: 0,
  };

  await db.transaction(async (tx) => {
    await tx
      .update(litige)
      .set({
        statut: suivant,
        ...(evenement === "proposer" ? { montantPropose: montant ?? null } : {}),
        ...(evenement === "trancher"
          ? {
              montantAccorde: montant ?? 0,
              decisionMotif: decisionMotif ?? null,
              arbitreId: moi.id,
              resoluLe: new Date(),
            }
          : {}),
        ...(suivant === "clos_sans_suite" ? { resoluLe: new Date() } : {}),
        modifieLe: new Date(),
      })
      .where(eq(litige.id, litigeId));

    // La décision emporte son effet financier, dans la même transaction : un
    // litige tranché dont la retenue arriverait « plus tard » laisserait la
    // caution se libérer entre les deux. **Avant la levée du gel** — l'ordre
    // compte : une caution passée « retenue » n'est plus « contestée », et la
    // levée du gel ne la remettra donc pas en circulation.
    if (evenement === "trancher") {
      effets = await appliquerDecision(tx, {
        reservationId: dossier.reservationId,
        ouvertPar:
          dossier.ouvertParId === dossier.locataireId ? "locataire" : "proprietaire",
        montantAccorde: montant ?? 0,
        motif: decisionMotif ?? "",
      });
    }

    // Le dossier clos rend les fonds à leur cours normal — c'est la seconde
    // moitié de la règle 6, celle qu'on oublie. La levée est conditionnelle :
    // si un sinistre court encore sur la même location, elle n'a pas lieu.
    if (!gelActif(suivant)) {
      await leverGelSiPlusRienOuvert(tx, dossier.reservationId);
    }

    const gabarit =
      suivant === "resolu"
        ? "resolu"
        : suivant === "clos_sans_suite"
          ? "classe"
          : suivant === "en_arbitrage"
            ? "arbitrage"
            : "proposition";

    await enfilerNotificationsLitige(tx, dossier.reservationId, gabarit);

    await tx.insert(journalAudit).values({
      auteurId: moi.id,
      auteurEmail: moi.email,
      action: `Litige — ${evenement}`,
      entite: "litige",
      entiteId: litigeId,
      motif: decisionMotif ?? `Passage à « ${suivant} »`,
      avant: { statut: dossier.statut },
      apres: {
        statut: suivant,
        ...(montant !== undefined ? { montant: String(montant) } : {}),
        ...(effets.retenueCaution > 0
          ? { retenueCaution: String(effets.retenueCaution) }
          : {}),
        ...(effets.reductionReversement > 0
          ? { reductionReversement: String(effets.reductionReversement) }
          : {}),
        ...(effets.remboursementLocataire > 0
          ? { remboursementLocataire: String(effets.remboursementLocataire) }
          : {}),
        // Le reste à recouvrer figure au journal, pas seulement à l'écran : un
        // manque qui ne serait écrit nulle part finirait par être oublié.
        ...(effets.resteARecouvrer > 0
          ? { resteARecouvrer: String(effets.resteARecouvrer) }
          : {}),
      },
      adresseIp: enTetes.get("x-forwarded-for")?.split(",")[0]?.trim(),
    });
  });

  // L'exécution bancaire vient après la décision, jamais dedans : un appel
  // réseau n'a rien à faire dans une transaction, et un refus de carte ne
  // remet pas en cause l'arbitrage — il s'inscrit au journal et se règle
  // autrement. Sans clé Stripe, la décision reste un fait comptable, ce que
  // la recette documente déjà.
  if (evenement === "trancher") {
    await executerEffetsStripe({
      reservationId: dossier.reservationId,
      litigeId,
      effets,
      motif: decisionMotif ?? "",
      auteur: { id: moi.id, email: moi.email },
    });
  }

  revalidatePath("/[locale]/(espaces)", "layout");
  return { ok: true };
}
