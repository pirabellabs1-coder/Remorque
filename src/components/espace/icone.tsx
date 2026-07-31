import { cn } from "@/lib/cn";

/**
 * Jeu d'icônes des espaces.
 *
 * Dessinées à la main plutôt qu'importées d'une bibliothèque : vingt icônes de
 * navigation représentent quelques centaines d'octets ici, contre plusieurs
 * dizaines de kilooctets pour un paquet complet dont on n'utiliserait qu'un
 * pour cent. Elles héritent de la couleur du texte et suivent donc l'état de
 * l'entrée de menu sans code supplémentaire.
 *
 * Toutes tracées sur une grille de 24, trait de 1,7 — sans quoi elles ne
 * paraissent pas du même jeu.
 */
const TRACES = {
  tableau: "M4 13h6V4H4v9Zm0 7h6v-4H4v4Zm10 0h6v-9h-6v9Zm0-16v4h6V4h-6Z",
  reservation:
    "M8 3v3m8-3v3M4 9h16M5 6h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z",
  coeur:
    "M12 20s-7-4.4-7-9.2A4.1 4.1 0 0 1 12 8a4.1 4.1 0 0 1 7 2.8C19 15.6 12 20 12 20Z",
  message: "M20 12a7 7 0 0 1-9.9 6.4L4 20l1.6-6.1A7 7 0 1 1 20 12Z",
  carte: "M3 8h18M5 6h14a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z",
  etoile: "m12 4 2.4 5 5.6.8-4 3.9.9 5.5-4.9-2.6-4.9 2.6.9-5.5-4-3.9 5.6-.8L12 4Z",
  profil: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0",
  reglages:
    "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.5-3a7.5 7.5 0 0 0-.1-1.2l2-1.5-2-3.4-2.3 1a7.4 7.4 0 0 0-2-1.2L14.7 3H9.3l-.4 2.7c-.7.3-1.4.7-2 1.2l-2.3-1-2 3.4 2 1.5a7.5 7.5 0 0 0 0 2.4l-2 1.5 2 3.4 2.3-1c.6.5 1.3.9 2 1.2l.4 2.7h5.4l.4-2.7c.7-.3 1.4-.7 2-1.2l2.3 1 2-3.4-2-1.5c.1-.4.1-.8.1-1.2Z",
  annonce: "M4 6h16M4 12h16M4 18h10",
  calendrier:
    "M8 3v3m8-3v3M4 9h16M5 6h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z",
  photo:
    "M5 5h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm-1 11 4.5-4.5 3 3L15 11l5 5M9 10a1.2 1.2 0 1 0 0-2.4A1.2 1.2 0 0 0 9 10Z",
  euro: "M17 6.5A6 6 0 0 0 8 9m0 6a6 6 0 0 0 9 2.5M4 10h8m-8 4h8",
  utilisateurs:
    "M9 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm-6 8a6 6 0 0 1 12 0m2-13.7a3.5 3.5 0 0 1 0 6.9M17 20a6 6 0 0 0-2-4.5",
  balance: "M12 4v16M6 20h12M12 7 5 10l3 4 3-4Zm0 0 7 3-3 4-3-4Z",
  bouclier: "M12 3 5 6v6c0 4.2 2.9 7.8 7 9 4.1-1.2 7-4.8 7-9V6l-7-3Z",
  globe: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm-9-9h18M12 3c2.5 2.4 3.8 5.5 3.8 9S14.5 18.6 12 21c-2.5-2.4-3.8-5.5-3.8-9S9.5 5.4 12 3Z",
  document: "M14 3v5h5M14 3H7a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V8l-4-5Z",
  aide: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-4.5v.01M9.8 9.3a2.2 2.2 0 1 1 3 2.1c-.5.3-.8.8-.8 1.4v.4",
  courbe: "M4 18l5-6 4 3 7-9M4 21h16",
  journal: "M6 4h9l3 3v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Zm2 6h8m-8 4h8m-8 4h5",
} as const;

export type NomIcone = keyof typeof TRACES;

export function Icone({
  nom,
  className,
}: {
  nom: NomIcone;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      fill="none"
      className={cn("size-5 shrink-0", className)}
    >
      <path
        d={TRACES[nom]}
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
