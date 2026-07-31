import type { ComponentProps, ReactNode } from "react";

import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";

/**
 * Tuile de navigation : un libellé, un chevron, une cible.
 *
 * Sert aux grilles d'exploration — villes, catégories, régions. Le chevron
 * n'est pas décoratif : dans une grille de trente cellules encadrées, c'est
 * lui qui dit que chaque cellule est cliquable, là où un simple cadre se lit
 * comme une étiquette.
 *
 * La hauteur minimale de 48 px tient la cible tactile même quand le libellé
 * tient sur une ligne (M23 — plus de 70 % du trafic sera mobile).
 */
export function TuileLien({
  href,
  children,
  legende,
  className,
}: {
  href: ComponentProps<typeof Link>["href"];
  children: ReactNode;
  /** Précision discrète : province, département, nombre de places… */
  legende?: ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group flex min-h-12 items-center justify-between gap-3",
        "rounded-champ border border-bordure bg-fond-eleve px-4 py-2.5",
        "transition-[border-color,box-shadow,transform] duration-200",
        "hover:-translate-y-0.5 hover:border-accent hover:shadow-(--ombre-carte)",
        className,
      )}
    >
      <span className="min-w-0">
        <span className="block truncate text-[0.9375rem] font-medium group-hover:text-accent">
          {children}
        </span>
        {legende ? (
          <span className="block truncate text-xs text-texte-attenue">
            {legende}
          </span>
        ) : null}
      </span>

      <svg
        viewBox="0 0 12 12"
        aria-hidden
        className="size-3 shrink-0 text-texte-attenue transition-[transform,color] duration-200 group-hover:translate-x-0.5 group-hover:text-accent"
        fill="none"
      >
        <path
          d="m4.5 2.5 3.5 3.5-3.5 3.5"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </Link>
  );
}
