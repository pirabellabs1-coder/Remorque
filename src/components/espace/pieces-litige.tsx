"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { useRouter } from "@/i18n/navigation";
import { verserPiece } from "@/server/litiges/pieces";

/**
 * Versement d'une pièce au dossier.
 *
 * Le champ se vide au versement réussi, jamais avant : une déclaration
 * perdue sur un incident réseau ne se retape pas de mémoire — surtout pas
 * celle qu'on verse à un dossier de litige.
 */
export function FormulairePiece({ litigeId }: { litigeId: string }) {
  const t = useTranslations("espaces.litige.pieces");
  const router = useRouter();
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();

  function soumettre(evenement: React.FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    setErreur(null);

    const formulaire = evenement.currentTarget;
    const donnees = new FormData(formulaire);

    demarrer(async () => {
      const resultat = await verserPiece(donnees);

      if (resultat.ok) {
        formulaire.reset();
        router.refresh();
        return;
      }

      const connues = ["invalide", "interdit", "dossierClos", "connexionRequise"];
      setErreur(
        connues.includes(resultat.cle)
          ? t(`erreurs.${resultat.cle}` as never)
          : t("erreurs.echec"),
      );
    });
  }

  return (
    <form onSubmit={soumettre} className="mt-4">
      <input type="hidden" name="litigeId" value={litigeId} />

      <label htmlFor="piece" className="text-sm font-medium">
        {t("verser")}
      </label>
      <p className="mt-1 text-sm text-texte-attenue">{t("aide")}</p>
      <textarea
        id="piece"
        name="commentaire"
        required
        minLength={10}
        maxLength={2000}
        rows={3}
        className="mt-2 w-full resize-y rounded-champ border border-bordure bg-fond-eleve px-4 py-3 text-base focus:border-accent"
      />

      <div className="mt-3">
        <button
          type="submit"
          disabled={enCours}
          className="rounded-champ border border-bordure px-4 py-2.5 text-sm font-medium transition-colors hover:border-accent hover:text-accent disabled:opacity-60"
        >
          {enCours ? t("versement") : t("bouton")}
        </button>
      </div>

      {erreur ? (
        <p role="alert" className="mt-2 text-sm text-danger">
          {erreur}
        </p>
      ) : null}
    </form>
  );
}
