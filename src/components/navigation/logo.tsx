import { useTranslations } from "next-intl";

import { cn } from "@/lib/cn";

/**
 * Logo FlexiTrailer — version provisoire, redessinée d'après la maquette
 * fournie : l'arc ouvert, la remorque de profil, l'orange de signature.
 *
 * Dessiné en SVG plutôt qu'importé en image, pour trois raisons qu'un fichier
 * matriciel ne sait pas satisfaire : rester net à toute densité d'écran, peser
 * quelques centaines d'octets, et s'inverser sur fond profond.
 *
 * Le nom vient des traductions : le renommer ne demandera qu'une chaîne.
 *
 * La charte graphique définitive est un livrable de la phase 0 ; ce dessin est
 * une base de travail, pas une identité arrêtée.
 */
export function Logo({
  clair = false,
  className,
}: {
  /** Posé sur un fond profond ou une photographie. */
  clair?: boolean;
  className?: string;
}) {
  const t = useTranslations("commun");

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2.5",
        clair ? "text-encre-texte" : "text-texte",
        className,
      )}
    >
      <svg viewBox="0 0 40 40" aria-hidden className="size-9 shrink-0" fill="none">
        {/* Arc ouvert : orange au-dessus, encre en dessous. */}
        <path
          d="M6.6 27.5a16 16 0 0 1 24-20.2"
          stroke="var(--color-signal-500)"
          strokeWidth="2.6"
          strokeLinecap="round"
        />
        <path
          d="M33.7 13a16 16 0 0 1-27.1 14.5"
          stroke="currentColor"
          strokeWidth="2.6"
          strokeLinecap="round"
          opacity={clair ? 0.55 : 0.85}
        />

        {/* Remorque de profil, ridelles ouvertes. */}
        <path
          d="M14.5 16.5h13.2v7.2H14.5z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path
          d="M19 17v6.2M23.4 17v6.2"
          stroke="currentColor"
          strokeWidth="1.1"
          opacity="0.4"
        />
        {/* Timon et anneau d'attelage. */}
        <path
          d="M14.5 22.4 9.6 25"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
        />
        <circle cx="8.4" cy="25.6" r="1.5" stroke="currentColor" strokeWidth="1.6" />
        {/* Roue, en orange : le seul élément coloré du dessin. */}
        <circle
          cx="24"
          cy="26.4"
          r="3.1"
          stroke="var(--color-signal-500)"
          strokeWidth="2"
        />
      </svg>

      <span className="text-[1.125rem] leading-none font-extrabold tracking-[-0.03em]">
        Flexi<span className="text-signal-500">Trailer</span>
        <span className="sr-only"> — {t("signature")}</span>
      </span>
    </span>
  );
}
