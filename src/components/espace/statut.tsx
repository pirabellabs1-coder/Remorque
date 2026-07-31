import { useTranslations } from "next-intl";

import type { StatutReservation } from "@/domain/reservation/machine";
import { cn } from "@/lib/cn";

/**
 * Pastille de statut d'une réservation.
 *
 * Une couleur seule ne dit rien à qui ne la distingue pas — huit pour cent des
 * hommes voient mal le rouge et le vert. Le libellé est donc toujours écrit,
 * la couleur ne fait que le doubler.
 *
 * Trois familles seulement : ce qui attend une action, ce qui suit son cours,
 * ce qui est terminé. Dix couleurs pour dix statuts ne se mémorisent pas.
 */
const FAMILLES: Record<StatutReservation, "attente" | "cours" | "fini" | "echec"> = {
  demandee: "attente",
  acceptee: "attente",
  payee: "cours",
  confirmee: "cours",
  en_cours: "cours",
  restituee: "attente",
  cloturee: "fini",
  refusee: "echec",
  expiree: "echec",
  annulee: "echec",
};

const TEINTES = {
  attente: "border-attention/30 bg-attention/10 text-attention",
  cours: "border-accent/30 bg-accent/10 text-accent",
  fini: "border-succes/30 bg-succes/10 text-succes",
  echec: "border-bordure bg-fond-doux text-texte-attenue",
} as const;

export function PastilleStatut({
  statut,
  className,
}: {
  statut: StatutReservation;
  className?: string;
}) {
  const t = useTranslations("espaces.statuts");

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-xs font-medium whitespace-nowrap",
        TEINTES[FAMILLES[statut]],
        className,
      )}
    >
      {t(statut)}
    </span>
  );
}

/** Étoiles d'une note. Le chiffre reste écrit à côté, pour la même raison. */
export function Etoiles({ note, className }: { note: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)}>
      {[1, 2, 3, 4, 5].map((rang) => (
        <svg
          key={rang}
          viewBox="0 0 24 24"
          aria-hidden
          className={cn(
            "size-4",
            rang <= Math.round(note) ? "text-attention" : "text-bordure",
          )}
        >
          <path
            fill="currentColor"
            d="m12 4 2.4 5 5.6.8-4 3.9.9 5.5-4.9-2.6-4.9 2.6.9-5.5-4-3.9 5.6-.8L12 4Z"
          />
        </svg>
      ))}
    </span>
  );
}
