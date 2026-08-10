"use client";

import { useTranslations } from "next-intl";
import { useActionState, useId, useRef, useState, startTransition } from "react";

import { Bouton } from "@/components/ui/bouton";
import { PHOTOS_MAXIMUM } from "@/domain/annonce/publication";
import { deposerPhotos, type EtatDepot } from "@/server/annonces/publication-actions";

/**
 * Dépôt des photos d'une annonce.
 *
 * C'est le seul écran de l'assistant qui exige le navigateur, et pour une
 * raison précise : **les photos sont réduites avant de partir**. Une photo de
 * téléphone pèse aujourd'hui entre trois et huit méga-octets pour une image
 * qui ne sera jamais affichée à plus de 1 600 pixels de large. L'envoyer telle
 * quelle, c'est trois minutes d'attente sur un réseau de campagne, une action
 * serveur qui dépasse sa limite de corps, et un stockage qui gonfle pour rien.
 *
 * La réduction se fait donc ici, sur l'appareil : redimensionnement au plus
 * grand côté, réencodage en WebP. Une photo de six méga-octets en fait environ
 * trois cents kilo-octets, sans différence visible à l'écran.
 *
 * Si le navigateur ne sait pas le faire — appareil ancien, image exotique — le
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
  const [prepare, setPrepare] = useState(false);

  const [etat, action, enCours] = useActionState<EtatDepot, FormData>(
    deposerPhotos,
    { statut: "inactif" },
  );

  async function choisir(fichiers: FileList | null) {
    if (!fichiers || fichiers.length === 0) return;

    setPrepare(true);

    const reduites = await Promise.all(
      Array.from(fichiers).slice(0, restantes).map(reduire),
    );

    const donnees = new FormData();
    donnees.set("annonce", annonceId);
    donnees.set("locale", locale);

    for (const reduite of reduites) {
      donnees.append("photos", reduite.fichier);
      donnees.append("dimensions", `${reduite.largeur}x${reduite.hauteur}`);
    }

    setPrepare(false);
    if (champ.current) champ.current.value = "";

    startTransition(() => action(donnees));
  }

  const occupe = prepare || enCours;

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
        disabled={occupe || restantes <= 0}
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
          disabled={occupe || restantes <= 0}
          onClick={() => champ.current?.click()}
        >
          {occupe ? t("envoi") : t("choisir")}
        </Bouton>
      </div>

      <p aria-live="polite" className="mt-4 text-sm">
        {restantes <= 0 ? (
          <span className="text-texte-attenue">
            {t("complet", { maximum: PHOTOS_MAXIMUM })}
          </span>
        ) : null}

        {etat.statut === "fait" && etat.deposees > 0 ? (
          <span className="text-succes">
            {t("deposees", { nombre: etat.deposees })}
          </span>
        ) : null}

        {etat.statut === "fait" && etat.refus.length > 0 ? (
          <span className="mt-1 block text-danger">
            {etat.refus.map((motif) => t(`refus.${motif}`)).join(" ")}
          </span>
        ) : null}
      </p>
    </div>
  );
}
