import { STATUTS, type StatutReservation } from "./machine";

/**
 * Quand une remorque est-elle prise ?
 *
 * La règle vivait dans la validation d'une demande, et nulle part ailleurs. La
 * recherche par dates a besoin exactement de la même : deux définitions de « la
 * remorque est prise » finiraient par diverger, et le symptôme serait le pire
 * possible — une annonce annoncée libre par la recherche, refusée à la
 * réservation. Le visiteur en conclurait que la plateforme ment.
 *
 * Elle est donc ici, en un seul endroit, sans dépendance à la base.
 */

/**
 * Statuts qui bloquent le calendrier.
 *
 * Une simple demande le bloque aussi, avant même tout paiement : sans cela,
 * deux personnes régleraient la même semaine et l'une des deux serait déçue
 * après avoir payé. Les états terminaux d'exception — refusée, expirée,
 * annulée — le libèrent, ce qui est le seul intérêt d'en distinguer trois.
 */
export const STATUTS_OCCUPANTS = [
  "demandee",
  "acceptee",
  "payee",
  "confirmee",
  "en_cours",
  "restituee",
] as const satisfies readonly StatutReservation[];

/** Une réservation dans cet état empêche-t-elle d'en prendre une autre ? */
export function occupeLeCalendrier(statut: string): boolean {
  return (STATUTS_OCCUPANTS as readonly string[]).includes(statut);
}

/**
 * Deux périodes se chevauchent-elles ?
 *
 * Écrit comme une seule condition plutôt qu'en énumérant les cas : la forme
 * « l'une commence avant la fin de l'autre et finit après son début » couvre
 * aussi celui qu'on oublie toujours — la demande qui englobe entièrement une
 * réservation existante.
 */
export function periodesSeChevauchent(
  a: { debut: Date; fin: Date },
  b: { debut: Date; fin: Date },
): boolean {
  return a.debut <= b.fin && a.fin >= b.debut;
}

/** Les statuts qui libèrent le calendrier — l'exact complément. */
export const STATUTS_LIBERANTS = STATUTS.filter(
  (statut) => !occupeLeCalendrier(statut),
);
