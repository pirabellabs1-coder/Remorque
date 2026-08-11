"use client";

import { useEffect, useRef } from "react";
// MapLibre 6 n'expose pas d'export par défaut : on prend l'espace de noms.
import * as maplibregl from "maplibre-gl";

// La feuille de style de MapLibre, sans laquelle l'attribution et les
// commandes s'affichent en vrac. Elle voyage avec ce module, donc elle n'est
// chargée que lorsque la carte l'est.
import "maplibre-gl/dist/maplibre-gl.css";

/**
 * La toile MapLibre elle-même.
 *
 * Séparée de son enveloppe pour une raison de mécanique, pas d'esthétique :
 * la bibliothèque est importée **statiquement** ici, et c'est `next/dynamic`
 * qui charge ce module à la demande. La première version faisait un
 * `await import("maplibre-gl")` à la main ; le fragment correspondant n'était
 * pas servi en production — le navigateur recevait la page d'erreur HTML à sa
 * place, et la carte restait un aplat vide. Passer par le mécanisme de
 * chargement différé de Next, qui émet et sert ses fragments lui-même, ôte le
 * problème plutôt que de le contourner.
 */
export default function CarteSituationToile({
  longitude,
  latitude,
  rayonM,
  styleUrl,
  etiquette,
}: {
  longitude: number;
  latitude: number;
  rayonM: number;
  styleUrl: string;
  etiquette: string;
}) {
  const cadre = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!cadre.current) return;

    // Le zoom est déduit du rayon : un cercle de 300 mètres et un cercle de
    // 3 kilomètres ne se regardent pas de la même hauteur, et un zoom fixe
    // rendrait l'un minuscule et l'autre débordant.
    const zoom = Math.max(11, 15.5 - Math.log2(rayonM / 300));

    const carte = new maplibregl.Map({
      container: cadre.current,
      style: styleUrl,
      center: [longitude, latitude],
      zoom,
      // Ni rotation ni inclinaison : cette carte répond à « c'est où ? », elle
      // n'invite pas à explorer la région.
      pitchWithRotate: false,
      dragRotate: false,
      attributionControl: { compact: true },
    });

    carte.on("load", () => {
      carte.addSource("zone", {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: { type: "Point", coordinates: [longitude, latitude] },
        },
      });

      // Le rayon est exprimé en mètres réels et non en pixels : le cercle doit
      // grandir avec le zoom, sinon il cesse de vouloir dire quelque chose dès
      // qu'on s'approche. L'interpolation exponentielle de base 2 suit
      // exactement le rythme auquel un niveau de zoom double l'échelle.
      carte.addLayer({
        id: "zone-fond",
        type: "circle",
        source: "zone",
        paint: {
          "circle-color": "#2563eb",
          "circle-opacity": 0.15,
          "circle-stroke-color": "#2563eb",
          "circle-stroke-opacity": 0.5,
          "circle-stroke-width": 2,
          "circle-pitch-alignment": "map",
          "circle-radius": [
            "interpolate",
            ["exponential", 2],
            ["zoom"],
            0,
            0,
            20,
            metresEnPixels(rayonM, latitude, 20),
          ],
        },
      });
    });

    return () => carte.remove();
  }, [longitude, latitude, rayonM, styleUrl]);

  return (
    <div
      ref={cadre}
      role="img"
      aria-label={etiquette}
      className="h-64 w-full bg-fond-doux sm:h-80"
    />
  );
}

/**
 * Convertit un rayon en mètres vers un rayon en pixels, à un zoom donné.
 *
 * La projection de Mercator étire les distances vers les pôles : un kilomètre
 * couvre plus de pixels à Oslo qu'à Séville. Sans cette correction par la
 * latitude, le cercle d'imprécision d'une annonce du nord de l'Europe serait
 * nettement plus petit que la zone qu'il prétend couvrir — soit exactement le
 * contraire de ce qu'on promet au propriétaire.
 */
function metresEnPixels(metres: number, latitude: number, zoom: number): number {
  const metresParPixel =
    (156_543.03392 * Math.cos((latitude * Math.PI) / 180)) / 2 ** zoom;
  return metres / metresParPixel;
}
