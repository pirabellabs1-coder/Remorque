"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { ouvrirPaiement } from "@/server/paiements/actions";

/**
 * Règlement d'une location acceptée.
 *
 * Le bouton mène chez Stripe : on ne saisit jamais de numéro de carte sur nos
 * pages, et c'est ce qui dispense la plateforme de la certification la plus
 * lourde. La redirection est faite par le navigateur avec l'adresse rendue par
 * le serveur.
 *
 * Quand le paiement n'est pas configuré, le bouton le dit. Un bouton qui
 * tourne dans le vide fait recommencer trois fois avant de faire douter.
 */
export function BoutonPayer({ reservationId }: { reservationId: string }) {
  const t = useTranslations("espaces.paiement");
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();

  function payer() {
    setErreur(null);

    demarrer(async () => {
      const resultat = await ouvrirPaiement(reservationId);

      if (resultat.ok) {
        window.location.assign(resultat.url);
        return;
      }

      const connues = [
        "connexionRequise",
        "interdit",
        "statutIncompatible",
        "paiementIndisponible",
        "totalIncoherent",
        "totalNul",
      ];
      setErreur(
        connues.includes(resultat.cle)
          ? t(`erreurs.${resultat.cle}` as never)
          : t("erreurs.echec"),
      );
    });
  }

  return (
    <div>
      <button
        type="button"
        onClick={payer}
        disabled={enCours}
        className="rounded-champ bg-accent px-4 py-2.5 text-sm font-medium text-accent-contraste transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {enCours ? t("ouverture") : t("payer")}
      </button>

      {erreur ? (
        <p role="alert" className="mt-2 max-w-xs text-sm text-danger">
          {erreur}
        </p>
      ) : null}
    </div>
  );
}
