import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * Bandeau d'attente de données.
 *
 * Les trois espaces sont construits avant la base. Plutôt que de les remplir
 * de chiffres inventés — qui finiraient tôt ou tard sur une capture d'écran
 * présentée comme réelle —, chaque tableau de bord dit ce qu'il en est. Un
 * écran honnête se recette ; un écran truqué se croit terminé.
 */
export function BanniereEnAttente({ children }: { children: ReactNode }) {
  return (
    <p
      role="status"
      className="rounded-champ border border-attention/30 bg-attention/5 px-4 py-3 text-[0.9375rem] text-attention"
    >
      {children}
    </p>
  );
}

/**
 * Indicateur chiffré. `valeur` reste absente tant que la donnée n'existe pas —
 * le tiret cadratin est un état, pas un zéro : zéro réservation et « on ne
 * sait pas encore » ne se disent pas de la même manière.
 */
export function CarteIndicateur({
  libelle,
  valeur,
  precision,
  className,
}: {
  libelle: string;
  valeur?: ReactNode;
  precision?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-carte border border-bordure bg-fond-eleve p-5 shadow-(--ombre-carte)",
        className,
      )}
    >
      <p className="text-[0.8125rem] text-texte-attenue">{libelle}</p>
      <p
        className={cn(
          "mt-2 text-[2rem] leading-none font-bold tracking-[-0.03em] tabular-nums",
          valeur === undefined && "text-texte-attenue",
        )}
      >
        {valeur ?? "—"}
      </p>
      {precision ? (
        <p className="mt-2 text-xs text-texte-attenue">{precision}</p>
      ) : null}
    </div>
  );
}

/** Bloc vide d'une liste : ce que l'on verra tant qu'il n'y a rien à voir. */
export function ListeVide({
  titre,
  texte,
  action,
}: {
  titre: string;
  texte: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-carte border border-dashed border-bordure bg-fond-eleve px-6 py-12 text-center">
      <p className="font-medium">{titre}</p>
      <p className="mx-auto mt-2 max-w-md text-[0.9375rem] text-texte-attenue">
        {texte}
      </p>
      {action ? <div className="mt-6 flex justify-center">{action}</div> : null}
    </div>
  );
}
