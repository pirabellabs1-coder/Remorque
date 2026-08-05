import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * Les briques de la fiche annonce.
 *
 * La fiche était plate : des titres séparés par des filets, une description en
 * paragraphe nu, des caractéristiques en grille sans contour. Rien ne disait
 * où commençait une information et où finissait la précédente, et l'œil
 * glissait sans accrocher.
 *
 * Le remède n'est pas d'ajouter des bordures partout — une page entièrement
 * encadrée est aussi illisible qu'une page qui ne l'est pas du tout. C'est
 * d'établir **deux niveaux** et de s'y tenir :
 *
 *  — `BlocFiche` encadre ce qui se consulte : caractéristiques, équipements,
 *    avis, loueur. Chaque bloc est une carte, avec son titre en en-tête.
 *  — `ChiffresCles` ne s'encadre pas : c'est un bandeau de valeurs que l'on
 *    lit d'un seul mouvement, juste sous la photographie.
 *
 * Deux niveaux se retiennent. Quatre ne se retiennent pas, et c'est ainsi
 * qu'une page finit par ressembler à un tableau de bord d'avion.
 */

/* -------------------------------------------------------------------------- */
/*  Bloc encadré                                                              */
/* -------------------------------------------------------------------------- */

export function BlocFiche({
  titre,
  aparte,
  action,
  children,
  className,
}: {
  titre: string;
  /** Complément affiché à droite du titre : un compte, une note. */
  aparte?: ReactNode;
  /** Lien ou bouton en pied de bloc. */
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-carte border border-bordure bg-fond-eleve shadow-(--ombre-carte)",
        className,
      )}
    >
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-bordure px-5 py-3.5 sm:px-6">
        <h2 className="text-[1.0625rem] font-semibold">{titre}</h2>
        {aparte ? (
          <span className="text-sm text-texte-attenue">{aparte}</span>
        ) : null}
      </header>

      <div className="px-5 py-5 sm:px-6">{children}</div>

      {action ? (
        <footer className="border-t border-bordure px-5 py-3.5 sm:px-6">
          {action}
        </footer>
      ) : null}
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Chiffres clés                                                             */
/* -------------------------------------------------------------------------- */

export type ChiffreCle = {
  libelle: string;
  valeur: string;
  /** Précision sous la valeur, en petit. */
  precision?: string;
};

/**
 * Bandeau des quatre ou cinq chiffres qui décident de la location.
 *
 * Le PTAC et la charge utile ne sont pas des caractéristiques parmi d'autres :
 * ce sont les deux nombres qui déterminent si la remorque convient, et si le
 * permis suffit. Les noyer au milieu de sept lignes de spécifications oblige à
 * les chercher. Ils sont donc sortis du lot, sous la photographie, à l'endroit
 * où l'œil arrive naturellement après l'image.
 *
 * Séparateurs verticaux plutôt que cartes individuelles : c'est une seule
 * information en quatre parties, pas quatre informations.
 */
export function ChiffresCles({ entrees }: { entrees: ChiffreCle[] }) {
  return (
    <dl className="grid grid-cols-2 divide-bordure overflow-hidden rounded-carte border border-bordure bg-fond-eleve shadow-(--ombre-carte) sm:grid-cols-4 sm:divide-x">
      {entrees.map((entree, index) => (
        <div
          key={entree.libelle}
          className={cn(
            "px-5 py-4",
            // Les filets horizontaux n'existent que sur deux colonnes ; en
            // rangée unique, seuls les filets verticaux ont un sens.
            index >= 2 && "border-t border-bordure sm:border-t-0",
            index % 2 === 1 && "border-l border-bordure sm:border-l-0",
          )}
        >
          <dt className="text-[0.8125rem] text-texte-attenue">
            {entree.libelle}
          </dt>
          <dd className="mt-1 text-xl font-bold tracking-[-0.02em] tabular-nums">
            {entree.valeur}
          </dd>
          {entree.precision ? (
            <p className="mt-0.5 text-xs text-texte-attenue">
              {entree.precision}
            </p>
          ) : null}
        </div>
      ))}
    </dl>
  );
}

/* -------------------------------------------------------------------------- */
/*  Liste de caractéristiques                                                 */
/* -------------------------------------------------------------------------- */

export type Caracteristique = { cle: string; valeur: string };

/**
 * Caractéristiques détaillées, en lignes plutôt qu'en grille.
 *
 * Une grille de paires libellé-valeur oblige à associer chaque valeur à son
 * libellé par la position, ce qui se fait mal dès que les longueurs diffèrent.
 * En lignes, avec le libellé à gauche et la valeur alignée à droite, la lecture
 * est immédiate et le tout reste lisible sur un téléphone — où plus de 70 % du
 * trafic est attendu.
 */
export function ListeCaracteristiques({
  entrees,
}: {
  entrees: Caracteristique[];
}) {
  return (
    <dl className="divide-y divide-bordure">
      {entrees.map((entree) => (
        <div
          key={entree.cle}
          className="flex items-baseline justify-between gap-6 py-2.5 first:pt-0 last:pb-0"
        >
          <dt className="text-[0.9375rem] text-texte-attenue">{entree.cle}</dt>
          <dd className="text-right text-[0.9375rem] font-medium tabular-nums">
            {entree.valeur}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/* -------------------------------------------------------------------------- */
/*  Répartition des notes                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Histogramme des notes.
 *
 * Une moyenne de 4,6 ne dit pas la même chose selon qu'elle vient de vingt avis
 * à 5 et deux à 1, ou de vingt-deux avis à 4 et 5. C'est exactement ce qu'un
 * locataire cherche à savoir avant de confier six cents euros de caution à un
 * inconnu, et une moyenne seule le lui cache.
 */
export function RepartitionNotes({
  repartition,
  total,
  libelle,
}: {
  /** Cinq entrées, de 5 étoiles à 1. */
  repartition: { note: number; nombre: number }[];
  total: number;
  libelle: (note: number) => string;
}) {
  return (
    <ul className="space-y-1.5">
      {repartition.map((ligne) => {
        const part = total > 0 ? (ligne.nombre / total) * 100 : 0;

        return (
          <li key={ligne.note} className="flex items-center gap-3">
            <span className="w-16 shrink-0 text-sm text-texte-attenue">
              {libelle(ligne.note)}
            </span>
            <span
              className="h-2 flex-1 overflow-hidden rounded-full bg-fond-doux"
              role="img"
              aria-label={`${ligne.nombre} / ${total}`}
            >
              <span
                className="block h-full rounded-full bg-accent"
                style={{ width: `${part}%` }}
              />
            </span>
            <span className="w-6 shrink-0 text-right text-sm tabular-nums text-texte-attenue">
              {ligne.nombre}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
