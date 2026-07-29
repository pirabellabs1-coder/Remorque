export type Etape = { titre: string; texte: string };

/**
 * Parcours en quatre étapes (section 6). Numérotation portée par une liste
 * ordonnée : un lecteur d'écran doit annoncer « 2 sur 4 », pas lire un chiffre
 * décoratif isolé (M21 — accessibilité).
 */
export function Etapes({ etapes }: { etapes: Etape[] }) {
  return (
    <ol className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
      {etapes.map((etape, index) => (
        <li
          key={etape.titre}
          className="rounded-carte border border-bordure bg-fond-eleve p-6"
        >
          <span
            aria-hidden
            className="inline-flex size-9 items-center justify-center rounded-full bg-accent font-semibold text-accent-contraste"
          >
            {index + 1}
          </span>
          <h3 className="mt-4 font-semibold">{etape.titre}</h3>
          <p className="mt-2 text-sm text-texte-attenue">{etape.texte}</p>
        </li>
      ))}
    </ol>
  );
}
