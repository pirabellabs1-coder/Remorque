import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * Mise en page des pages éditoriales.
 *
 * Le défaut était partout le même, et venait d'une seule cause : chaque page
 * choisissait sa largeur dans son coin. L'en-tête était figé à `max-w-3xl`
 * tandis que les corps oscillaient entre `2xl`, `3xl`, `4xl` et `5xl` — sept
 * combinaisons pour huit pages. Résultat : le titre ne s'alignait jamais sur
 * le contenu qu'il annonçait, et le tout donnait l'impression d'un bloc de
 * texte centré au milieu du vide plutôt que d'une page composée.
 *
 * `PageEditoriale` possède la mesure et la donne à l'en-tête comme au corps.
 * Une page ne choisit plus une largeur, elle choisit une **densité** :
 *
 *  — `texte` pour ce qui se lit en continu, autour de 70 signes par ligne,
 *    au-delà desquels l'œil perd la ligne suivante en revenant à la marge ;
 *  — `mixte` pour l'alternance de prose et de blocs, le cas ordinaire ;
 *  — `large` pour les grilles et les tableaux comparatifs.
 *
 * Trois densités nommées se discutent en recette. Sept largeurs numériques ne
 * se discutent pas — elles se subissent.
 */

const LARGEURS = {
  texte: "max-w-3xl",
  mixte: "max-w-4xl",
  large: "max-w-6xl",
} as const;

export type Densite = keyof typeof LARGEURS;

export function PageEditoriale({
  surtitre,
  titre,
  chapo,
  densite = "mixte",
  children,
}: {
  surtitre?: string;
  titre: string;
  chapo?: string;
  densite?: Densite;
  children: ReactNode;
}) {
  const mesure = LARGEURS[densite];

  return (
    <main className="pb-24">
      {/* L'en-tête partage la mesure du corps : c'est tout le propos. Le chapô
          reste plus étroit que le titre, parce qu'il se lit en continu là où le
          titre s'embrasse d'un regard. */}
      <header className={cn("mx-auto w-full px-4 pt-14 pb-10 sm:px-6", mesure)}>
        {surtitre ? (
          <p className="text-sm font-medium tracking-widest text-accent uppercase">
            {surtitre}
          </p>
        ) : null}
        <h1 className="mt-3 text-4xl font-semibold text-balance sm:text-5xl">
          {titre}
        </h1>
        {chapo ? (
          <p className="mt-5 max-w-2xl text-lg text-pretty text-texte-attenue">
            {chapo}
          </p>
        ) : null}
      </header>

      <div className={cn("mx-auto w-full px-4 sm:px-6", mesure)}>{children}</div>
    </main>
  );
}

/* -------------------------------------------------------------------------- */
/*  Section                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Section éditoriale.
 *
 * L'espacement entre sections est ici et nulle part ailleurs. Quand chaque page
 * décide de son `mt-16` ou de son `mt-8`, le rythme vertical diffère d'une page
 * à l'autre sans qu'aucune ne soit fautive, et le site paraît assemblé de
 * morceaux.
 */
export function SectionEditoriale({
  titre,
  chapo,
  children,
  className,
}: {
  titre?: string;
  chapo?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("mt-14 first:mt-0", className)}>
      {titre ? (
        <h2 className="text-2xl font-semibold tracking-tight text-balance">
          {titre}
        </h2>
      ) : null}
      {chapo ? (
        <p className="mt-3 max-w-2xl text-pretty text-texte-attenue">{chapo}</p>
      ) : null}
      <div className={titre || chapo ? "mt-6" : undefined}>{children}</div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Liste de points                                                           */
/* -------------------------------------------------------------------------- */

export type Point = {
  titre: string;
  texte: string;
};

/**
 * Liste de garanties ou d'arguments, en cartes plutôt qu'en filets.
 *
 * Ces listes étaient rendues en `<li>` séparés par un trait supérieur. Quatre
 * paragraphes empilés sous un même titre se lisent comme un seul bloc gris :
 * on ne distingue plus quatre engagements, on voit un pavé. En cartes, chaque
 * point redevient une unité que l'on peut citer, comparer, contester.
 *
 * Le titre de chaque point est obligatoire. Une carte sans titre n'apporte
 * rien qu'un paragraphe n'apporterait déjà — elle ne fait qu'ajouter une
 * bordure autour du même pavé.
 */
export function ListePoints({
  points,
  colonnes = 2,
}: {
  points: Point[];
  colonnes?: 1 | 2 | 3;
}) {
  const GRILLES = {
    1: "sm:grid-cols-1",
    2: "sm:grid-cols-2",
    3: "sm:grid-cols-2 lg:grid-cols-3",
  } as const;

  return (
    <ul className={cn("grid gap-4", GRILLES[colonnes])}>
      {points.map((point) => (
        <li
          key={point.titre}
          className="rounded-carte border border-bordure bg-fond-eleve p-5 shadow-(--ombre-carte)"
        >
          <h3 className="font-semibold">{point.titre}</h3>
          <p className="mt-2 text-[0.9375rem] text-pretty text-texte-attenue">
            {point.texte}
          </p>
        </li>
      ))}
    </ul>
  );
}

/* -------------------------------------------------------------------------- */
/*  Appel à l'action                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Bandeau de fin de page.
 *
 * Une page éditoriale qui se termine sur son dernier paragraphe laisse le
 * lecteur convaincu et sans rien à faire. Le bandeau n'est pas un ornement :
 * c'est la sortie de la page.
 */
export function AppelAction({
  titre,
  texte,
  children,
}: {
  titre: string;
  texte?: string;
  children: ReactNode;
}) {
  return (
    <section className="mt-16 rounded-carte border border-bordure bg-fond-doux px-6 py-8 text-center sm:px-10 sm:py-10">
      <h2 className="text-2xl font-semibold text-balance">{titre}</h2>
      {texte ? (
        <p className="mx-auto mt-3 max-w-xl text-pretty text-texte-attenue">
          {texte}
        </p>
      ) : null}
      <div className="mt-7 flex flex-wrap justify-center gap-3">{children}</div>
    </section>
  );
}
