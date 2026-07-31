"use client";

import { useId, type ComponentProps, type ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * Champ de formulaire.
 *
 * Le libellé est toujours visible — jamais remplacé par un texte de
 * substitution, qui disparaît dès la première frappe et laisse l'utilisateur
 * deviner ce qu'il est en train de remplir. L'aide et l'erreur sont reliées au
 * champ par `aria-describedby`, sinon un lecteur d'écran ne les annonce jamais.
 */
export function Champ({
  libelle,
  aide,
  erreur,
  action,
  className,
  ...props
}: {
  libelle: string;
  aide?: string;
  erreur?: string;
  /** Lien affiché à droite du libellé, tel que « Mot de passe oublié ». */
  action?: ReactNode;
} & ComponentProps<"input">) {
  const genere = useId();
  const identifiant = props.id ?? genere;
  const identifiantAide = aide ? `${identifiant}-aide` : undefined;
  const identifiantErreur = erreur ? `${identifiant}-erreur` : undefined;

  return (
    <div className={className}>
      <div className="flex items-baseline justify-between gap-4">
        <label htmlFor={identifiant} className="text-sm font-medium">
          {libelle}
        </label>
        {action}
      </div>

      <input
        {...props}
        id={identifiant}
        aria-invalid={erreur ? true : undefined}
        aria-describedby={
          [identifiantAide, identifiantErreur].filter(Boolean).join(" ") ||
          undefined
        }
        className={cn(
          "mt-2 h-12 w-full rounded-champ border bg-fond-eleve px-4 text-base",
          "transition-colors placeholder:text-texte-attenue/70",
          erreur ? "border-danger" : "border-bordure focus:border-accent",
        )}
      />

      {aide && !erreur ? (
        <p id={identifiantAide} className="mt-2 text-sm text-texte-attenue">
          {aide}
        </p>
      ) : null}
      {erreur ? (
        <p id={identifiantErreur} className="mt-2 text-sm text-danger">
          {erreur}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Séparateur « ou ». Purement visuel : le trait est masqué aux technologies
 * d'assistance, seul le mot est annoncé.
 */
export function Separateur({ libelle }: { libelle: string }) {
  return (
    <div className="flex items-center gap-4">
      <span aria-hidden className="h-px flex-1 bg-bordure" />
      <span className="text-xs tracking-wide text-texte-attenue uppercase">
        {libelle}
      </span>
      <span aria-hidden className="h-px flex-1 bg-bordure" />
    </div>
  );
}
