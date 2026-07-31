import { cn } from "@/lib/cn";

/**
 * Graphiques des espaces.
 *
 * Dessinés en SVG, sans bibliothèque. Une bibliothèque de graphes pèse de 50 à
 * 150 ko compressés et impose son propre modèle de thème ; nous affichons des
 * courbes, des barres et un anneau, soit trois cents lignes de géométrie qui
 * héritent naturellement des jetons de couleur du projet.
 *
 * Tous rendus par le serveur : ce sont des composants sans état, donc lisibles
 * avant l'hydratation et imprimables.
 *
 * Accessibilité — un graphique n'est pas lisible par un lecteur d'écran. Chacun
 * porte donc un `role="img"` et une description textuelle, et les écrans
 * doublent systématiquement la courbe d'un tableau ou d'une liste de valeurs.
 */

export type Point = {
  /** Libellé de l'abscisse — un mois, un jour. */
  etiquette: string;
  valeur: number;
};

/* ========================================================================== */
/*  Courbe                                                                    */
/* ========================================================================== */

/**
 * Courbe d'évolution, avec aire dégradée sous le tracé.
 *
 * L'axe des ordonnées part de zéro et non du minimum observé : tronquer la
 * base amplifie visuellement des écarts de quelques pour cent et donne à lire
 * une envolée là où il n'y a qu'une fluctuation.
 */
export function Courbe({
  points,
  description,
  format,
  className,
}: {
  points: Point[];
  description: string;
  format?: (valeur: number) => string;
  className?: string;
}) {
  if (points.length < 2) return null;

  const largeur = 640;
  const hauteur = 200;
  const margeBasse = 24;

  const maximum = Math.max(...points.map((point) => point.valeur), 1);
  const pas = largeur / (points.length - 1);

  const coordonnees = points.map((point, index) => {
    const x = index * pas;
    const y = (hauteur - margeBasse) * (1 - point.valeur / maximum);
    return { ...point, x, y };
  });

  const trace = coordonnees
    .map(({ x, y }, index) => `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`)
    .join(" ");

  const aire = `${trace} L${largeur} ${hauteur - margeBasse} L0 ${hauteur - margeBasse} Z`;

  const identifiant = `degrade-${description.replace(/\W/g, "").slice(0, 12)}`;

  return (
    <figure className={cn("w-full", className)}>
      <svg
        viewBox={`0 0 ${largeur} ${hauteur}`}
        role="img"
        aria-label={description}
        preserveAspectRatio="none"
        className="h-48 w-full"
      >
        <defs>
          <linearGradient id={identifiant} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Trois repères horizontaux : assez pour situer une valeur, assez peu
            pour ne pas quadriller le fond. */}
        {[0, 0.5, 1].map((fraction) => (
          <line
            key={fraction}
            x1="0"
            x2={largeur}
            y1={(hauteur - margeBasse) * fraction}
            y2={(hauteur - margeBasse) * fraction}
            stroke="var(--bordure)"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
        ))}

        <path d={aire} fill={`url(#${identifiant})`} />
        <path
          d={trace}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />

        {/* Dernier point marqué : c'est celui que l'on cherche du regard. */}
        <circle
          cx={coordonnees[coordonnees.length - 1].x}
          cy={coordonnees[coordonnees.length - 1].y}
          r="4"
          fill="var(--accent)"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      <div className="mt-1 flex justify-between text-xs text-texte-attenue">
        {points.map((point, index) => (
          <span
            key={point.etiquette}
            // Une étiquette sur deux au-delà de huit points : sinon elles se
            // chevauchent sur un téléphone.
            className={cn(points.length > 8 && index % 2 === 1 && "hidden sm:inline")}
          >
            {point.etiquette}
          </span>
        ))}
      </div>

      {format ? (
        <figcaption className="sr-only">
          {points
            .map((point) => `${point.etiquette} : ${format(point.valeur)}`)
            .join(", ")}
        </figcaption>
      ) : null}
    </figure>
  );
}

/* ========================================================================== */
/*  Barres                                                                    */
/* ========================================================================== */

