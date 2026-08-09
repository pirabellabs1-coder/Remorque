import "server-only";

import { and, eq, sql } from "drizzle-orm";

import {
  remboursementAnnulation,
  type PolitiqueAnnulation,
} from "@/domain/reservation/annulation";
import {
  evaluerTransition,
  type Acteur,
  type Evenement,
  type StatutReservation,
} from "@/domain/reservation/machine";
import { db } from "@/server/db";
import {
  annonce,
  caution,
  paiement,
  reservation,
  reservationTransition,
  reversement,
} from "@/server/db/schema";
import { enfilerNotificationsReservation } from "@/server/notifications/file";
import { executerRemboursementStripe } from "@/server/paiements/remboursement";

/**
 * Le seul chemin par lequel une réservation change d'état — règle 4.
 *
 * « Toute transition passe par `src/domain/reservation/machine.ts`, est tracée
 * dans `reservation_transition` et déclenche ses notifications. Aucun `UPDATE`
 * direct sur `reservation.statut`. »
 *
 * Cette fonction est la mise en œuvre de cette phrase. Le domaine décide seul
 * si la transition est permise ; ce module se charge de ce que le domaine ne
 * peut pas savoir — lire l'état courant, vérifier le gel des fonds en base,
 * écrire la trace — puis d'appliquer le tout en une transaction.
 *
 * **Rien n'est écrit hors transaction.** Un statut modifié sans sa trace
 * rendrait le journal menteur ; une trace sans changement de statut ferait
 * croire à une action qui n'a pas eu lieu. Les deux tombent ensemble ou pas du
 * tout.
 */

export type ResultatChangement =
  | { ok: true; statut: StatutReservation }
  | { ok: false; motif: string };

/**
 * Un dossier ouvert gèle-t-il cette réservation ?
 *
 * Lu en base et non passé en paramètre : l'appelant pourrait l'oublier, et
 * l'oubli signifierait clôturer une location dont le litige est en cours.
 */
async function fondsGeles(reservationId: string): Promise<boolean> {
  const [ligne] = await db
    .select({ gele: sql<boolean>`
      exists (
        select 1 from litige l
        where l.reservation_id = ${reservationId}
          and l.statut not in ('resolu', 'clos_sans_suite')
      ) or exists (
        select 1 from sinistre s
        where s.reservation_id = ${reservationId}
          and s.statut in ('declare', 'transmis', 'en_cours')
      )
    ` })
    .from(reservation)
    .where(eq(reservation.id, reservationId))
    .limit(1);

  return ligne?.gele ?? false;
}

/**
 * Horodatage à renseigner selon l'état atteint.
 *
 * La table porte une colonne par étape franchie — `acceptee_le`, `payee_le`,
 * `cloturee_le`… Les renseigner ici plutôt qu'au cas par cas chez l'appelant
 * garantit qu'une transition ne peut pas laisser sa date vide.
 */
const HORODATAGE: Partial<Record<StatutReservation, string>> = {
  acceptee: "acceptee_le",
  payee: "payee_le",
  confirmee: "confirmee_le",
  en_cours: "retrait_le",
  restituee: "restituee_le",
  cloturee: "cloturee_le",
  annulee: "annulee_le",
};

