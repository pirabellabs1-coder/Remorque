import { useTranslations } from "next-intl";

import type { StatutReservation } from "@/domain/reservation/machine";
import { cn } from "@/lib/cn";

/**
 * Pastille d'état d'une réservation.
 *
 * Le libellé vient des traductions, jamais du nom technique de l'état : c'est
 * la seule représentation visible par l'utilisateur d'une machine à états qui
 * conditionne des mouvements d'argent.
 */
const TONALITES: Record<StatutReservation, string> = {
  demandee: "bg-attention/10 text-attention",
  acceptee: "bg-info/10 text-info",
  payee: "bg-info/10 text-info",
  confirmee: "bg-succes/10 text-succes",
  en_cours: "bg-succes/10 text-succes",
  restituee: "bg-info/10 text-info",
  cloturee: "bg-ardoise-200 text-ardoise-700",
  refusee: "bg-danger/10 text-danger",
  expiree: "bg-ardoise-200 text-ardoise-700",
  annulee: "bg-danger/10 text-danger",
};

export function PastilleStatut({ statut }: { statut: StatutReservation }) {
  const t = useTranslations("reservation.statut");

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
        TONALITES[statut],
      )}
    >
      {t(statut)}
    </span>
  );
}
