"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { Bouton } from "@/components/ui/bouton";
import { useRouter } from "@/i18n/navigation";
import { deciderDossier } from "@/server/verification/actions";

/**
 * Accepter ou refuser un dossier.
 *
 * **Le refus demande son motif avant de partir.** Le serveur l'exige déjà, et
 * ce n'est pas une redondance : ici le champ apparaît au moment où le
 * contrôleur choisit de refuser, donc pendant qu'il a la raison en tête. Le
 * lui réclamer après coup, par un message d'erreur, produirait « pièce
 * illisible » écrit machinalement — ce qui n'apprend rien à l'intéressé.
 *
 * **La date de fin de validité se relève, elle ne se devine pas.** Elle est au
 * dos du permis, sous les yeux du contrôleur. Sans elle, un permis vérifié en
 * 2026 ouvrirait encore les locations en 2040 ; le champ reste facultatif,
 * parce que les anciens permis roses n'en portent pas d'exploitable et que le
 * domaine sait traiter une date absente.
 */
export function DecisionDossier({
  utilisateurId,
  type,
  permis,
}: {
  utilisateurId: string;
  type: "identite" | "permis";
  permis: boolean;
}) {
  const t = useTranslations("espaces.admin.verifications.decision");
  const routeur = useRouter();

  const [refus, setRefus] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();

  function decider(donnees: FormData, accepte: boolean) {
    setErreur(null);
    donnees.set("utilisateur", utilisateurId);
    donnees.set("type", type);
    donnees.set("decision", accepte ? "accepter" : "refuser");

    demarrer(async () => {
      const resultat = await deciderDossier(donnees);
      if (!resultat.ok) {
        setErreur(resultat.cle);
        return;
      }
      routeur.refresh();
    });
  }

  return (
    <form
      className="mt-4"
      onSubmit={(evenement) => {
        evenement.preventDefault();
        decider(new FormData(evenement.currentTarget), false);
      }}
    >
      {permis ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="block text-xs font-medium text-texte-attenue">
              {t("expireLe")}
            </span>
            <input
              type="date"
              name="expireLe"
              className="mt-1 h-11 w-full rounded-champ border border-bordure bg-fond-eleve px-3 text-[0.9375rem]"
            />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-texte-attenue">
              {t("categories")}
            </span>
            <input
              type="text"
              name="categories"
              defaultValue="B"
              placeholder="B, BE"
              className="mt-1 h-11 w-full rounded-champ border border-bordure bg-fond-eleve px-3 text-[0.9375rem]"
            />
          </label>
        </div>
      ) : null}

      {refus ? (
        <label className="mt-3 block">
          <span className="block text-xs font-medium text-texte-attenue">
            {t("motif")}
          </span>
          <textarea
            name="motif"
            rows={2}
            required
            minLength={5}
            placeholder={t("motifExemple")}
            className="mt-1 w-full rounded-champ border border-bordure bg-fond-eleve px-3 py-2 text-[0.9375rem]"
          />
          <span className="mt-1 block text-xs text-texte-attenue">
            {t("motifVisible")}
          </span>
        </label>
      ) : null}

      {erreur ? (
        <p className="mt-3 text-sm text-danger" role="alert">
          {t(`erreur.${erreur}`)}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-3">
        <Bouton
          type="button"
          disabled={enCours}
          onClick={(evenement) => {
            const formulaire = evenement.currentTarget.form;
            if (formulaire) decider(new FormData(formulaire), true);
          }}
        >
          {t("accepter")}
        </Bouton>

        {refus ? (
          <Bouton type="submit" variante="secondaire" disabled={enCours}>
            {t("confirmerRefus")}
          </Bouton>
        ) : (
          <Bouton
            type="button"
            variante="secondaire"
            onClick={() => setRefus(true)}
          >
            {t("refuser")}
          </Bouton>
        )}
      </div>
    </form>
  );
}
