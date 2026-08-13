import { calculerDevis, type BaremePays } from "../tarification/devis";
import type { StatutReservation } from "./machine";

/**
 * Prolongation d'une location en cours.
 *
 * Le besoin est réel et fréquent : le chantier prend un jour de plus, le
 * déménagement déborde, la météo tourne. Sans prolongation, il ne reste que
 * deux mauvaises issues — rendre le matériel et en relouer un autre, ou le
 * garder sans rien dire. La seconde est celle que choisissent les gens, et
 * c'est celle qui fait les litiges.
 *
 * **Ce n'est pas une nouvelle réservation.** Le matériel est déjà chez le
 * locataire, l'état des lieux de départ est signé, la caution est constituée.
 * Créer une seconde réservation obligerait à un état des lieux de retour
 * suivi d'un état des lieux de départ, le même jour, sur le même bien, entre
 * les mêmes personnes — une fiction administrative que personne ne remplirait.
 * On étend la période de celle qui existe.
 *
 * Logique pure : aucune base, aucune horloge implicite. La date du jour est
 * toujours passée en argument, ce qui rend chaque cas reproductible.
 */

/** Nombre de jours au-delà duquel une prolongation devient une relocation. */
export const JOURS_MAXIMUM = 14;

export type Refus =
  | "statutIncompatible"
  | "dureeInvalide"
  | "tropLongue"
  | "chevauchement"
  | "depasseDureeMaximum";

export type Demande = {
  statut: StatutReservation;
  /** Fin actuelle de la location. */
  finActuelle: Date;
  /** Nouvelle fin souhaitée. */
  finSouhaitee: Date;
  debut: Date;
  /** Début de la prochaine réservation sur ce matériel, s'il y en a une. */
  prochaineReservation: Date | null;
  /** Durée maximale autorisée par l'annonce, en jours. */
  dureeMaximumAnnonce: number;
};

export type Verdict =
  | { ok: true; joursAjoutes: number; dureeTotale: number }
  | { ok: false; motif: Refus };

/** Nombre de jours entiers entre deux dates. */
function joursEntre(depuis: Date, jusqua: Date): number {
  return Math.ceil((jusqua.getTime() - depuis.getTime()) / 86_400_000);
}

/**
 * La prolongation est-elle possible ?
 *
 * L'ordre des contrôles n'est pas indifférent : on refuse d'abord ce qui tient
 * à la demande elle-même — un statut qui ne s'y prête pas, une date qui ne
 * prolonge rien — avant ce qui tient au monde extérieur. Dire « quelqu'un a
 * réservé la suite » à qui a saisi une date antérieure serait une explication
 * exacte et hors sujet.
 */
export function evaluerProlongation(demande: Demande): Verdict {
  // On ne prolonge que ce qui est en cours. Avant le retrait, il reste temps
  // de modifier la réservation elle-même ; après la restitution, le matériel
  // est revenu et il n'y a plus rien à prolonger.
  if (demande.statut !== "en_cours") {
    return { ok: false, motif: "statutIncompatible" };
  }

  const joursAjoutes = joursEntre(demande.finActuelle, demande.finSouhaitee);
  if (joursAjoutes < 1) return { ok: false, motif: "dureeInvalide" };

  // Au-delà de deux semaines, ce n'est plus une prolongation : c'est une
  // seconde location, qui mérite son propre contrat, son propre état des lieux
  // et sa propre caution.
  if (joursAjoutes > JOURS_MAXIMUM) return { ok: false, motif: "tropLongue" };

  const dureeTotale = joursEntre(demande.debut, demande.finSouhaitee);
  if (dureeTotale > demande.dureeMaximumAnnonce) {
    return { ok: false, motif: "depasseDureeMaximum" };
  }

  // Le calendrier de l'annonce prime : quelqu'un d'autre a peut-être réservé
  // la suite. Une prolongation accordée par-dessus une réservation existante
  // produirait deux locataires sur le même matériel le même jour — la faute
  // dont une place de marché ne se relève pas.
  if (
    demande.prochaineReservation &&
    demande.finSouhaitee >= demande.prochaineReservation
  ) {
    return { ok: false, motif: "chevauchement" };
  }

  return { ok: true, joursAjoutes, dureeTotale };
}

/**
 * Ce que coûte la prolongation.
 *
 * Le supplément est calculé au tarif journalier d'origine, avec le même barème
 * de commission. Réappliquer le tarif du jour serait défendable en théorie et
 * indéfendable à l'usage : personne n'accepte que trois jours de plus coûtent
 * plus cher que les trois premiers parce que la haute saison a commencé
 * entre-temps.
 *
 * La caution ne bouge pas. Elle couvre le matériel, pas la durée : la remorque
 * ne vaut pas davantage parce qu'on la garde plus longtemps.
 */
export function supplementProlongation(entree: {
  prixJour: number;
  joursAjoutes: number;
  bareme: BaremePays;
}) {
  return calculerDevis({
    prixJour: entree.prixJour,
    nombreJours: entree.joursAjoutes,
    bareme: entree.bareme,
  });
}
