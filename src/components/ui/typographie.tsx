import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * Échelle typographique et rythme vertical.
 *
 * Centralisés ici pour une raison précise : quand chaque page compose ses
 * propres tailles, l'échelle se creuse — on se retrouve avec un titre à 36 px,
 * des sous-titres tous identiques et des intertitres à la taille du corps de
 * texte, sans rien entre les deux. Plus rien ne hiérarchise.
 *
 * Deux règles tiennent tout :
 *   1. une section prend l'un des quatre espacements de `ESPACEMENT` ;
 *   2. un titre prend l'un des niveaux ci-dessous, jamais une taille arbitraire.
 */

export const ESPACEMENT = {
  /** Section courante. */
  standard: "py-16 sm:py-24 lg:py-28",
  /** Section porteuse : bandeaux profonds, appel aux propriétaires. */
  majeure: "py-20 sm:py-28 lg:py-32",
  /** Section de liaison : bandeau de réassurance, maillage. */
  serree: "py-12 sm:py-16",
} as const;

export const TITRE = {
  /** Un seul par page. */
  page: "text-[2.125rem] leading-[1.03] tracking-[-0.035em] font-bold sm:text-[3.25rem] lg:text-[4rem]",
  section:
    "text-[1.75rem] leading-[1.08] tracking-[-0.025em] font-bold sm:text-[2.5rem]",
  carte:
    "text-[1.0625rem] leading-[1.3] tracking-[-0.01em] font-semibold sm:text-[1.125rem]",
} as const;

/**
 * Surtitre. Volontairement petit : à 14 px, un interlettrage large se lit comme
 * du corps de texte espacé, pas comme une étiquette.
 */
export function Surtitre({
  children,
  clair = false,
}: {
  children: ReactNode;
  clair?: boolean;
}) {
  return (
    <p
      className={cn(
        "text-[0.6875rem] font-semibold tracking-[0.14em] uppercase",
        clair ? "text-encre-texte-attenue" : "text-accent",
      )}
    >
      {children}
    </p>
  );
}

/**
 * Titre de section, avec son filet d'accent. Le filet donne un point d'appui
 * visuel à chaque section sans ajouter de couleur ni de texte.
 */
export function TitreSection({
  children,
  clair = false,
  className,
}: {
  children: ReactNode;
  clair?: boolean;
  className?: string;
}) {
  return (
    <h2
      className={cn(
        TITRE.section,
        "relative pb-5 text-balance",
        "after:absolute after:bottom-0 after:left-0 after:h-[3px] after:w-10 after:rounded-full",
        clair ? "after:bg-encre-texte" : "after:bg-accent",
        className,
      )}
    >
      {children}
    </h2>
  );
}

/** Chapô. Mesure bornée : au-delà de 46 caractères par ligne, on ne lit plus. */
export function Chapo({
  children,
  clair = false,
}: {
  children: ReactNode;
  clair?: boolean;
}) {
  return (
    <p
      className={cn(
        "mt-5 max-w-[46ch] text-[1.0625rem] leading-[1.6] text-pretty sm:text-[1.1875rem]",
        clair ? "text-encre-texte-attenue" : "text-texte-attenue",
      )}
    >
      {children}
    </p>
  );
}
