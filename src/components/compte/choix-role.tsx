"use client";

import { useTranslations } from "next-intl";
import { useId } from "react";

import { ROLES, type Role } from "@/domain/compte/roles";
import { cn } from "@/lib/cn";

export { ROLES, type Role };

const ICONES: Record<Role, React.ReactNode> = {
  // Une remorque vue de côté : ce qu'on vient chercher.
  locataire: (
    <path d="M2 14h13V8H2v6Zm0 0v2h2m11-2v2h-2M4 16a2 2 0 1 0 4 0 2 2 0 0 0-4 0Zm11 0a2 2 0 1 0 4 0 2 2 0 0 0-4 0Zm0-8h4l3 4v4h-3" />
  ),
  // Une clé : ce qu'on remet.
  proprietaire: (
    <path d="M15 7a4 4 0 1 1-3.9 5H8v3H5v-3H3v-3h8.1A4 4 0 0 1 15 7Zm1 3.5a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1Z" />
  ),
  // Deux flèches en boucle : l'aller et le retour.
  lesDeux: <path d="M4 8h12l-3-3m3 3-3 3M20 16H8l3-3m-3 3 3 3" />,
};

/**
 * Choix du rôle à l'inscription.
 *
 * Des cartes plutôt qu'une liste déroulante : c'est le premier choix
 * structurant du parcours — il décide de l'espace où l'on atterrit — et il
 * mérite d'être lu, pas déplié. Une liste aurait aussi masqué les descriptions,
 * qui sont ce qui permet de choisir.
 *
 * Techniquement, ce sont des boutons radio : la sélection reste unique, le
 * clavier fonctionne (flèches entre les options), les lecteurs d'écran
 * annoncent un groupe, et le champ est transmis par le formulaire sans une
 * ligne de JavaScript. Des `<div>` avec `onClick` auraient perdu les quatre.
 */
export function ChoixRole({
  valeur,
  surChangement,
  erreur,
}: {
  valeur: Role | null;
  surChangement: (role: Role) => void;
  erreur?: string;
}) {
  const t = useTranslations("compte.inscription.role");
  const identifiant = useId();
  const identifiantErreur = erreur ? `${identifiant}-erreur` : undefined;

  return (
    <fieldset aria-describedby={identifiantErreur}>
      <legend className="text-sm font-medium">{t("question")}</legend>
      <p className="mt-1 text-sm text-texte-attenue">{t("aide")}</p>

      <div className="mt-3 grid gap-3">
        {ROLES.map((role) => {
          const choisi = valeur === role;

          return (
            <label
              key={role}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-champ border p-4 transition-colors",
                choisi
                  ? "border-accent bg-accent/5"
                  : "border-bordure bg-fond-eleve hover:border-accent/50",
                // L'anneau de focus est porté par l'étiquette, le bouton radio
                // lui-même étant masqué : sans cela, la navigation au clavier
                // ne montrerait rien.
                "focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent",
              )}
            >
              <input
                type="radio"
                name="role"
                value={role}
                checked={choisi}
                onChange={() => surChangement(role)}
                required
                className="sr-only"
              />

              <span
                aria-hidden
                className={cn(
                  "mt-0.5 shrink-0",
                  choisi ? "text-accent" : "text-texte-attenue",
                )}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="size-6"
                >
                  {ICONES[role]}
                </svg>
              </span>

              <span className="min-w-0 flex-1">
                <span className="block font-medium">{t(`${role}.titre`)}</span>
                <span className="mt-0.5 block text-sm text-texte-attenue">
                  {t(`${role}.texte`)}
                </span>
              </span>

              {/* Pastille de sélection : la couleur du cadre seule ne suffit
                  pas à qui la distingue mal. */}
              <span
                aria-hidden
                className={cn(
                  "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border-2",
                  choisi ? "border-accent bg-accent" : "border-bordure",
                )}
              >
                {choisi ? (
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="var(--accent-contraste)"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="size-3"
                  >
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                ) : null}
              </span>
            </label>
          );
        })}
      </div>

      {erreur ? (
        <p id={identifiantErreur} role="alert" className="mt-2 text-sm text-danger">
          {erreur}
        </p>
      ) : null}
    </fieldset>
  );
}