export async function changerStatut(entree: {
  reservationId: string;
  evenement: Evenement;
  acteur: Acteur;
  acteurId?: string;
  motif?: string;
}): Promise<ResultatChangement> {
  const [courante] = await db
    .select({
      statut: reservation.statut,
      locataireId: reservation.locataireId,
      proprietaireId: reservation.proprietaireId,
    })
    .from(reservation)
    .where(eq(reservation.id, entree.reservationId))
    .limit(1);

  if (!courante) return { ok: false, motif: "Réservation introuvable." };

  const statut = courante.statut as StatutReservation;

  // Vérification d'habilitation *sur cette réservation précise*. Le domaine
  // sait qu'un « propriétaire » peut accepter ; il ne sait pas si celui qui
  // demande est le propriétaire de celle-ci.
  if (entree.acteurId && entree.acteur !== "administrateur") {
    const attendu =
      entree.acteur === "locataire" ? courante.locataireId : courante.proprietaireId;
    if (attendu !== entree.acteurId) {
      return { ok: false, motif: "Vous n'êtes pas partie à cette réservation." };
    }
  }

  const verdict = evaluerTransition(entree.evenement, {
    statut,
    acteur: entree.acteur,
    fondsGeles: await fondsGeles(entree.reservationId),
  });

  if (!verdict.autorise) return { ok: false, motif: verdict.motif };

  const suivant = verdict.statutSuivant;
  const colonne = HORODATAGE[suivant];

  // Rempli dans la transaction si l'annulation rend de l'argent ; le geste
  // bancaire, lui, attend que la transaction soit retombée.
  let remboursement: { intention: string | null; montant: number } | null = null;

  await db.transaction(async (tx) => {
    await tx.execute(sql`
      update reservation
      set statut = ${suivant}::statut_reservation,
          modifie_le = now()
          ${colonne ? sql`, ${sql.raw(colonne)} = now()` : sql``}
      where id = ${entree.reservationId}
    `);

    await tx.insert(reservationTransition).values({
      reservationId: entree.reservationId,
      statutPrecedent: statut,
      statutSuivant: suivant,
      acteur: entree.acteur,
      acteurId: entree.acteurId,
      motif: entree.motif,
    });

    // Règle 4, dernier tiers : la transition déclenche ses notifications.
    // Dans la transaction, pour qu'un courriel ne parte jamais annoncer un
    // état qui n'a finalement pas été atteint.
    await enfilerNotificationsReservation(tx, entree.reservationId, suivant);

    // Les mouvements d'argent suivent l'état, dans la même transaction : une
    // location annulée dont la caution resterait immobilisée est un appel au
    // support garanti.
    // L'empreinte est prise au paiement, jamais avant : c'est le moment où la
    // carte du locataire est réellement engagée.
    if (suivant === "payee") {
      const [existante] = await tx
        .select({ id: caution.id })
        .from(caution)
        .where(eq(caution.reservationId, entree.reservationId))
        .limit(1);

      const [montants] = await tx
        .select({
          caution: reservation.caution,
          devise: reservation.devise,
          fin: reservation.fin,
          proprietaireId: reservation.proprietaireId,
          montantReverse: reservation.montantReverse,
          commissionProprietaire: reservation.commissionProprietaire,
        })
        .from(reservation)
        .where(eq(reservation.id, entree.reservationId))
        .limit(1);

      if (!existante) {
        await tx.insert(caution).values({
          reservationId: entree.reservationId,
          statut: "constituee",
          devise: montants.devise,
          montant: montants.caution,
          liberationPrevueLe: montants.fin,
        });
      }

      // Le reversement naît ici, avec la caution : rien n'est dû au
      // propriétaire tant que rien n'est encaissé. Une ligne née à la
      // demande affirmerait une dette sans argent — et resterait à jamais
      // « planifiée » sur une demande refusée ou expirée.
      const [versementExistant] = await tx
        .select({ id: reversement.id })
        .from(reversement)
        .where(eq(reversement.reservationId, entree.reservationId))
        .limit(1);

      if (!versementExistant) {
        await tx.insert(reversement).values({
          reservationId: entree.reservationId,
          beneficiaireId: montants.proprietaireId,
          statut: "planifie",
          devise: montants.devise,
          montant: montants.montantReverse,
          commissionRetenue: montants.commissionProprietaire,
          prevuLe: montants.fin,
        });
      }
    }

    if (suivant === "annulee" || suivant === "refusee") {
      await tx
        .update(caution)
        .set({ statut: "liberee", libereeLe: new Date() })
        .where(
          and(
            eq(caution.reservationId, entree.reservationId),
            eq(caution.statut, "constituee"),
          ),
        );
    }

    // L'annulation d'une location déjà encaissée rend l'argent selon la
    // politique de l'annonce — c'est la promesse des conditions générales,
    // et elle tombe dans la même transaction que le statut : une annulation
    // écrite sans son remboursement serait exactement le mensonge que la
    // machine existe pour empêcher.
    if (suivant === "annulee") {
      const [reglement] = await tx
        .select({
          id: paiement.id,
          montant: paiement.montant,
          montantRembourse: paiement.montantRembourse,
          intention: paiement.stripePaymentIntentId,
        })
        .from(paiement)
        .where(eq(paiement.reservationId, entree.reservationId))
        .limit(1);

      if (reglement) {
        const [dossier] = await tx
          .select({
            debut: reservation.debut,
            loyer: reservation.loyer,
            remise: reservation.remise,
            fraisService: reservation.fraisService,
            primeAssurance: reservation.primeAssurance,
            fraisLivraison: reservation.fraisLivraison,
            politique: annonce.politiqueAnnulation,
          })
          .from(reservation)
          .innerJoin(annonce, eq(annonce.id, reservation.annonceId))
          .where(eq(reservation.id, entree.reservationId))
          .limit(1);

        const effets = remboursementAnnulation({
          politique: dossier.politique as PolitiqueAnnulation,
          annulePar: entree.acteur,
          heuresAvantDebut:
            (dossier.debut.getTime() - Date.now()) / 3_600_000,
          loyer: dossier.loyer,
          remise: dossier.remise,
          fraisService: dossier.fraisService,
          primeAssurance: dossier.primeAssurance,
          fraisLivraison: dossier.fraisLivraison,
        });

        if (effets.total > 0) {
          const rembourseTotal = Math.min(
            reglement.montant,
            reglement.montantRembourse + effets.total,
          );

          // Ce que la banque doit rendre est le **delta réellement écrit**,
          // pas le total du barème. Les deux diffèrent dès qu'un
          // remboursement antérieur a déjà entamé la charge — un litige
          // tranché en faveur du locataire, par exemple : le plafond mord,
          // la comptabilité n'ajoute que ce qui reste, et demander à Stripe
          // le total ferait rejeter l'appel (« montant supérieur au restant
          // remboursable »). L'échec étant silencieux, le relevé annoncerait
          // un remboursement que la banque n'a jamais fait.
          const aRendre = rembourseTotal - reglement.montantRembourse;

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

          if (aRendre > 0) {
            remboursement = { intention: reglement.intention, montant: aRendre };
          }
        }

        // Le reversement suit le loyer conservé, au prorata : la commission
        // garde sa part relative, et un loyer entièrement rendu ne laisse
        // rien à verser au propriétaire.
        const loyerNet = Math.max(0, dossier.loyer - Math.max(0, dossier.remise));
        const [versement] = await tx
          .select({ id: reversement.id, montant: reversement.montant })
          .from(reversement)
          .where(
            and(
              eq(reversement.reservationId, entree.reservationId),
              eq(reversement.statut, "planifie"),
            ),
          )
          .limit(1);

        if (versement) {
          const conserve =
            loyerNet > 0
              ? Math.round((versement.montant * effets.loyerConserve) / loyerNet)
              : 0;

          await tx
            .update(reversement)
            .set({ montant: conserve, modifieLe: new Date() })
            .where(eq(reversement.id, versement.id));
        }
      }
    }

    if (suivant === "cloturee") {
      // Le gel a déjà été vérifié par le domaine : arriver ici signifie
      // qu'aucun dossier n'est ouvert.
      //
      // Le reversement reste **planifié** et n'est pas marqué payé : tant que
      // le virement n'a pas été accepté par le prestataire, écrire « payé »
      // ferait dire à l'écran du propriétaire que son argent est parti alors
      // qu'il ne l'est pas. C'est `envoyerReversement` qui fait le virement,
      // et lui seul qui inscrit son identifiant.
      await tx
        .update(reversement)
        .set({ prevuLe: new Date() })
        .where(
          and(
            eq(reversement.reservationId, entree.reservationId),
            eq(reversement.statut, "planifie"),
          ),
        );
    }
  });

  // Le geste bancaire après la transaction, jamais dedans — même régime que
  // l'exécution d'une décision de litige. Sans clé Stripe, le fait comptable
  // suffit et le rapprochement verra le reste.
  if (remboursement !== null) {
    const { intention, montant } = remboursement;
    await executerRemboursementStripe({
      reservationId: entree.reservationId,
      intention,
      montant,
      motif: entree.motif ?? "Annulation de la location",
    });
  }

  return { ok: true, statut: suivant };
}

/**
 * Historique des transitions d'une réservation.
 *
 * C'est ce qui permet de répondre à « pourquoi ma réservation est-elle dans cet
 * état ? » — la question que reçoit le support, et à laquelle un statut seul ne
 * répond jamais.
 */
export async function historique(reservationId: string) {
  return db
    .select({
      id: reservationTransition.id,
      statutPrecedent: reservationTransition.statutPrecedent,
      statutSuivant: reservationTransition.statutSuivant,
      acteur: reservationTransition.acteur,
      motif: reservationTransition.motif,
      date: reservationTransition.creeLe,
    })
    .from(reservationTransition)
    .where(eq(reservationTransition.reservationId, reservationId))
    .orderBy(reservationTransition.creeLe);
}
