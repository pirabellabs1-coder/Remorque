"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/cn";

/**
 * Pavé de signature manuscrite.
 *
 * Remplace une case à cocher « je signe ». La case était commode et ne valait
 * rien : elle prouve qu'un bouton a été cliqué sur un appareil, pas qu'une
 * personne a signé. Un tracé manuscrit ne vaut pas davantage juridiquement
 * qu'une case dans l'absolu — mais il est ce que les deux parties reconnaissent
 * comme un engagement, et il se montre à un assureur.
 *
 * **Événements de pointeur, pas de souris ni de tactile.** Un seul jeu
 * d'événements couvre le doigt, le stylet et la souris. Écrire les trois
 * séparément revient à en oublier un, et celui qu'on oublie est toujours le
 * stylet — c'est-à-dire l'appareil de celui qui signe le plus proprement.
 *
 * **Le trait suit la densité de l'écran.** Sans `devicePixelRatio`, la
 * signature est floue sur tout téléphone récent, et une signature floue a l'air
 * d'une signature falsifiée.
 *
 * Le tracé sort en PNG à fond transparent, prêt à être posé sur un document.
 */
export function PaveSignature({
  nom,
  libelle,
  surSignature,
}: {
  /** Nom du champ caché qui portera l'image. */
  nom: string;
  libelle: string;
  surSignature?: (signe: boolean) => void;
}) {
  const t = useTranslations("espaces.loueur.etatsDesLieux.signature");
  const toile = useRef<HTMLCanvasElement>(null);
  const champ = useRef<HTMLInputElement>(null);
  const trace = useRef(false);
  const [signe, setSigne] = useState(false);

  // La toile est dimensionnée après le montage, quand sa largeur réelle est
  // connue : un `width` posé en attribut vaut 300 pixels par défaut et étire
  // le tracé.
  useEffect(() => {
    const element = toile.current;
    if (!element) return;

    function redimensionner() {
      if (!element) return;
      const densite = window.devicePixelRatio || 1;
      const largeur = element.clientWidth;
      const hauteur = element.clientHeight;

      element.width = largeur * densite;
      element.height = hauteur * densite;

      const contexte = element.getContext("2d");
      if (!contexte) return;
      contexte.scale(densite, densite);
      contexte.lineWidth = 2;
      contexte.lineCap = "round";
      contexte.lineJoin = "round";
      contexte.strokeStyle = "#0f172a";
    }

    redimensionner();

    // Une rotation d'écran change la largeur : sans cela, le tracé déjà posé
    // se retrouve décalé, et l'on ne peut plus le corriger qu'en effaçant.
    const observateur = new ResizeObserver(() => {
      if (!trace.current) redimensionner();
    });
    observateur.observe(element);
    return () => observateur.disconnect();
  }, []);

  function positionDe(evenement: React.PointerEvent<HTMLCanvasElement>) {
    const cadre = evenement.currentTarget.getBoundingClientRect();
    return {
      x: evenement.clientX - cadre.left,
      y: evenement.clientY - cadre.top,
    };
  }

  function commencer(evenement: React.PointerEvent<HTMLCanvasElement>) {
    const contexte = toile.current?.getContext("2d");
    if (!contexte) return;

    // La capture garde le tracé même si le doigt sort du cadre : sans elle,
    // une signature qui déborde s'interrompt au bord.
    evenement.currentTarget.setPointerCapture(evenement.pointerId);

    const { x, y } = positionDe(evenement);
    contexte.beginPath();
    contexte.moveTo(x, y);
    trace.current = true;
  }

  function continuer(evenement: React.PointerEvent<HTMLCanvasElement>) {
    if (!trace.current) return;
    const contexte = toile.current?.getContext("2d");
    if (!contexte) return;

    const { x, y } = positionDe(evenement);
    contexte.lineTo(x, y);
    contexte.stroke();
  }

  function terminer() {
    if (!trace.current) return;
    trace.current = false;

    const element = toile.current;
    if (!element || !champ.current) return;

    champ.current.value = element.toDataURL("image/png");
    setSigne(true);
    surSignature?.(true);
  }

  function effacer() {
    const element = toile.current;
    const contexte = element?.getContext("2d");
    if (!element || !contexte) return;

    contexte.clearRect(0, 0, element.width, element.height);
    if (champ.current) champ.current.value = "";
    setSigne(false);
    surSignature?.(false);
  }

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-medium">{libelle}</p>
        {signe ? (
          <button
            type="button"
            onClick={effacer}
            className="text-sm text-texte-attenue underline underline-offset-4 hover:text-texte"
          >
            {t("effacer")}
          </button>
        ) : null}
      </div>

      <div
        className={cn(
          "relative mt-2 rounded-carte border-2 border-dashed transition-colors",
          signe ? "border-succes/40 bg-succes/5" : "border-bordure bg-fond-doux",
        )}
      >
        <canvas
          ref={toile}
          onPointerDown={commencer}
          onPointerMove={continuer}
          onPointerUp={terminer}
          onPointerCancel={terminer}
          // `touch-none` empêche la page de défiler pendant qu'on signe : sans
          // lui, le premier geste fait glisser l'écran au lieu de tracer.
          className="h-32 w-full touch-none"
        />

        {!signe ? (
          <p className="pointer-events-none absolute inset-0 grid place-items-center text-sm text-texte-attenue">
            {t("invite")}
          </p>
        ) : null}
      </div>

      <input ref={champ} type="hidden" name={nom} />
    </div>
  );
}
