"use client";

import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";

import "maplibre-gl/dist/maplibre-gl.css";

export type PointAnnonce = {
  id: string;
  titre: string;
  ville: string;
  /** Prix par jour, déjà mis en forme dans la devise du pays. */
  prix: string;
  /** Photo de couverture : c'est elle qui fait le marqueur. */
  photo: string;
  longitude: number;
  latitude: number;
  /** Adresse publique complète, calculée côté serveur. */
  href: string;
};

/**
 * Carte des annonces — la toile elle-même.
 *
 * Chaque annonce est une pastille de prix, et **chaque pastille est un lien**.
 * Pas de fenêtre intermédiaire, pas d'écouteur de clic : une ancre ordinaire,
 * qui s'ouvre dans un nouvel onglet avec le clic du milieu, se copie par le
 * menu contextuel, et se prend au clavier. Une carte reste une carte, mais
 * ce qu'on y clique se comporte comme le reste du web.
 *
 * La bibliothèque est importée statiquement ici, et ce module est chargé par
 * `next/dynamic` — voir `carte-annonces.tsx` pour la raison, et
 * `scripts/copier-worker-carto.mjs` pour le fil d'exécution.
 */
export default function CarteAnnoncesToile({
  points,
  styleUrl,
  etiquette,
}: {
  points: PointAnnonce[];
  styleUrl: string;
  etiquette: string;
}) {
  const cadre = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!cadre.current || points.length === 0) return;

    maplibregl.setWorkerUrl("/cartographie/maplibre-gl-worker.mjs");

    const carte = new maplibregl.Map({
      container: cadre.current,
      style: styleUrl,
      // Un centre provisoire : le cadrage définitif est calculé plus bas à
      // partir des annonces elles-mêmes.
      center: [points[0].longitude, points[0].latitude],
      zoom: 5,
      pitchWithRotate: false,
      dragRotate: false,
      attributionControl: { compact: true },
    });

    carte.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

    // La photo plutôt que le prix. Sur une carte, un chiffre ne dit pas de
    // quoi il s'agit — « 35 € » peut être une benne comme un van à chevaux —
    // alors qu'une vignette se reconnaît sans être lue, et se distingue de ses
    // voisines d'un seul regard. Le prix reste dans l'infobulle et dans le
    // libellé accessible, où il ne prend la place de rien.
    const marqueurs = points.map((point) => {
      const vignette = document.createElement("a");
      vignette.href = point.href;
      vignette.title = `${point.titre} — ${point.ville} · ${point.prix}`;
      vignette.setAttribute(
        "aria-label",
        `${point.titre}, ${point.ville}, ${point.prix}`,
      );
      // **Aucune transformation sur l'élément du marqueur.** MapLibre le
      // positionne au moyen d'un `transform: translate(...)` posé en ligne ;
      // un `scale` de survol appliqué ici l'écrase et projette le marqueur à
      // l'autre bout de la carte. Il fuyait donc le curseur, et devenait
      // impossible à cliquer. L'effet vit sur un élément intérieur, que
      // personne ne positionne.
      vignette.className = "group block cursor-pointer";

      const enveloppe = document.createElement("span");
      enveloppe.className =
        "block size-12 overflow-hidden rounded-full border-2 border-white bg-fond-eleve shadow-lg transition-transform duration-150 group-hover:scale-110 group-focus-visible:scale-110";

      const image = document.createElement("img");
      image.src = point.photo;
      image.alt = "";
      image.loading = "lazy";
      image.decoding = "async";
      image.className = "size-full object-cover";

      enveloppe.append(image);
      vignette.append(enveloppe);

      return new maplibregl.Marker({ element: vignette })
        .setLngLat([point.longitude, point.latitude])
        .addTo(carte);
    });

    // Le cadrage suit les annonces : une carte de France centrée à vue de nez
    // couperait Lille ou Marseille selon les jours. Avec une seule annonce, il
    // n'y a pas d'étendue à ajuster — on se pose dessus.
    if (points.length === 1) {
      carte.setCenter([points[0].longitude, points[0].latitude]);
      carte.setZoom(11);
    } else {
      const etendue = points.reduce(
        (limites, point) => limites.extend([point.longitude, point.latitude]),
        new maplibregl.LngLatBounds(
          [points[0].longitude, points[0].latitude],
          [points[0].longitude, points[0].latitude],
        ),
      );
      carte.fitBounds(etendue, { padding: 64, maxZoom: 12, animate: false });
    }

    return () => {
      for (const marqueur of marqueurs) marqueur.remove();
      carte.remove();
    };
  }, [points, styleUrl]);

  return (
    <div
      ref={cadre}
      role="region"
      aria-label={etiquette}
      className="h-[26rem] w-full bg-fond-doux sm:h-[32rem]"
    />
  );
}
