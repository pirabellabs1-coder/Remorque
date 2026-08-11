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

    const marqueurs = points.map((point) => {
      const pastille = document.createElement("a");
      pastille.href = point.href;
      pastille.textContent = point.prix;
      pastille.title = `${point.titre} — ${point.ville}`;
      pastille.setAttribute("aria-label", `${point.titre}, ${point.ville}, ${point.prix}`);
      pastille.className =
        "block cursor-pointer rounded-full border border-bordure bg-fond-eleve px-2.5 py-1 text-xs font-semibold text-texte shadow-md transition-colors hover:border-accent hover:bg-accent hover:text-accent-contraste";

      return new maplibregl.Marker({ element: pastille })
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
