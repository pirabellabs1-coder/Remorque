import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";

import { cn } from "@/lib/cn";

type Variante =
  | "principal"
  | "secondaire"
  | "fantome"
  | "discret"
  | "danger";
type Taille = "petit" | "moyen" | "grand";

const VARIANTES: Record<Variante, string> = {
  principal: "bg-accent text-accent-contraste hover:opacity-90",
  secondaire: "border border-bordure bg-fond-eleve hover:bg-fond",
  /** Posé sur une photographie ou un bandeau profond. */
  fantome:
    "border border-encre-bordure bg-white/10 text-encre-texte backdrop-blur-sm hover:bg-white/20",
  discret: "text-texte-attenue hover:text-texte",
  danger: "bg-danger text-white hover:opacity-90",
};

const TAILLES: Record<Taille, string> = {
  // Cible tactile d'au moins 44 px sur les tailles moyenne et grande :
  // plus de 70 % du trafic sera mobile (M23).
  petit: "h-9 px-3 text-sm",
  moyen: "h-11 px-5 text-[0.9375rem]",
  grand: "h-13 px-6 text-base",
};

type BoutonProps<T extends ElementType> = {
  as?: T;
  variante?: Variante;
  taille?: Taille;
  pleineLargeur?: boolean;
  children: ReactNode;
} & Omit<ComponentPropsWithoutRef<T>, "as" | "children">;

/**
 * Bouton du système de composants.
 *
 * `as` permet de rendre un lien tout en conservant l'apparence : un élément
 * qui navigue doit rester un `<a>` pour l'accessibilité et l'ouverture dans un
 * nouvel onglet (M21).
 */
export function Bouton<T extends ElementType = "button">({
  as,
  variante = "principal",
  taille = "moyen",
  pleineLargeur = false,
  className,
  children,
  ...props
}: BoutonProps<T>) {
  const Composant = (as ?? "button") as ElementType;

  return (
    <Composant
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-champ font-medium",
        "transition-opacity disabled:cursor-not-allowed disabled:opacity-50",
        VARIANTES[variante],
        TAILLES[taille],
        pleineLargeur && "w-full",
        className,
      )}
      {...props}
    >
      {children}
    </Composant>
  );
}