/** Barres horizontales — pour comparer des catégories, non une évolution. */
export function Barres({
  points,
  format,
  className,
}: {
  points: Point[];
  format?: (valeur: number) => string;
  className?: string;
}) {
  const maximum = Math.max(...points.map((point) => point.valeur), 1);

  return (
    <ul className={cn("space-y-3", className)}>
      {points.map((point) => (
        <li key={point.etiquette}>
          <div className="flex items-baseline justify-between gap-4 text-sm">
            <span className="truncate">{point.etiquette}</span>
            <span className="shrink-0 font-medium tabular-nums">
              {format ? format(point.valeur) : point.valeur}
            </span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-fond-doux">
            <div
              className="h-full rounded-full bg-accent"
              style={{ width: `${Math.max((point.valeur / maximum) * 100, 2)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/* ========================================================================== */
/*  Anneau                                                                    */
/* ========================================================================== */

/**
 * Anneau de répartition.
 *
 * Limité à quatre parts au-delà desquelles on regroupe : un anneau à douze
 * secteurs ne se lit pas, il se déchiffre — et une liste ferait mieux.
 */
export function Anneau({
  parts,
  centre,
  legende,
  className,
}: {
  parts: { etiquette: string; valeur: number; teinte: string }[];
  centre: string;
  legende: string;
  className?: string;
}) {
  const total = parts.reduce((somme, part) => somme + part.valeur, 0) || 1;
  const rayon = 60;
  const circonference = 2 * Math.PI * rayon;

  // Les décalages sont calculés avant le rendu plutôt qu'accumulés dans le
  // `map` : muter une variable pendant le rendu est interdit en React, et
  // rendrait le composant faux si React reprenait le rendu à mi-chemin.
  const secteurs = parts.reduce<
    { etiquette: string; teinte: string; longueur: number; decalage: number }[]
  >((liste, part) => {
    const parcouru = liste.reduce((somme, secteur) => somme + secteur.longueur, 0);
    liste.push({
      etiquette: part.etiquette,
      teinte: part.teinte,
      longueur: (part.valeur / total) * circonference,
      decalage: -parcouru,
    });
    return liste;
  }, []);

  return (
    <div className={cn("flex flex-wrap items-center gap-6", className)}>
      <div className="relative shrink-0">
        <svg
          viewBox="0 0 160 160"
          role="img"
          aria-label={legende}
          className="size-40 -rotate-90"
        >
          <circle
            cx="80"
            cy="80"
            r={rayon}
            fill="none"
            stroke="var(--fond-doux)"
            strokeWidth="20"
          />
          {secteurs.map((secteur) => (
            <circle
              key={secteur.etiquette}
              cx="80"
              cy="80"
              r={rayon}
              fill="none"
              stroke={secteur.teinte}
              strokeWidth="20"
              strokeDasharray={`${secteur.longueur} ${circonference - secteur.longueur}`}
              strokeDashoffset={secteur.decalage}
            />
          ))}
        </svg>
        <p className="absolute inset-0 grid place-items-center text-center text-[1.375rem] font-bold tabular-nums">
          {centre}
        </p>
      </div>

      <ul className="min-w-0 flex-1 space-y-2 text-sm">
        {parts.map((part) => (
          <li key={part.etiquette} className="flex items-center gap-3">
            <span
              aria-hidden
              className="size-3 shrink-0 rounded-[3px]"
              style={{ background: part.teinte }}
            />
            <span className="min-w-0 flex-1 truncate">{part.etiquette}</span>
            <span className="shrink-0 font-medium tabular-nums">
              {Math.round((part.valeur / total) * 100)} %
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ========================================================================== */
/*  Étincelle                                                                 */
/* ========================================================================== */

/** Micro-courbe, à poser dans une carte d'indicateur. Purement décorative. */
export function Etincelle({ valeurs }: { valeurs: number[] }) {
  if (valeurs.length < 2) return null;

  const maximum = Math.max(...valeurs, 1);
  const pas = 100 / (valeurs.length - 1);
  const trace = valeurs
    .map((valeur, index) => {
      const x = index * pas;
      const y = 28 * (1 - valeur / maximum);
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg viewBox="0 0 100 30" aria-hidden className="h-8 w-24" preserveAspectRatio="none">
      <path
        d={trace}
        fill="none"
        stroke="var(--accent)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
