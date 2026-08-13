"use client";

import { useTranslations } from "next-intl";
import { useRef, useState, useTransition } from "react";

import {
  MEDIAS_MAXIMUM,
  PHOTOS_MINIMUM,
  TAILLE_MAXIMUM,
} from "@/domain/location/medias";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { deposerMedias, retirerMedia } from "@/server/locations/medias";

export type MediaConstat = {
  id: string;
  url: string;
  media: "photo" | "video";
};

/**
 * Dépôt des pièces d'un état des lieux.
 *
 * **Un envoi par fichier, et non un envoi groupé.** Sur un parking, en bordure
 * de réseau, une requête qui porte huit photos échoue en bloc au premier
 * incident : on perd huit prises de vue et il faut tout recommencer. Fichier
 * par fichier, un échec ne coûte que lui-même, et la barre de progression
 * avance — ce qui compte quand on attend debout à côté d'une remorque.
 *
 * **La vidéo est proposée séparément de la photo.** Le même sélecteur pour les
 * deux ouvrirait la galerie entière ; deux boutons distincts ouvrent l'appareil
 * dans le bon mode, et disent au passage que la vidéo est possible — ce que
 * personne ne devine.
 *
 * Le compte des photographies est affiché en permanence, avec son minimum. Le
 * serveur refuse de signer un constat qui n'en porte pas assez ; l'apprendre
 * au moment de signer, après avoir rangé son téléphone, serait le pire moment.
 */
export function DepotMediasConstat({
  reservationId,
  type,
  medias,
}: {
  reservationId: string;
  type: "depart" | "retour";
  medias: MediaConstat[];
}) {
  const t = useTranslations("espaces.loueur.etatsDesLieux.medias");
  const routeur = useRouter();

  const photo = useRef<HTMLInputElement>(null);
  const video = useRef<HTMLInputElement>(null);

  const [refus, setRefus] = useState<string[]>([]);
  const [enCours, demarrer] = useTransition();

  const photos = medias.filter((media) => media.media === "photo").length;
  const reste = MEDIAS_MAXIMUM - medias.length;

  function envoyer(fichiers: FileList | null) {
    if (!fichiers || fichiers.length === 0) return;
    setRefus([]);

    demarrer(async () => {
      const motifs: string[] = [];

      for (const fichier of Array.from(fichiers)) {
        const donnees = new FormData();
        donnees.set("reservation", reservationId);
        donnees.set("type", type);
        donnees.append("medias", fichier);

        const bilan = await deposerMedias(donnees);
        motifs.push(...bilan.refus);
      }

      setRefus([...new Set(motifs)]);
      routeur.refresh();
    });
  }

  function retirer(mediaId: string) {
    demarrer(async () => {
      const donnees = new FormData();
      donnees.set("media", mediaId);
      await retirerMedia(donnees);
      routeur.refresh();
    });
  }

  return (
    <fieldset className="rounded-carte border border-bordure bg-fond-eleve p-5 shadow-(--ombre-carte)">
      <legend className="px-2 text-[0.9375rem] font-semibold">
        {t("titre")}
      </legend>

      <p className="mt-2 text-sm text-texte-attenue">{t("aide")}</p>

      <p
        className={cn(
          "mt-3 text-sm font-medium",
          photos >= PHOTOS_MINIMUM ? "text-succes" : "text-attention",
        )}
      >
        {t("compte", { photos, minimum: PHOTOS_MINIMUM })}
      </p>

      {medias.length > 0 ? (
        <ul className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {medias.map((media) => (
            <li key={media.id} className="relative">
              {media.media === "video" ? (
                <video
                  src={media.url}
                  controls
                  playsInline
                  className="aspect-square w-full rounded-[0.5rem] border border-bordure object-cover"
                />
              ) : (
                // Balise native plutôt que le composant d'illustration : ces
                // images sont éphémères à l'écran, jamais indexées, et le
                // redimensionnement à la volée coûterait plus qu'il ne rend.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={media.url}
                  alt=""
                  className="aspect-square w-full rounded-[0.5rem] border border-bordure object-cover"
                />
              )}

              <button
                type="button"
                onClick={() => retirer(media.id)}
                disabled={enCours}
                aria-label={t("retirer")}
                className="absolute top-1 right-1 grid size-7 place-items-center rounded-full bg-black/60 text-white backdrop-blur-sm transition-colors hover:bg-black/80"
              >
                <span aria-hidden>×</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {refus.length > 0 ? (
        <ul className="mt-3 space-y-1" role="alert">
          {refus.map((motif) => (
            <li key={motif} className="text-sm text-danger">
              {t(`refus.${motif}`, {
                photo: Math.round(TAILLE_MAXIMUM.photo / 1024 / 1024),
                video: Math.round(TAILLE_MAXIMUM.video / 1024 / 1024),
                maximum: MEDIAS_MAXIMUM,
              })}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => photo.current?.click()}
          disabled={enCours || reste <= 0}
          className="rounded-champ border border-bordure px-4 py-2.5 text-sm font-medium transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
        >
          {enCours ? t("envoi") : t("ajouterPhoto")}
        </button>

        <button
          type="button"
          onClick={() => video.current?.click()}
          disabled={enCours || reste <= 0}
          className="rounded-champ border border-bordure px-4 py-2.5 text-sm font-medium transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
        >
          {t("ajouterVideo")}
        </button>
      </div>

      {/* `capture="environment"` ouvre l'appareil arrière plutôt que la
          galerie : c'est le geste réel, on photographie la remorque qu'on a
          devant soi. L'attribut n'est qu'une préférence — choisir un fichier
          existant reste possible. */}
      <input
        ref={photo}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        multiple
        className="sr-only"
        onChange={(evenement) => {
          envoyer(evenement.target.files);
          evenement.target.value = "";
        }}
      />
      <input
        ref={video}
        type="file"
        accept="video/mp4,video/quicktime"
        capture="environment"
        className="sr-only"
        onChange={(evenement) => {
          envoyer(evenement.target.files);
          evenement.target.value = "";
        }}
      />
    </fieldset>
  );
}
