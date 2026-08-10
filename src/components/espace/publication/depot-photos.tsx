"use client";

import { useTranslations } from "next-intl";
import { useId, useRef, useState } from "react";

import { Bouton } from "@/components/ui/bouton";
import { PHOTOS_MAXIMUM } from "@/domain/annonce/publication";
import { deposerPhoto } from "@/server/annonces/publication-actions";

/**
 * Dépôt des photos d'une annonce.
 *
 * C'est le seul écran de l'assistant qui exige le navigateur, et pour deux
 * raisons.
 *
 * **Les photos sont réduites avant de partir.** Une photo de téléphone pèse
 * aujourd'hui entre trois et huit méga-octets pour une image qui ne sera
 * jamais affichée à plus de 1 600 pixels de large. L'envoyer telle quelle,
 * c'est trois minutes d'attente sur un réseau de campagne et un stockage qui
 * gonfle pour rien. Redimensionnement au plus grand côté, réencodage en WebP :
 * six méga-octets deviennent environ trois cents kilo-octets, sans différence
 * visible à l'écran.
 *
 * **Elles partent une par une.** La première version envoyait la sélection
 * entière dans une seule requête, ce qui échouait précisément quand on en
 * ajoutait plusieurs : la réduction peut ne pas aboutir sur un appareil
 * ancien, et huit originaux dépassent alors la taille de corps autorisée — la
 * sélection était refusée d'un bloc, sans explication. Une par une, le plafond
 * cesse d'être un sujet, une mauvaise photo ne fait plus perdre les bonnes, et
 * on les voit arriver au lieu d'attendre devant un écran figé.
 *
 * Si le navigateur ne sait pas réduire — appareil ancien, format exotique — le
 * fichier d'origine part tel quel. Mieux vaut un envoi lent qu'une photo
 * perdue.
 */

/** Plus grand côté conservé. Au-delà, l'œil ne gagne rien sur une fiche. */
const COTE_MAXIMUM = 1600;

/** Qualité de réencodage : le grain d'une jante reste lisible à 0,82. */
const QUALITE = 0.82;

type Reduite = { fichier: File; largeur: number; hauteur: number };

async function reduire(fichier: File): Promise<Reduite> {
  const original = { fichier, largeur: 0, hauteur: 0 };

  if (typeof createImageBitmap !== "function") return original;

  try {
    const image = await createImageBitmap(fichier);
    const facteur = Math.min(
      1,
      COTE_MAXIMUM / Math.max(image.width, image.height),
    );
    const largeur = Math.round(image.width * facteur);
    const hauteur = Math.round(image.height * facteur);

    const toile = document.createElement("canvas");
    toile.width = largeur;
    toile.height = hauteur;

    const contexte = toile.getContext("2d");
    if (!contexte) return original;

    contexte.drawImage(image, 0, 0, largeur, hauteur);
    image.close();

    const blob = await new Promise<Blob | null>((resoudre) =>
      toile.toBlob(resoudre, "image/webp", QUALITE),
    );

    if (!blob) return original;

    return {
      fichier: new File([blob], `${crypto.randomUUID()}.webp`, {
        type: "image/webp",
      }),
      largeur,
      hauteur,
    };
  } catch {
    // Format que le navigateur ne sait pas décoder : on laisse passer
    // l'original, le serveur tranchera.
    return original;
  }
}

type Avancement =
  | { phase: "repos" }
  | { phase: "envoi"; faites: number; total: number }
  | { phase: "fini"; deposees: number; refus: string[] };

export function DepotPhotos({
  annonceId,
  locale,
  restantes,
}: {
  annonceId: string;
  locale: string;
  /** Nombre de photos encore acceptées. */
  restantes: number;
}) {
  const t = useTranslations("espaces.loueur.publication.photos");
  const identifiant = useId();
  const champ = useRef<HTMLInputElement>(null);
  const [avancement, setAvancement] = useState<Avancement>({ phase: "repos" });

  async function choisir(selection: FileList | null) {
    if (!selection || selection.length === 0) return;

    // La borne est reprise côté serveur : celle-ci évite seulement de faire
    // travailler l'appareil sur des photos qui seraient refusées.
    const fichiers = Array.from(selection).slice(0, restantes);
    if (champ.current) champ.current.value = "";

    setAvancement({ phase: "envoi", faites: 0, total: fichiers.length });

    const refus = new Set<string>();
    let deposees = 0;

    for (const [rang, fichier] of fichiers.entries()) {
      const reduite = await reduire(fichier);

      const donnees = new FormData();
      donnees.set("annonce", annonceId);
      donnees.set("locale", locale);
      donnees.set("photo", reduite.fichier);
      donnees.set("dimensions", `${reduite.largeur}x${reduite.hauteur}`);

      const bilan = await deposerPhoto(donnees);

      if (bilan.deposee) deposees += 1;
      for (const motif of bilan.refus) refus.add(motif);

      setAvancement({
        phase: "envoi",
        faites: rang + 1,
        total: fichiers.length,
      });
    }

    setAvancement({ phase: "fini", deposees, refus: [...refus] });
  }

  const occupe = avancement.phase === "envoi";
  const complet = restantes <= 0;

  return (
    <div className="rounded-carte border border-dashed border-bordure bg-fond-eleve p-6 text-center">
      <input
        ref={champ}
        id={identifiant}
        type="file"
        // `image/*` fait proposer l'appareil photo sur un téléphone, ce qui est
        // exactement le geste attendu : on photographie la remorque devant soi.
        accept="image/*"
        multiple
        disabled={occupe || complet}
        onChange={(evenement) => void choisir(evenement.target.files)}
        className="sr-only"
      />

      <p className="font-medium">{t("deposer")}</p>
      <p className="mx-auto mt-2 max-w-md text-[0.9375rem] text-texte-attenue">
        {t("consigne", { maximum: PHOTOS_MAXIMUM })}
      </p>

      <div className="mt-5 flex justify-center">
        <Bouton
          type="button"
          disabled={occupe || complet}
          onClick={() => champ.current?.click()}
        >
          {occupe ? t("envoi") : t("choisir")}
        </Bouton>
      </div>

      <p aria-live="polite" className="mt-4 text-sm">
        {complet ? (
          <span className="text-texte-attenue">
            {t("complet", { maximum: PHOTOS_MAXIMUM })}
          </span>
        ) : null}

        {avancement.phase === "envoi" ? (
          <span className="text-texte-attenue">
            {t("progression", {
              faites: avancement.faites,
              total: avancement.total,
            })}
          </span>
        ) : null}

        {avancement.phase === "fini" && avancement.deposees > 0 ? (
          <span className="text-succes">
            {t("deposees", { nombre: avancement.deposees })}
          </span>
        ) : null}

        {avancement.phase === "fini" && avancement.refus.length > 0 ? (
          <span className="mt-1 block text-danger">
            {avancement.refus.map((motif) => t(`refus.${motif}`)).join(" ")}
          </span>
        ) : null}
      </p>
    </div>
  );
}
