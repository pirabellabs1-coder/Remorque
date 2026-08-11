"use client";

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import type { PointAnnonce } from "./carte-annonces-toile";

/**
 * MapLibre pèse quelques centaines de kilo-octets, et cette carte est en bas
 * de page : elle n'est demandée qu'au moment où l'on s'en approche. `ssr:
 * false` parce qu'une carte n'existe pas côté serveur — et parce que le rendu
 * serveur de l'accueil doit rester intact, c'est lui qui porte le
 * référencement.
 */
const CarteAnnoncesToile = dynamic(() => import("./carte-annonces-toile"), {
  ssr: false,
  loading: () => <div className="h-[26rem] w-full bg-fond-doux sm:h-[32rem]" />,
});

/**
 * Carte des annonces disponibles.
 *
 * Elle montre d'un coup d'œil ce que le catalogue couvre — et ce qu'il ne
 * couvre pas encore, ce qui est tout aussi utile à savoir. Chaque annonce y
 * est une pastille de prix cliquable qui mène à sa fiche.
 *
 * Les positions affichées sont celles des communes, pas des adresses : c'est
 * la même règle que sur la fiche, l'adresse exacte n'étant communiquée
 * qu'après confirmation de la réservation. Sur une carte d'ensemble, à cette
 * échelle, la distinction ne se voit même pas — mais elle reste vraie.
 *
 * Sans fond de carte configuré, rien ne s'affiche : une carte est ici un
 * agrément, pas une information. Mieux vaut une section absente qu'un cadre
 * vide qui donne l'impression d'un site cassé.
 */
export function CarteAnnonces({
  points,
  styleUrl,
}: {
  points: PointAnnonce[];
  styleUrl?: string;
}) {
  const t = useTranslations("accueil.carte");
  const cadre = useRef<HTMLDivElement>(null);
  const [proche, setProche] = useState(false);

  useEffect(() => {
    const element = cadre.current;
    if (!element || proche) return;

    const guetteur = new IntersectionObserver(
      (entrees) => {
        if (entrees.some((entree) => entree.isIntersecting)) setProche(true);
      },
      { rootMargin: "300px" },
    );

    guetteur.observe(element);
    return () => guetteur.disconnect();
  }, [proche]);

  if (!styleUrl || points.length === 0) return null;

  return (
    <div>
      <div
        ref={cadre}
        className="overflow-hidden rounded-carte border border-bordure"
      >
        {proche ? (
          <CarteAnnoncesToile
            points={points}
            styleUrl={styleUrl}
            etiquette={t("etiquette", { nombre: points.length })}
          />
        ) : (
          <div className="h-[26rem] w-full bg-fond-doux sm:h-[32rem]" />
        )}
      </div>

      <p className="mt-3 text-sm text-texte-attenue">{t("mention")}</p>
    </div>
  );
}
