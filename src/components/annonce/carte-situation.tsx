"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

// La feuille de style de MapLibre, sans laquelle l'attribution et les
// commandes s'affichent en vrac. Importée statiquement, contrairement à la
// bibliothèque : quelques kilo-octets de CSS ne justifient pas le détour, là
// où les centaines de kilo-octets de JavaScript le justifient.
import "maplibre-gl/dist/maplibre-gl.css";

/**
 * Où se trouve le bien — approximativement.
 *
 * **Un cercle, jamais une épingle.** L'adresse exacte reste masquée jusqu'à la
 * confirmation de la réservation : c'est une exigence du cadrage, et c'est
 * aussi ce que le propriétaire a réglé lui-même à l'étape « Retrait » de la
 * publication, entre 300 mètres et 3 kilomètres. Poser un point sur la
 * position réelle annulerait ce réglage et publierait, pour beaucoup
 * d'annonces, l'adresse d'un domicile.
 *
 * Le centre affiché est d'ailleurs celui de la commune tant que l'adresse
 * n'est pas géocodée : le cercle dit donc « quelque part par là », ce qui est
 * exactement l'information utile avant de réserver.
 *
 * **La bibliothèque est chargée à la demande.** MapLibre pèse quelques
 * centaines de kilo-octets ; sur un site dont plus de 70 % du trafic est
 * mobile, elle n'a rien à faire dans le paquet initial d'une fiche que
 * beaucoup consultent sans jamais regarder la carte. Elle n'est demandée que
 * lorsque le cadre entre dans l'écran.
 *
 * Sans fond de carte configuré, l'encart le dit et donne la commune, plutôt
 * que d'afficher un carré gris. Même discipline que pour Stripe et Resend.
 */
export function CarteSituation({
  longitude,
  latitude,
  rayonM,
  quartier,
  ville,
  styleUrl,
}: {
  longitude: number;
  latitude: number;
  /** Rayon d'imprécision affiché, en mètres. */
  rayonM: number;
  quartier: string;
  ville: string;
  /** Style MapLibre. Absent tant que le fond de carte n'est pas configuré. */
  styleUrl?: string;
}) {
  const t = useTranslations("annonce.situation");
  const cadre = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  // La carte n'est demandée qu'une fois le cadre entré dans l'écran : sur une
  // fiche, elle est loin sous la ligne de flottaison.
  useEffect(() => {
    const element = cadre.current;
    if (!element || visible) return;

    const guetteur = new IntersectionObserver(
      (entrees) => {
        if (entrees.some((entree) => entree.isIntersecting)) setVisible(true);
      },
      { rootMargin: "200px" },
    );

    guetteur.observe(element);
    return () => guetteur.disconnect();
  }, [visible]);

  useEffect(() => {
    if (!visible || !styleUrl || !cadre.current) return;

    let carte: { remove: () => void } | undefined;
    let vivant = true;

    void (async () => {
      const maplibre = await import("maplibre-gl");
      if (!vivant || !cadre.current) return;

      // Le zoom est déduit du rayon : un cercle de 300 mètres et un cercle de
      // 3 kilomètres ne se regardent pas de la même hauteur, et un zoom fixe
      // rendrait l'un minuscule et l'autre débordant.
      const zoom = Math.max(11, 15.5 - Math.log2(rayonM / 300));

      const instance = new maplibre.Map({
        container: cadre.current,
        style: styleUrl,
        center: [longitude, latitude],
        zoom,
        // Ni rotation ni inclinaison : cette carte répond à « c'est où ? »,
        // elle n'invite pas à explorer la région.
        pitchWithRotate: false,
        dragRotate: false,
        attributionControl: { compact: true },
      });

      carte = instance;

      instance.on("load", () => {
        if (!vivant) return;

        instance.addSource("zone", {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {},
            geometry: { type: "Point", coordinates: [longitude, latitude] },
          },
        });

        // Le rayon est exprimé en mètres réels et non en pixels : le cercle
        // doit grandir avec le zoom, sinon il ne veut plus rien dire dès qu'on
        // s'approche. `circle-pitch-alignment: map` l'ancre au sol.
        instance.addLayer({
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
            // Interpolation exponentielle de base 2 : c'est exactement le
            // rythme auquel un niveau de zoom double l'échelle. Le cercle
            // couvre donc la même distance réelle quel que soit le zoom.
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
    })();

    return () => {
      vivant = false;
      carte?.remove();
    };
  }, [visible, styleUrl, longitude, latitude, rayonM]);

  return (
    <div>
      <div className="overflow-hidden rounded-carte border border-bordure">
        {styleUrl ? (
          <div
            ref={cadre}
            role="img"
            aria-label={t("alternative", { quartier, ville })}
            className="h-64 w-full bg-fond-doux sm:h-80"
          />
        ) : (
          <div
            ref={cadre}
            className="flex h-40 w-full items-center justify-center bg-fond-doux px-6 text-center"
          >
            <p className="text-[0.9375rem] text-texte-attenue">
              {t("fondAbsent", { quartier, ville })}
            </p>
          </div>
        )}
      </div>

      <p className="mt-3 text-sm text-texte-attenue">
        {t("imprecision", { rayon: Math.round(rayonM / 100) / 10 })}
      </p>
    </div>
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
