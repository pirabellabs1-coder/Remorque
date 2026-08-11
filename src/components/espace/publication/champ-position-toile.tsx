"use client";

import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";

import "maplibre-gl/dist/maplibre-gl.css";

/**
 * La carte de placement — épingle déplaçable.
 *
 * Séparée pour être chargée par `next/dynamic` : voir `champ-position.tsx`.
 */
export default function ChampPositionToile({
  longitude,
  latitude,
  styleUrl,
  etiquette,
  surDeplacement,
  inscrireDeplacement,
}: {
  longitude: number;
  latitude: number;
  styleUrl: string;
  etiquette: string;
  /** Appelé à chaque fois que l'épingle change de place. */
  surDeplacement: (position: { longitude: number; latitude: number }) => void;
  /** Reçoit une fonction permettant de déplacer l'épingle depuis l'extérieur. */
  inscrireDeplacement: (
    deplacer: (position: { longitude: number; latitude: number }) => void,
  ) => void;
}) {
  const cadre = useRef<HTMLDivElement>(null);

  // Les fonctions de rappel changent à chaque rendu du parent ; les mettre en
  // dépendance de l'effet reconstruirait la carte à chaque frappe dans le
  // formulaire. On les garde dans une référence, que l'effet lit sans en
  // dépendre.
  const rappels = useRef({ surDeplacement, inscrireDeplacement });
  rappels.current = { surDeplacement, inscrireDeplacement };

  useEffect(() => {
    if (!cadre.current) return;

    maplibregl.setWorkerUrl("/cartographie/maplibre-gl-worker.mjs");

    const carte = new maplibregl.Map({
      container: cadre.current,
      style: styleUrl,
      center: [longitude, latitude],
      zoom: 15,
      pitchWithRotate: false,
      dragRotate: false,
      attributionControl: { compact: true },
    });

    carte.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      "top-right",
    );

    const epingle = new maplibregl.Marker({ draggable: true, color: "#2563eb" })
      .setLngLat([longitude, latitude])
      .addTo(carte);

    epingle.on("dragend", () => {
      const { lng, lat } = epingle.getLngLat();
      rappels.current.surDeplacement({ longitude: lng, latitude: lat });
    });

    // Le parent doit pouvoir replacer l'épingle après un géocodage.
    rappels.current.inscrireDeplacement((position) => {
      epingle.setLngLat([position.longitude, position.latitude]);
      carte.flyTo({
        center: [position.longitude, position.latitude],
        zoom: 16,
        duration: 800,
      });
    });

    return () => {
      epingle.remove();
      carte.remove();
    };
    // Volontairement monté une seule fois : la position initiale ne sert qu'au
    // cadrage de départ, et les mouvements ultérieurs passent par l'épingle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [styleUrl]);

  return (
    <div
      ref={cadre}
      role="application"
      aria-label={etiquette}
      className="h-72 w-full bg-fond-doux"
    />
  );
}
