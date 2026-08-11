"use client";

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

/**
 * MapLibre pèse quelques centaines de kilo-octets. Sur un site dont plus de
 * 70 % du trafic est mobile, elle n'a rien à faire dans le paquet initial
 * d'une fiche que beaucoup consultent sans jamais regarder la carte : ce
 * module n'est demandé qu'au moment où l'on décide de l'afficher.
 *
 * `ssr: false` parce qu'une carte n'existe pas côté serveur — et parce que le
 * rendu serveur de l'espace public doit rester intact : c'est lui qui porte le
 * référencement local, soit l'essentiel du trafic visé.
 */
const CarteSituationToile = dynamic(() => import("./carte-situation-toile"), {
  ssr: false,
  loading: () => <div className="h-64 w-full bg-fond-doux sm:h-80" />,
});

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
 * Sans fond de carte configuré, l'encart nomme la commune et le dit, plutôt
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
  const [proche, setProche] = useState(false);

  // La carte n'est montée qu'une fois le cadre près d'entrer dans l'écran :
  // sur une fiche, elle est loin sous la ligne de flottaison.
  useEffect(() => {
    const element = cadre.current;
    if (!element || proche) return;

    const guetteur = new IntersectionObserver(
      (entrees) => {
        if (entrees.some((entree) => entree.isIntersecting)) setProche(true);
      },
      { rootMargin: "200px" },
    );

    guetteur.observe(element);
    return () => guetteur.disconnect();
  }, [proche]);

  return (
    <div>
      <div ref={cadre} className="overflow-hidden rounded-carte border border-bordure">
        {!styleUrl ? (
          <div className="flex h-40 w-full items-center justify-center bg-fond-doux px-6 text-center">
            <p className="text-[0.9375rem] text-texte-attenue">
              {t("fondAbsent", { quartier, ville })}
            </p>
          </div>
        ) : proche ? (
          <CarteSituationToile
            longitude={longitude}
            latitude={latitude}
            rayonM={rayonM}
            styleUrl={styleUrl}
            etiquette={t("alternative", { quartier, ville })}
          />
        ) : (
          <div className="h-64 w-full bg-fond-doux sm:h-80" />
        )}
      </div>

      <p className="mt-3 text-sm text-texte-attenue">
        {t("imprecision", { rayon: Math.round(rayonM / 100) / 10 })}
      </p>
    </div>
  );
}
