"use client";

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useCallback, useRef, useState } from "react";

const ChampPositionToile = dynamic(() => import("./champ-position-toile"), {
  ssr: false,
  loading: () => <div className="h-72 w-full bg-fond-doux" />,
});

/**
 * Où se trouve précisément le matériel.
 *
 * Jusqu'ici la position était le **centre de la commune**, posée à la création
 * du brouillon et jamais affinée. Trois conséquences, toutes fausses : les
 * annonces d'une même ville se superposaient au même point sur la carte, la
 * recherche « autour de moi » se trompait de plusieurs kilomètres, et le
 * cercle d'imprécision de 800 mètres était une politesse — le bien pouvait
 * être à cinq kilomètres de son centre.
 *
 * Deux gestes, dans cet ordre. **Le géocodage** convertit l'adresse saisie
 * juste au-dessus en coordonnées : le propriétaire n'a rien à faire quand il
 * tombe juste. **L'épingle déplaçable** rattrape le reste — lieux-dits,
 * adresses neuves, fermes à l'écart : précisément là où se trouvent beaucoup
 * de remorques, et précisément là où le géocodage échoue.
 *
 * Ce que le public en verra ne change pas : un cercle, jamais une épingle.
 * Mais le cercle sera enfin centré sur la bonne cour.
 */
export function ChampPosition({
  longitude,
  latitude,
  styleUrl,
}: {
  longitude: number;
  latitude: number;
  styleUrl?: string;
}) {
  const t = useTranslations("espaces.loueur.publication.position");

  const [position, setPosition] = useState({ longitude, latitude });
  const [recherche, setRecherche] = useState<"repos" | "encours" | "echec">("repos");
  const deplacerEpingle = useRef<
    ((position: { longitude: number; latitude: number }) => void) | null
  >(null);

  const inscrireDeplacement = useCallback(
    (deplacer: (position: { longitude: number; latitude: number }) => void) => {
      deplacerEpingle.current = deplacer;
    },
    [],
  );

  const surDeplacement = useCallback(
    (nouvelle: { longitude: number; latitude: number }) => {
      setPosition(nouvelle);
      setRecherche("repos");
    },
    [],
  );

  /**
   * Convertit l'adresse du formulaire en coordonnées.
   *
   * Les champs sont lus dans le formulaire plutôt que passés en propriétés :
   * ils sont juste au-dessus, non contrôlés, et les recopier dans un état
   * dupliquerait la saisie pour rien.
   */
  async function situerParLAdresse(evenement: React.MouseEvent<HTMLButtonElement>) {
    const formulaire = evenement.currentTarget.form;
    if (!formulaire || !styleUrl) return;

    const donnees = new FormData(formulaire);
    const requete = [
      donnees.get("adresseLigne1"),
      donnees.get("codePostal"),
      donnees.get("ville"),
    ]
      .filter(Boolean)
      .join(", ");

    if (requete.length < 6) {
      setRecherche("echec");
      return;
    }

    setRecherche("encours");

    try {
      // La clé du service de cartographie voyage dans l'adresse du style : elle
      // est publique par nature, puisque le navigateur la présente à chaque
      // tuile. On la réutilise plutôt que d'en demander une seconde.
      const cle = new URL(styleUrl).searchParams.get("key");
      const reponse = await fetch(
        `https://api.maptiler.com/geocoding/${encodeURIComponent(requete)}.json?key=${cle}&limit=1`,
      );

      const resultat = await reponse.json();
      const trouve = resultat?.features?.[0]?.center;

      if (!Array.isArray(trouve)) {
        setRecherche("echec");
        return;
      }

      const nouvelle = { longitude: trouve[0], latitude: trouve[1] };
      setPosition(nouvelle);
      deplacerEpingle.current?.(nouvelle);
      setRecherche("repos");
    } catch {
      setRecherche("echec");
    }
  }

  return (
    <div className="sm:col-span-2">
      {/* Ce sont ces deux valeurs que l'action enregistre. Elles suivent
          l'épingle, qu'elle ait été posée par le géocodage ou à la main. */}
      <input type="hidden" name="longitude" value={position.longitude} />
      <input type="hidden" name="latitude" value={position.latitude} />

      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="text-sm font-medium">{t("titre")}</p>
        {styleUrl ? (
          <button
            type="button"
            onClick={(evenement) => void situerParLAdresse(evenement)}
            disabled={recherche === "encours"}
            className="text-sm font-medium text-accent underline underline-offset-4 disabled:opacity-60"
          >
            {recherche === "encours" ? t("recherche") : t("situer")}
          </button>
        ) : null}
      </div>

      <p className="mt-1 text-sm text-texte-attenue">{t("aide")}</p>

      <div className="mt-3 overflow-hidden rounded-carte border border-bordure">
        {styleUrl ? (
          <ChampPositionToile
            longitude={longitude}
            latitude={latitude}
            styleUrl={styleUrl}
            etiquette={t("etiquette")}
            surDeplacement={surDeplacement}
            inscrireDeplacement={inscrireDeplacement}
          />
        ) : (
          <div className="flex h-32 items-center justify-center px-6 text-center">
            <p className="text-[0.9375rem] text-texte-attenue">
              {t("fondAbsent")}
            </p>
          </div>
        )}
      </div>

      <p aria-live="polite" className="mt-2 min-h-5 text-sm text-danger">
        {recherche === "echec" ? t("introuvable") : null}
      </p>
    </div>
  );
}
