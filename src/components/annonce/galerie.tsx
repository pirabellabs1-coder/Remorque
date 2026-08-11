"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { Illustration } from "@/components/ui/illustration";
import { cn } from "@/lib/cn";

/**
 * Galerie photographique d'une annonce.
 *
 * La fiche n'affichait que la couverture : un propriétaire pouvait déposer
 * douze clichés et n'en voir jamais qu'un seul publié. Or sur une place de
 * marché de matériel, les photos *sont* la description — l'état d'un plancher,
 * la corrosion d'un timon, la présence d'une roue de secours ne se disent pas
 * en une ligne de texte.
 *
 * **Défilement natif plutôt que transformations calculées.** Le rail est un
 * conteneur qui défile, avec ancrage par élément : le geste tactile est celui
 * du système, l'inertie est la bonne, le clavier fonctionne, et rien ne se
 * désynchronise. Une piste animée à la main aurait demandé trois fois ce code
 * pour un résultat moins juste sur téléphone — et c'est là que se fait
 * l'essentiel des consultations.
 *
 * La première image est prioritaire au chargement : elle est la plus grande
 * chose visible de l'écran d'arrivée, et c'est elle que mesurent les
 * indicateurs de performance.
 */
export function Galerie({
  photos,
  alt,
  titre,
}: {
  photos: string[];
  alt: string;
  titre: string;
}) {
  const t = useTranslations("annonce.galerie");
  const rail = useRef<HTMLUListElement>(null);
  const [courante, setCourante] = useState(0);
  const [pause, setPause] = useState(false);

  // Position lue au défilement plutôt que pilotée : le rail est la source de
  // vérité, qu'on l'ait fait bouger au doigt, à la molette ou par un bouton.
  useEffect(() => {
    const element = rail.current;
    if (!element) return;

    function surDefilement() {
      if (!element) return;
      const largeur = element.clientWidth;
      if (largeur === 0) return;
      setCourante(Math.round(element.scrollLeft / largeur));
    }

    element.addEventListener("scroll", surDefilement, { passive: true });
    return () => element.removeEventListener("scroll", surDefilement);
  }, []);

  // Défilement automatique, suspendu dès qu'on touche la galerie et à
  // l'arrêt hors de l'écran. Trois précautions, et elles ne sont pas de
  // confort : un carrousel qui avance pendant qu'on regarde une photo la
  // dérobe, et un carrousel qui tourne dans une page qu'on ne voit pas
  // consomme de la batterie pour rien.
  useEffect(() => {
    const element = rail.current;
    if (!element || photos.length <= 1 || pause) return;

    // Le mouvement automatique est écarté pour qui a demandé à en être
    // dispensé : c'est une préférence système, pas un détail d'accessibilité.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const minuteur = setInterval(() => {
      if (document.hidden) return;

      const largeur = element.clientWidth;
      if (largeur === 0) return;

      const suivante = Math.round(element.scrollLeft / largeur) + 1;
      element.scrollTo({
        left: suivante >= photos.length ? 0 : suivante * largeur,
        behavior: "smooth",
      });
    }, 4500);

    return () => clearInterval(minuteur);
  }, [photos.length, pause]);

  function aller(rang: number) {
    const element = rail.current;
    if (!element) return;

    const cible = Math.max(0, Math.min(rang, photos.length - 1));
    element.scrollTo({ left: cible * element.clientWidth, behavior: "smooth" });
  }

  // Une seule photo : pas de rail, pas de commandes, pas de pastilles. Un
  // carrousel d'une image est un carrousel qui ment.
  if (photos.length <= 1) {
    return (
      <Illustration
        src={photos[0]}
        alt={alt}
        priorite
        className="aspect-16/9 w-full rounded-carte border border-bordure"
        tailles="(min-width: 1024px) 66vw, 100vw"
      />
    );
  }

  const commande =
    "grid size-10 place-items-center rounded-full border border-white/30 bg-black/45 text-white backdrop-blur-sm transition-colors hover:bg-black/65 disabled:opacity-0";

  return (
    <div
      className="group relative"
      onPointerEnter={() => setPause(true)}
      onPointerLeave={() => setPause(false)}
      onFocusCapture={() => setPause(true)}
      onBlurCapture={() => setPause(false)}
      onTouchStart={() => setPause(true)}
    >
      <ul
        ref={rail}
        className="flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain rounded-carte border border-bordure [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {photos.map((photo, rang) => (
          <li key={photo} className="w-full shrink-0 snap-start">
            <Illustration
              src={photo}
              alt={rang === 0 ? alt : t("vue", { titre, rang: rang + 1 })}
              priorite={rang === 0}
              className="aspect-16/9 w-full"
              tailles="(min-width: 1024px) 66vw, 100vw"
            />
          </li>
        ))}
      </ul>

      {/* Commandes visibles au survol sur ordinateur, toujours présentes au
          doigt — où l'on fait glisser plutôt que cliquer. */}
      <div className="pointer-events-none absolute inset-y-0 left-0 right-0 flex items-center justify-between px-3">
        <button
          type="button"
          onClick={() => aller(courante - 1)}
          disabled={courante === 0}
          aria-label={t("precedente")}
          className={cn(commande, "pointer-events-auto")}
        >
          <span aria-hidden>‹</span>
        </button>
        <button
          type="button"
          onClick={() => aller(courante + 1)}
          disabled={courante === photos.length - 1}
          aria-label={t("suivante")}
          className={cn(commande, "pointer-events-auto")}
        >
          <span aria-hidden>›</span>
        </button>
      </div>

      <p className="absolute right-3 bottom-3 rounded-full bg-black/55 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm">
        {t("rang", { rang: courante + 1, total: photos.length })}
      </p>

      {/* Vignettes : elles disent combien il reste à voir, ce qu'une rangée de
          points ne dit pas — et donnent envie d'y aller. */}
      <ul className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {photos.map((photo, rang) => (
          <li key={photo}>
            <button
              type="button"
              onClick={() => aller(rang)}
              aria-label={t("vue", { titre, rang: rang + 1 })}
              aria-current={rang === courante ? "true" : undefined}
              className={cn(
                "block overflow-hidden rounded-[0.5rem] border-2 transition-colors",
                rang === courante ? "border-accent" : "border-transparent hover:border-bordure",
              )}
            >
              <Illustration
                src={photo}
                alt=""
                className="h-14 w-20 sm:h-16 sm:w-24"
                tailles="96px"
              />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
