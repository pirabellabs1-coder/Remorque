"use client";

import { useTranslations } from "next-intl";
import { useRef, useState, useTransition } from "react";

import { Pastille } from "@/components/espace/tableau";
import { Bouton } from "@/components/ui/bouton";
import { useRouter } from "@/i18n/navigation";
import { deposerPieces } from "@/server/verification/actions";

/**
 * Dépôt d'une pièce, recto et verso.
 *
 * **Les deux faces ensemble, dans un seul envoi.** Le numéro et la date de fin
 * de validité sont au dos des deux documents ; un contrôleur qui ne reçoit que
 * l'avant ne peut pas relever ce qui rend la vérification périssable, et il
 * refuse — ce qui fait recommencer. Le formulaire exige donc les deux avant
 * d'activer son bouton, plutôt que d'accepter un demi-dossier et de le rejeter
 * ensuite.
 *
 * **La capture est proposée d'abord.** `capture="environment"` ouvre l'appareil
 * photo arrière sur téléphone au lieu de la galerie : c'est le geste réel — on
 * sort sa carte et on la photographie — et plus de sept visiteurs sur dix sont
 * sur mobile. Le choix d'un fichier reste possible, l'attribut n'est qu'une
 * préférence d'ouverture.
 *
 * Aucune vignette n'est affichée après sélection. C'est délibéré : montrer une
 * carte d'identité en grand sur un écran qu'on tient dans un lieu public n'aide
 * personne. Le nom du fichier suffit à confirmer qu'il est bien pris en compte.
 */
export function DepotPiece({
  type,
  titre,
  explication,
}: {
  type: "identite" | "permis";
  titre: string;
  explication: string;
}) {
  const t = useTranslations("espaces.verification");
  const routeur = useRouter();
  const formulaire = useRef<HTMLFormElement>(null);

  const [faces, setFaces] = useState({ recto: "", verso: "" });
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();

  const complet = faces.recto !== "" && faces.verso !== "";

  function envoyer(evenement: React.FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    setErreur(null);

    const donnees = new FormData(evenement.currentTarget);
    donnees.set("type", type);

    demarrer(async () => {
      const resultat = await deposerPieces(donnees);

      if (!resultat.ok) {
        setErreur(resultat.cle);
        return;
      }

      setFaces({ recto: "", verso: "" });
      formulaire.current?.reset();
      routeur.refresh();
    });
  }

  return (
    <form ref={formulaire} onSubmit={envoyer} className="mt-6">
      <p className="text-sm font-medium">{titre}</p>
      <p className="mt-1 text-sm text-texte-attenue">{explication}</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {(["recto", "verso"] as const).map((face) => (
          <label
            key={face}
            className="flex cursor-pointer flex-col justify-center rounded-champ border border-dashed border-bordure bg-fond-doux px-4 py-5 text-center transition-colors hover:border-accent"
          >
            <span className="text-sm font-medium">{t(`face.${face}`)}</span>
            <span className="mt-1 text-xs text-texte-attenue">
              {faces[face] || t("choisir")}
            </span>
            <input
              type="file"
              name={face}
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              className="sr-only"
              onChange={(evenement) =>
                setFaces((etat) => ({
                  ...etat,
                  [face]: evenement.target.files?.[0]?.name ?? "",
                }))
              }
            />
          </label>
        ))}
      </div>

      {erreur ? (
        <p className="mt-3 text-sm text-danger" role="alert">
          {t(`erreur.${erreur}`)}
        </p>
      ) : null}

      <div className="mt-4 flex items-center gap-3">
        <Bouton type="submit" disabled={!complet || enCours}>
          {enCours ? t("envoi") : t("envoyer")}
        </Bouton>
        {!complet ? (
          <Pastille ton="neutre">{t("deuxFacesRequises")}</Pastille>
        ) : null}
      </div>
    </form>
  );
}
