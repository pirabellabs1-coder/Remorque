import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

export function Carte({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-carte border border-bordure bg-fond-eleve p-6",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** En-tête de page éditoriale : un seul `h1`, un chapô, rien d'autre. */
export function EnTetePage({
  surtitre,
  titre,
  chapo,
}: {
  surtitre?: string;
  titre: string;
  chapo?: string;
}) {
  return (
    <header className="mx-auto w-full max-w-3xl px-4 pt-16 pb-10 sm:px-6">
      {surtitre ? (
        <p className="text-sm font-medium uppercase tracking-widest text-accent">
          {surtitre}
        </p>
      ) : null}
      <h1 className="mt-3 text-balance text-4xl font-semibold sm:text-5xl">
        {titre}
      </h1>
      {chapo ? (
        <p className="mt-5 text-pretty text-lg text-texte-attenue">{chapo}</p>
      ) : null}
    </header>
  );
}

/**
 * Données structurées (M15). Le contenu est sérialisé côté serveur ; aucune
 * donnée saisie par un utilisateur ne doit transiter par ce composant.
 */
export function DonneesStructurees({ donnees }: { donnees: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(donnees).replace(/</g, "\\u003c"),
      }}
    />
  );
}
