import "server-only";

import { eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import type { StatutReservation } from "@/domain/reservation/machine";
import type { db } from "@/server/db";
import { annonce, notification, reservation, utilisateur } from "@/server/db/schema";
import { destinatairesAcceptant } from "@/server/notifications/preferences";

/**
 * Enfilage des notifications — moitié « écriture » de la boîte d'envoi.
 *
 * Toujours appelé **avec la transaction de l'événement** : la règle 4 dit
 * qu'une transition déclenche ses notifications, et le seul moyen d'en être
 * sûr est qu'elles tombent ensemble ou pas du tout. Un enfilage hors
 * transaction finirait, un jour de réseau capricieux, par annoncer une
 * acceptation qui n'a pas eu lieu.
 */

type Executeur = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Qui est prévenu à chaque état atteint.
 *
 * Le parti pris est la retenue : les deux parties étaient présentes au départ
 * et au retour du matériel, inutile de leur écrire pour le leur apprendre —
 * seul le locataire reçoit la trace, elle lui sert de reçu. La clôture et
 * l'annulation, elles, concernent l'argent des deux côtés : tout le monde.
 */
export const DESTINATAIRES_PAR_STATUT: Record<
  StatutReservation,
  readonly ("locataire" | "proprietaire")[]
> = {
  demandee: ["proprietaire"],
  acceptee: ["locataire"],
  refusee: ["locataire"],
  expiree: ["locataire"],
  payee: ["proprietaire"],
  confirmee: ["locataire", "proprietaire"],
  en_cours: ["locataire"],
  restituee: ["locataire"],
  cloturee: ["locataire", "proprietaire"],
  annulee: ["locataire", "proprietaire"],
};

/**
 * Référence, matériel et prénoms des deux parties — le contexte de tout gabarit.
 *
 * Une seule requête, avec deux jointures sur `utilisateur` : l'enfilage a lieu
 * dans la transaction d'une transition, et chaque aller-retour supplémentaire
 * jusqu'à la base allonge d'autant le verrou tenu sur la réservation.
 */
async function chargerDossier(executeur: Executeur, reservationId: string) {
  const locataire = alias(utilisateur, "locataire");
  const proprietaire = alias(utilisateur, "proprietaire");

  const [dossier] = await executeur
    .select({
      numero: reservation.numero,
      annonceTitre: annonce.titre,
      locataireId: reservation.locataireId,
      proprietaireId: reservation.proprietaireId,
      prenomLocataire: locataire.prenom,
      prenomProprietaire: proprietaire.prenom,
    })
    .from(reservation)
    .innerJoin(annonce, eq(annonce.id, reservation.annonceId))
    .innerJoin(locataire, eq(locataire.id, reservation.locataireId))
    .innerJoin(proprietaire, eq(proprietaire.id, reservation.proprietaireId))
    .where(eq(reservation.id, reservationId))
    .limit(1);

  if (!dossier) return null;

  const prenoms = new Map([
    [dossier.locataireId, dossier.prenomLocataire ?? ""],
    [dossier.proprietaireId, dossier.prenomProprietaire ?? ""],
  ]);

  return { ...dossier, prenoms };
}

/**
 * Enfile un gabarit de réservation pour les rôles donnés.
 *
 * C'est la brique commune : la version « par statut » en dérive, et les cas
 * qui sortent du tableau — la réservation instantanée, par exemple — s'en
 * servent directement sans avoir à y entrer de force.
 */
export async function enfilerNotificationReservation(
  executeur: Executeur,
  reservationId: string,
  gabarit: string,
  roles: readonly ("locataire" | "proprietaire")[],
): Promise<void> {
  if (roles.length === 0) return;

  const dossier = await chargerDossier(executeur, reservationId);
  if (!dossier) return;

  await executeur.insert(notification).values(
    roles.map((role) => {
      const destinataireId =
        role === "locataire" ? dossier.locataireId : dossier.proprietaireId;
      const autreId =
        role === "locataire" ? dossier.proprietaireId : dossier.locataireId;

      return {
        destinataireId,
        gabarit,
        donnees: {
          reference: dossier.numero,
          annonceTitre: dossier.annonceTitre,
          prenom: dossier.prenoms.get(destinataireId) ?? "",
          interlocuteur: dossier.prenoms.get(autreId) ?? "",
        },
      };
    }),
  );
}

/** Enfile les courriels que l'état atteint commande, pour chaque destinataire. */
export async function enfilerNotificationsReservation(
  executeur: Executeur,
  reservationId: string,
  statut: StatutReservation,
): Promise<void> {
  await enfilerNotificationReservation(
    executeur,
    reservationId,
    `reservation.${statut}`,
    DESTINATAIRES_PAR_STATUT[statut],
  );
}

/**
 * Prévient les deux parties d'un mouvement sur un litige.
 *
 * Les deux, sans exception : un litige où l'une apprendrait la décision et
 * l'autre non serait une décision rendue à huis clos.
 */
export async function enfilerNotificationsLitige(
  executeur: Executeur,
  reservationId: string,
  gabarit: "ouvert" | "proposition" | "arbitrage" | "resolu" | "classe",
): Promise<void> {
  const dossier = await chargerDossier(executeur, reservationId);
  if (!dossier) return;

  await executeur.insert(notification).values(
    [dossier.locataireId, dossier.proprietaireId].map((destinataireId) => ({
      destinataireId,
      gabarit: `litige.${gabarit}`,
      donnees: {
        reference: dossier.numero,
        annonceTitre: dossier.annonceTitre,
        prenom: dossier.prenoms.get(destinataireId) ?? "",
        interlocuteur: "",
      },
    })),
  );
}

/** Un message reçu prévient l'autre partie — jamais son auteur. */
export async function enfilerNotificationNouveauMessage(
  executeur: Executeur,
  reservationId: string,
  auteurId: string,
): Promise<void> {
  const dossier = await chargerDossier(executeur, reservationId);
  if (!dossier) return;

  const destinataireId =
    auteurId === dossier.locataireId ? dossier.proprietaireId : dossier.locataireId;

  // Le destinataire a pu couper les alertes de messagerie : elles rendent
  // service sans rien décider, et se refusent donc légitimement.
  const acceptant = await destinatairesAcceptant(
    [destinataireId],
    "messagerie.nouveauMessage",
  );
  if (acceptant.length === 0) return;

  await executeur.insert(notification).values({
    destinataireId,
    gabarit: "messagerie.nouveauMessage",
    donnees: {
      reference: dossier.numero,
      annonceTitre: dossier.annonceTitre,
      prenom: dossier.prenoms.get(destinataireId) ?? "",
      interlocuteur: dossier.prenoms.get(auteurId) ?? "",
    },
  });
}
