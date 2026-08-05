import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

export function Carte({
  children,
  className,
  survol = false,
}: {
  children: ReactNode;
  className?: string;
  /** Réservé aux cartes cliquables : une carte inerte ne doit pas réagir. */
  survol?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-carte border border-bordure bg-fond-eleve p-6",
        "shadow-(--ombre-carte)",
        survol &&
          "transition-[box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-(--ombre-carte-active)",
        className,
      )}
    >
      {children}
    </div>
  );
}

/*
 * `EnTetePage` vivait ici. Il a été retiré au profit de `PageEditoriale`
 * (`ui/mise-en-page.tsx`), qui rend le même en-tête *et* possède la mesure de
 * la page.
 *
 * C'était tout le problème : l'en-tête imposait sa propre largeur, `max-w-3xl`,
 * tandis que chaque page choisissait la sienne pour le corps — `2xl`, `3xl`,
 * `4xl` ou `5xl` selon l'humeur. Le titre ne s'alignait donc jamais sur le
 * contenu qu'il annonçait. Le composant ne pouvait pas corriger cela seul,
 * puisque la largeur du corps lui échappait ; il fallait que la page entière
 * soit tenue par un même conteneur.
 */

/**
 * Données structurées (M15). Le contenu est sérialisé côté serveur ; aucune
 * donnée saisie par un utilisateur ne doit transiter par ce composant.
 */
export function DonneesStructurees({
  donnees,
}: {
  /** Un objet, ou plusieurs graphes à déclarer sur la même page. */
  donnees: object | object[];
}) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(donnees).replace(/</g, "\\u003c"),
      }}
    />
  );
}
