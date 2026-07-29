import Image from "next/image";

import { cn } from "@/lib/cn";

/**
 * Emplacement photographique.
 *
 * Toutes les images de l'espace public passent par ce composant. Tant qu'une
 * photographie n'a pas été fournie, il rend un aplat de marque texturé plutôt
 * qu'une image cassée ou un cadre gris : la page reste présentable en revue,
 * et l'emplacement conserve exactement les proportions de la photo définitive.
 *
 * Le jour où les visuels arrivent, il suffit d'ajouter `src` — aucune mise en
 * page ne bouge, puisque le rapport de forme est porté par le conteneur.
 *
 * `alt` est obligatoire, y compris sans image : le texte alternatif fait
 * partie de la conception, pas de l'intégration (M21 — accessibilité).
 *
 * Le conteneur est toujours `relative` — c'est ce dont `fill` a besoin pour se
 * dimensionner. Il ne faut donc jamais lui passer `absolute` : les deux classes
 * entreraient en conflit et la hauteur retomberait à zéro. Pour un fond en
 * pleine largeur, envelopper le composant dans un conteneur positionné :
 *
 *     <div className="absolute inset-0">
 *       <Illustration className="h-full w-full" … />
 *     </div>
 */
export function Illustration({
  src,
  alt,
  className,
  priorite = false,
  tailles = "100vw",
}: {
  src?: string;
  alt: string;
  className?: string;
  /** À réserver à l'image de première vue, jamais aux suivantes. */
  priorite?: boolean;
  tailles?: string;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden bg-marque-900",
        !src && "isolate",
        className,
      )}
    >
      {src ? (
        <Image
          src={src}
          alt={alt}
          fill
          sizes={tailles}
          priority={priorite}
          className="object-cover"
        />
      ) : (
        <div
          role="img"
          aria-label={alt}
          className="absolute inset-0 bg-linear-160 from-marque-700 via-marque-900 to-marque-950"
        >
          {/* Trame diagonale discrète, dans l'esprit d'un marquage de hayon. */}
          <div
            aria-hidden
            className="absolute inset-0 opacity-[0.14]"
            style={{
              backgroundImage:
                "repeating-linear-gradient(135deg, #ffffff 0 2px, transparent 2px 14px)",
            }}
          />
          <div
            aria-hidden
            className="absolute inset-0 bg-radial-[at_30%_20%] from-white/20 to-transparent to-70%"
          />
        </div>
      )}
    </div>
  );
}
