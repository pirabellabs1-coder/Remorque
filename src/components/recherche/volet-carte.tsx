"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { CarteAnnonces } from "@/components/carte/carte-annonces";
import type { PointAnnonce } from "@/components/carte/carte-annonces-toile";
import { cn } from "@/lib/cn";

/**
 * Volet cartographique de la recherche.
 *
 * La carte montre exactement ce que montre la liste : mêmes annonces, mêmes
 * filtres, même tri. Elles ne se synchronisent pas — elles n'ont rien à
 * synchroniser, puisqu'elles descendent du même rendu serveur. C'est ce qui
 * évite la classe de défauts la plus pénible de ce genre d'écran : une carte
 * qui montre autre chose que la liste d'à côté.
 *
 * Chercher depuis la carte devient alors possible sans mécanique
 * supplémentaire : on change un filtre, la page se rend, les deux volets
 * suivent. Et chaque vignette est un lien vers sa fiche.
 *
 * Sur mobile, les deux ne tiennent pas côte à côte : une bascule les échange.
 * La liste reste le premier écran — on cherche une remorque, pas une carte —
 * mais la carte est à un geste.
 */
export function VoletCarte({
  points,
  styleUrl,
  children,
}: {
  points: PointAnnonce[];
  styleUrl?: string;
  /** La liste des résultats, rendue par le serveur. */
  children: React.ReactNode;
}) {
  const t = useTranslations("recherche.carte");
  const [vue, setVue] = useState<"liste" | "carte">("liste");

  // Sans fond de carte configuré, la recherche reste une liste : mieux vaut
  // pas de volet du tout qu'un cadre vide et une bascule qui ne mène nulle
  // part.
  if (!styleUrl || points.length === 0) return <>{children}</>;

  const onglet = (actif: boolean) =>
    cn(
      "h-10 flex-1 rounded-champ text-sm font-medium transition-colors",
      actif ? "bg-accent text-accent-contraste" : "text-texte-attenue",
    );

  return (
    <div>
      {/* Bascule mobile. Deux boutons plutôt qu'un seul qui alterne : on voit
          où l'on est autant que où l'on peut aller. */}
      <div className="mb-4 flex gap-1 rounded-champ border border-bordure bg-fond-eleve p-1 xl:hidden">
        <button
          type="button"
          onClick={() => setVue("liste")}
          aria-pressed={vue === "liste"}
          className={onglet(vue === "liste")}
        >
          {t("liste")}
        </button>
        <button
          type="button"
          onClick={() => setVue("carte")}
          aria-pressed={vue === "carte"}
          className={onglet(vue === "carte")}
        >
          {t("carte")}
        </button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_26rem] xl:items-start">
        <div className={cn(vue === "carte" && "hidden xl:block")}>{children}</div>

        <div
          className={cn(
            vue === "liste" && "hidden xl:block",
            "xl:sticky xl:top-40",
          )}
        >
          <CarteAnnonces points={points} styleUrl={styleUrl} />
        </div>
      </div>
    </div>
  );
}
