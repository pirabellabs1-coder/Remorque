"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import {
  DepotMediasConstat,
  type MediaConstat,
} from "@/components/espace/depot-medias-constat";
import { PaveSignature } from "@/components/espace/pave-signature";
import { ReleveConducteur } from "@/components/espace/releve-conducteur";
import type { CategoriePermis } from "@/domain/compatibilite/permis";
import { POINTS_CONTROLE } from "@/domain/location/constat";
import { PHOTOS_MINIMUM } from "@/domain/location/medias";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { enregistrerConstat } from "@/server/locations/actions";

/**
 * Saisie d'un état des lieux, sur le terrain.
 *
 * L'écran est fait pour un téléphone tenu d'une main à côté du matériel :
 * chaque point de contrôle est une paire de boutons larges, pas une liste de
 * cases à cocher. Aucun point n'a de valeur par défaut — un « conforme »
 * prérempli serait un point qu'on n'a pas regardé, et le formulaire refuse
 * d'être soumis tant que tout n'a pas été examiné.
 *
 * Les deux signatures se font sur le même appareil, comme sur le terrain :
 * le constat est contradictoire ou n'est pas.
 */
export function FormulaireConstat({
  reservationId,
  type,
  medias,
  nomLocataire,
  categoriesConnues,
}: {
  reservationId: string;
  type: "depart" | "retour";
  medias: MediaConstat[];
  /** Nom du locataire, proposé par défaut quand c'est lui qui conduit. */
  nomLocataire: string;
  /** Catégories déjà vérifiées à son dossier, s'il en a déposé. */
  categoriesConnues: CategoriePermis[];
}) {
  const t = useTranslations("espaces.loueur.etatsDesLieux.formulaire");
  const router = useRouter();
  const [reponses, setReponses] = useState<Record<string, "conforme" | "defaut">>({});
  const [signatures, setSignatures] = useState({
    locataire: false,
    proprietaire: false,
  });
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();

  // Trois conditions, et l'écran dit laquelle manque. Un bouton grisé sans
  // explication fait chercher la faute là où elle n'est pas.
  const pointsFaits = POINTS_CONTROLE.every((point) => reponses[point]);
  const photosFaites =
    medias.filter((media) => media.media === "photo").length >= PHOTOS_MINIMUM;
  const signe = signatures.locataire && signatures.proprietaire;
  const complet = pointsFaits && photosFaites && signe;

  function soumettre(evenement: React.FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    setErreur(null);

    const donnees = new FormData(evenement.currentTarget);

    demarrer(async () => {
      const resultat = await enregistrerConstat(donnees);

      if (resultat.ok) {
        router.push("/proprietaire/etats-des-lieux");
        router.refresh();
        return;
      }

      const connues = [
        "invalide",
        "interdit",
        "statutIncompatible",
        "dejaRealise",
        "departManquant",
        "photosInsuffisantes",
        "conducteurIncomplet",
        "connexionRequise",
      ];
      setErreur(
        connues.includes(resultat.cle)
          ? t(`erreurs.${resultat.cle}` as never)
          : t("erreurs.echec"),
      );
    });
  }

  return (
    <form onSubmit={soumettre} className="mt-8 space-y-8">
      <input type="hidden" name="reservationId" value={reservationId} />
      <input type="hidden" name="type" value={type} />

      <fieldset className="rounded-carte border border-bordure bg-fond-eleve p-5 shadow-(--ombre-carte)">
        <legend className="px-2 text-[0.9375rem] font-semibold">
          {t("controles")}
        </legend>

        <ul className="mt-2 divide-y divide-bordure">
          {POINTS_CONTROLE.map((point) => (
            <li
              key={point}
              className="flex flex-wrap items-center justify-between gap-3 py-3.5"
            >
              <span className="text-[0.9375rem] font-medium">
                {t(`points.${point}` as never)}
              </span>

              <div
                role="radiogroup"
                aria-label={t(`points.${point}` as never)}
                className="flex gap-2"
              >
                {(["conforme", "defaut"] as const).map((valeur) => (
                  <label
                    key={valeur}
                    className={cn(
                      "cursor-pointer rounded-champ border px-4 py-2.5 text-sm font-medium transition-colors",
                      reponses[point] === valeur
                        ? valeur === "conforme"
                          ? "border-succes bg-succes text-white"
                          : "border-danger bg-danger text-white"
                        : "border-bordure hover:border-accent",
                    )}
                  >
                    <input
                      type="radio"
                      name={`controle_${point}`}
                      value={valeur}
                      checked={reponses[point] === valeur}
                      onChange={() =>
                        setReponses((etat) => ({ ...etat, [point]: valeur }))
                      }
                      className="sr-only"
                    />
                    {t(valeur)}
                  </label>
                ))}
              </div>
            </li>
          ))}
        </ul>
      </fieldset>

      <DepotMediasConstat
        reservationId={reservationId}
        type={type}
        medias={medias}
      />

      {/* Au départ seulement : au retour, la remorque revient, et qui la
          ramène n'engage plus rien de neuf. */}
      {type === "depart" ? (
        <ReleveConducteur
          nomLocataire={nomLocataire}
          categoriesConnues={categoriesConnues}
        />
      ) : null}

      <fieldset className="rounded-carte border border-bordure bg-fond-eleve p-5 shadow-(--ombre-carte)">
        <legend className="px-2 text-[0.9375rem] font-semibold">
          {t("observations")}
        </legend>

        <div className="mt-2 grid gap-5">
          <div>
            <label htmlFor="kilometrage" className="text-sm font-medium">
              {t("kilometrage")}
            </label>
            <input
              id="kilometrage"
              name="kilometrage"
              type="number"
              inputMode="numeric"
              min={0}
              className="mt-2 h-12 w-full rounded-champ border border-bordure bg-fond-eleve px-4 text-base focus:border-accent"
            />
          </div>

          <div>
            <label htmlFor="commentaire" className="text-sm font-medium">
              {t("commentaire")}
            </label>
            <textarea
              id="commentaire"
              name="commentaire"
              rows={3}
              maxLength={2000}
              placeholder={t("commentaireAide")}
              className="mt-2 w-full resize-y rounded-champ border border-bordure bg-fond-eleve px-4 py-3 text-base placeholder:text-texte-attenue/70 focus:border-accent"
            />
          </div>
        </div>
      </fieldset>

      <fieldset className="rounded-carte border border-bordure bg-fond-eleve p-5 shadow-(--ombre-carte)">
        <legend className="px-2 text-[0.9375rem] font-semibold">
          {t("signatures")}
        </legend>

        <p className="mt-2 text-sm text-texte-attenue">{t("signaturesAide")}</p>

        {/* Chacun signe à son tour, sur le même appareil. C'est l'ordre du
            terrain : on se met d'accord, l'un signe, il passe le téléphone. */}
        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          <PaveSignature
            nom="signatureLocataire"
            libelle={t("signatureLocataire")}
            surSignature={(signe) =>
              setSignatures((etat) => ({ ...etat, locataire: signe }))
            }
          />
          <PaveSignature
            nom="signatureProprietaire"
            libelle={t("signatureProprietaire")}
            surSignature={(signe) =>
              setSignatures((etat) => ({ ...etat, proprietaire: signe }))
            }
          />
        </div>
      </fieldset>

      <div>
        <button
          type="submit"
          disabled={!complet || enCours}
          className="w-full rounded-champ bg-accent px-6 py-3.5 text-base font-medium text-accent-contraste transition-opacity hover:opacity-90 disabled:opacity-50 sm:w-auto"
        >
          {enCours ? t("enregistrement") : t("enregistrer")}
        </button>

        {!complet ? (
          <p className="mt-2 text-sm text-texte-attenue">
            {!pointsFaits
              ? t("incomplet")
              : !photosFaites
                ? t("photosManquantes", { minimum: PHOTOS_MINIMUM })
                : t("signaturesManquantes")}
          </p>
        ) : null}

        {erreur ? (
          <p role="alert" className="mt-2 text-sm text-danger">
            {erreur}
          </p>
        ) : null}
      </div>
    </form>
  );
}
