import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * Tableau de données de l'administration.
 *
 * Les treize écrans d'administration sont, pour l'essentiel, des tableaux. Les
 * réécrire chacun ferait diverger les alignements, les hauteurs de ligne et le
 * comportement au défilement — et rendrait toute correction treize fois plus
 * coûteuse.
 *
 * Le défilement horizontal est confié à un conteneur dédié : c'est la page
 * entière qui ne doit jamais défiler latéralement, seul le tableau le peut.
 */

export type Colonne = {
  cle: string;
  entete: string;
  /** Les montants et les compteurs s'alignent à droite, le texte à gauche. */
  numerique?: boolean;
  /** Masquée sous `lg` : sur un téléphone, six colonnes ne se lisent pas. */
  secondaire?: boolean;
};

export function Tableau({
  colonnes,
  children,
  pied,
  className,
}: {
  colonnes: Colonne[];
  children: ReactNode;
  pied?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-x-auto rounded-carte border border-bordure bg-fond-eleve shadow-(--ombre-carte)",
        className,
      )}
    >
      <table className="w-full text-left text-[0.9375rem]">
        <thead className="border-b border-bordure text-sm text-texte-attenue">
          <tr>
            {colonnes.map((colonne) => (
              <th
                key={colonne.cle}
                scope="col"
                className={cn(
                  "px-5 py-3 font-medium whitespace-nowrap",
                  colonne.numerique && "text-right",
                  colonne.secondaire && "hidden lg:table-cell",
                )}
              >
                {colonne.entete}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-bordure">{children}</tbody>
        {pied ? (
          <tfoot className="border-t-2 border-bordure font-semibold">{pied}</tfoot>
        ) : null}
      </table>
    </div>
  );
}

/** Cellule ordinaire. `numerique` aligne à droite et fixe la chasse des chiffres. */
export function Cellule({
  children,
  numerique,
  secondaire,
  attenue,
  className,
}: {
  children: ReactNode;
  numerique?: boolean;
  secondaire?: boolean;
  attenue?: boolean;
  className?: string;
}) {
  return (
    <td
      className={cn(
        "px-5 py-3.5",
        numerique && "text-right tabular-nums",
        secondaire && "hidden lg:table-cell",
        attenue && "text-texte-attenue",
        className,
      )}
    >
      {children}
    </td>
  );
}

/**
 * Pastille générique, pour les statuts qui ne sont pas ceux d'une réservation.
 *
 * Le libellé est toujours écrit : la couleur ne fait que le doubler, jamais le
 * remplacer.
 */
const TONS = {
  neutre: "border-bordure bg-fond-doux text-texte-attenue",
  attente: "border-attention/30 bg-attention/10 text-attention",
  actif: "border-accent/30 bg-accent/10 text-accent",
  succes: "border-succes/30 bg-succes/10 text-succes",
  danger: "border-danger/30 bg-danger/10 text-danger",
} as const;

export type TonPastille = keyof typeof TONS;

export function Pastille({
  ton = "neutre",
  children,
}: {
  ton?: TonPastille;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-xs font-medium whitespace-nowrap",
        TONS[ton],
      )}
    >
      {children}
    </span>
  );
}
