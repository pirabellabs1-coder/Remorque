import "server-only";

import { and, asc, desc, eq, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import {
  DELAI_PREMIERE_REPONSE_HEURES,
  delaiDepasse,
  type PrioriteSupport,
  type StatutSupport,
} from "@/domain/support/machine";
import { compteConnecte } from "@/server/authentification/session";
import { db } from "@/server/db";
import {
  reservation,
  ticketMessage,
  ticketSupport,
  utilisateur,
} from "@/server/db/schema";

/**
 * Lecture des demandes d'assistance.
 *
 * Une demande n'a qu'un auteur — pas deux parties comme un litige : elle se
 * lit par celui qui l'a écrite, et par l'assistance. La garde est dans la
 * clause, comme partout ailleurs.
 *
 * Les notes internes ne sortent jamais vers le demandeur. Le filtre est ici,
 * dans la requête, et non dans le composant : un écran qui déciderait seul de
 * masquer une note finirait par l'afficher le jour où on ajoute une vue.
 */

export type MessageTicket = {
  id: string;
  auteur: string;
  auteurRole: "demandeur" | "assistance";
  corps: string;
  interne: boolean;
  date: Date;
};

export type TicketDossier = {
  id: string;
  reference: string;
  statut: StatutSupport;
  priorite: PrioriteSupport;
  canal: "courriel" | "formulaire" | "telephone";
  sujet: string;
  message: string | null;
  demandeur: string;
  demandeurEmail: string | null;
  /** Référence de la location rattachée, s'il y en a une. */
  reservationReference: string | null;
  reservationId: string | null;
  assigneA: string | null;
  ouvertLe: Date;
  premiereReponseLe: Date | null;
  resoluLe: Date | null;
  /**
   * L'engagement de première réponse est-il dépassé ?
   *
   * Calculé ici et non à l'affichage : c'est un fait du dossier, pas une
   * décoration d'écran, et la règle de pureté des composants serveur interdit
   * de toute façon d'y lire l'heure courante.
   */
  enRetard: boolean;
  /** Heures d'engagement attachées à la priorité, pour le dire à l'écran. */
  delaiHeures: number;
  /** Le compte connecté est-il l'auteur de la demande ? */
  aMoi: boolean;
  monRole: "demandeur" | "assistance";
  messages: MessageTicket[];
};

const colonnes = {
  id: ticketSupport.id,
  reference: ticketSupport.reference,
  statut: ticketSupport.statut,
  priorite: ticketSupport.priorite,
  canal: ticketSupport.canal,
  sujet: ticketSupport.sujet,
  message: ticketSupport.message,
  demandeurId: ticketSupport.demandeurId,
  demandeurEmail: ticketSupport.demandeurEmail,
  reservationId: ticketSupport.reservationId,
  assigneAId: ticketSupport.assigneAId,
  ouvertLe: ticketSupport.creeLe,
  premiereReponseLe: ticketSupport.premiereReponseLe,
  resoluLe: ticketSupport.resoluLe,
};

function nomComplet(prenom: string | null, nom: string | null): string {
  return [prenom, nom].filter(Boolean).join(" ").trim();
}

/**
 * Le fil d'une demande, dans l'ordre où il s'est écrit.
 *
 * `avecInternes` n'est vrai que pour l'assistance : c'est le seul paramètre
 * qui décide, et il vient de la qualité de l'appelant, jamais d'une case à
 * cocher de l'interface.
 */
async function filDuTicket(
  ticketId: string,
  avecInternes: boolean,
): Promise<MessageTicket[]> {
  const lignes = await db
    .select({
      id: ticketMessage.id,
      auteurRole: ticketMessage.auteurRole,
      corps: ticketMessage.corps,
      interne: ticketMessage.interne,
      date: ticketMessage.creeLe,
      prenom: utilisateur.prenom,
      nom: utilisateur.nom,
    })
    .from(ticketMessage)
    .leftJoin(utilisateur, eq(utilisateur.id, ticketMessage.auteurId))
    .where(
      and(
        eq(ticketMessage.ticketId, ticketId),
        avecInternes ? undefined : eq(ticketMessage.interne, false),
      ),
    )
    .orderBy(asc(ticketMessage.creeLe));

  return lignes.map((ligne) => ({
    id: ligne.id,
    auteur: nomComplet(ligne.prenom, ligne.nom),
    auteurRole: ligne.auteurRole as "demandeur" | "assistance",
    corps: ligne.corps,
    interne: ligne.interne,
    date: ligne.date,
  }));
}

/**
 * Le fil, précédé du message d'ouverture quand il n'y figure pas.
 *
 * Les demandes nées du formulaire recopient leur corps dans le fil : tout y
 * est déjà. Mais une demande arrivée par courriel ou par téléphone — et les
 * dossiers du jeu d'amorçage — ne portent leur texte que dans la colonne
 * `message`. Sans ce repli, leur écran s'ouvrirait sur un échange vide, et
 * l'assistance devrait deviner la question.
 */
async function filAvecOuverture(
  ligne: Record<string, unknown>,
  cotePlateforme: boolean,
  demandeur: string,
): Promise<MessageTicket[]> {
  const fil = await filDuTicket(ligne.id as string, cotePlateforme);
  const ouverture = ((ligne.message as string | null) ?? "").trim();

  if (!ouverture || fil.some((message) => message.auteurRole === "demandeur")) {
    return fil;
  }

  return [
    {
      // Identifiant dérivé du dossier : ce message n'a pas de ligne à lui, et
      // deux clés identiques dans une liste React feraient sauter le rendu.
      id: `${ligne.id as string}-ouverture`,
      auteur: demandeur,
      auteurRole: "demandeur",
      corps: ouverture,
      interne: false,
      date: ligne.ouvertLe as Date,
    },
    ...fil,
  ];
}

async function composer(
  ligne: Record<string, unknown>,
  moiId: string,
  estAssistance: boolean,
  demandeur: string,
  assigneA: string | null,
  reservationReference: string | null,
): Promise<TicketDossier> {
  const aMoi = ligne.demandeurId === moiId;
  const priorite = ligne.priorite as PrioriteSupport;
  const ouvertLe = ligne.ouvertLe as Date;
  const premiereReponseLe = (ligne.premiereReponseLe as Date | null) ?? null;
  const resoluLe = (ligne.resoluLe as Date | null) ?? null;
  const cotePlateforme = estAssistance && !aMoi;

  return {
    id: ligne.id as string,
    reference: ligne.reference as string,
    statut: ligne.statut as StatutSupport,
    priorite,
    canal: ligne.canal as TicketDossier["canal"],
    sujet: ligne.sujet as string,
    message: (ligne.message as string | null) ?? null,
    demandeur,
    demandeurEmail: (ligne.demandeurEmail as string | null) ?? null,
    reservationReference,
    reservationId: (ligne.reservationId as string | null) ?? null,
    // L'identité de l'agent ne sort pas de la plateforme. Le fil l'anonymise
    // déjà — « Assistance » et non son nom — et la nommer dans la fiche
    // reviendrait à défaire ce choix par une autre porte : un demandeur
    // mécontent repartirait avec l'état civil de la personne qui l'a suivi.
    // Le filtre est ici, dans la lecture, jamais dans le composant.
    assigneA: cotePlateforme ? assigneA : null,
    ouvertLe,
    premiereReponseLe,
    resoluLe,
    // Un dossier clos ne court plus après rien : le retard mesure une attente,
    // et une demande retirée par son auteur — close sans réponse, à bon droit —
    // resterait sinon marquée « en retard » à perpétuité.
    enRetard:
      resoluLe === null &&
      delaiDepasse({
        priorite,
        heuresEcoulees: (Date.now() - ouvertLe.getTime()) / 3_600_000,
        premiereReponseFaite: premiereReponseLe !== null,
      }),
    delaiHeures: DELAI_PREMIERE_REPONSE_HEURES[priorite],
    aMoi,
    // La qualité de demandeur prime : un agent qui a écrit au support pour
    // son propre compte y est demandeur, et n'y répond pas lui-même.
    monRole: aMoi ? "demandeur" : estAssistance ? "assistance" : "demandeur",
    messages: await filAvecOuverture(ligne, cotePlateforme, demandeur),
  };
}

/** Les demandes du compte connecté, la plus récente en tête. */
export async function mesDemandes(): Promise<TicketDossier[]> {
  const moi = await compteConnecte();
  if (!moi) return [];

  const assigne = alias(utilisateur, "assigne");

  const lignes = await db
    .select({
      ...colonnes,
      prenom: utilisateur.prenom,
      nom: utilisateur.nom,
      assignePrenom: assigne.prenom,
      assigneNom: assigne.nom,
      reservationReference: reservation.numero,
    })
    .from(ticketSupport)
    .leftJoin(utilisateur, eq(utilisateur.id, ticketSupport.demandeurId))
    .leftJoin(assigne, eq(assigne.id, ticketSupport.assigneAId))
    .leftJoin(reservation, eq(reservation.id, ticketSupport.reservationId))
    .where(eq(ticketSupport.demandeurId, moi.id))
    .orderBy(desc(ticketSupport.creeLe));

  return Promise.all(
    lignes.map((ligne) =>
      composer(
        ligne,
        moi.id,
        Boolean(moi.role),
        nomComplet(ligne.prenom, ligne.nom),
        nomComplet(ligne.assignePrenom, ligne.assigneNom) || null,
        ligne.reservationReference,
      ),
    ),
  );
}

/** Une demande par son identifiant — pour son auteur, ou pour l'assistance. */
export async function demandeParIdentifiant(
  ticketId: string,
): Promise<TicketDossier | null> {
  const moi = await compteConnecte();
  if (!moi) return null;

  const assigne = alias(utilisateur, "assigne");

  const [ligne] = await db
    .select({
      ...colonnes,
      prenom: utilisateur.prenom,
      nom: utilisateur.nom,
      assignePrenom: assigne.prenom,
      assigneNom: assigne.nom,
      reservationReference: reservation.numero,
    })
    .from(ticketSupport)
    .leftJoin(utilisateur, eq(utilisateur.id, ticketSupport.demandeurId))
    .leftJoin(assigne, eq(assigne.id, ticketSupport.assigneAId))
    .leftJoin(reservation, eq(reservation.id, ticketSupport.reservationId))
    .where(
      and(
        eq(ticketSupport.id, ticketId),
        // L'assistance lit tout ; les autres, seulement ce qu'ils ont écrit.
        moi.role ? undefined : eq(ticketSupport.demandeurId, moi.id),
      ),
    )
    .limit(1);

  if (!ligne) return null;

  return composer(
    ligne,
    moi.id,
    Boolean(moi.role),
    nomComplet(ligne.prenom, ligne.nom),
    nomComplet(ligne.assignePrenom, ligne.assigneNom) || null,
    ligne.reservationReference,
  );
}

/**
 * Les locations auxquelles le compte connecté peut rattacher une demande.
 *
 * Rattacher est facultatif — on écrit avant d'avoir réservé —, mais quand la
 * demande porte sur une location, l'assistance gagne le dossier entier sans
 * avoir à le demander.
 */
export async function mesLocationsRattachables(): Promise<
  { id: string; libelle: string }[]
> {
  const moi = await compteConnecte();
  if (!moi) return [];

  const lignes = await db
    .select({ id: reservation.id, numero: reservation.numero, statut: reservation.statut })
    .from(reservation)
    .where(
      or(
        eq(reservation.locataireId, moi.id),
        eq(reservation.proprietaireId, moi.id),
      ),
    )
    .orderBy(desc(reservation.creeLe))
    .limit(30);

  return lignes.map((ligne) => ({
    id: ligne.id,
    libelle: ligne.numero,
  }));
}
