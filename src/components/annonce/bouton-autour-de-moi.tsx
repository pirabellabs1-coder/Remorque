"use client";

import { useTranslations } from "next-intl";

import { cn } from "@/lib/cn";
import { useState } from "react";

import { useRouter } from "@/i18n/navigation";

/**
 * Recherche autour de la position réelle du visiteur.
 *
 * La géolocalisation du navigateur demande une autorisation explicite, et
 * c'est très bien ainsi : personne ne doit apprendre où se trouve quelqu'un
 * sans qu'il l'ait voulu. Le bouton porte donc son intention en clair plutôt
 * que de déclencher la demande au chargement, ce qui ferait refuser par
 * réflexe.
 *
 * En cas de refus ou d'échec, la recherche reste utilisable par nom de ville :
 * la position est un raccourci, jamais une condition.
 */
export function BoutonAutourDeMoi({
  rayonKm,
  surFondSombre = false,
}: {
  rayonKm: number;
  /** Posé sur une photographie : bordure et texte s'inversent. */
  surFondSombre?: boolean;
}) {
  const t = useTranslations("recherche");
  const router = useRouter();
  const [etat, setEtat] = useState<"repos" | "attente" | "refus" | "indisponible">(
    "repos",
  );

  function localiser() {
    if (!("geolocation" in navigator)) {
      setEtat("indisponible");
      return;
    }

    setEtat("attente");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setEtat("repos");
        // Cinq décimales suffisent — environ un mètre. En transmettre douze
        // révélerait la position au centimètre près dans un historique de
        // navigation, sans rien apporter à la recherche.
        const longitude = position.coords.longitude.toFixed(5);
        const latitude = position.coords.latitude.toFixed(5);

        router.push({
          pathname: "/recherche",
          query: { lon: longitude, lat: latitude, rayon: String(rayonKm) },
        });
      },
      () => setEtat("refus"),
      // Une position approchée suffit pour un rayon de plusieurs kilomètres :
      // exiger la haute précision allumerait le GPS pour rien et viderait la
      // batterie sur le terrain.
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={localiser}
        disabled={etat === "attente"}
        className={cn(
          "inline-flex items-center gap-2 rounded-champ border px-4 py-2.5 text-sm font-medium transition-colors hover:border-accent disabled:opacity-60",
          surFondSombre
            ? "border-encre-bordure bg-white/10 text-encre-texte backdrop-blur-sm"
            : "border-bordure hover:text-accent",
        )}
      >
        <svg
          viewBox="0 0 24 24"
          className="size-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          aria-hidden
        >
          <circle cx="12" cy="10" r="3" />
          <path d="M12 21s-7-6-7-11a7 7 0 1 1 14 0c0 5-7 11-7 11Z" />
        </svg>
        {etat === "attente" ? t("localisation") : t("autourDeMoi")}
      </button>

      {etat === "refus" || etat === "indisponible" ? (
        <p
          role="status"
          className={cn(
            "mt-2 text-sm",
            surFondSombre ? "text-encre-texte-attenue" : "text-texte-attenue",
          )}
        >
          {etat === "refus" ? t("positionRefusee") : t("positionIndisponible")}
        </p>
      ) : null}
    </div>
  );
}
