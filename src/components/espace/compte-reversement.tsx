"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { cn } from "@/lib/cn";
import { ouvrirCompteReversement } from "@/server/paiements/reversement";

type Etat = "absent" | "incomplet" | "actif" | "indisponible";

/**
 * Compte de reversement du propriétaire.
 *
 * Trois états, trois messages différents — et c'est le but. « Compte
 * incomplet » n'est pas « compte absent » : dans le premier cas le
 * propriétaire a commencé et doit finir, dans le second il n'a rien fait.
 * Confondre les deux le laisse chercher ce qu'on attend de lui, alors que sa
 * question est simple : quand serai-je payé ?
 */
export function CompteReversement({ etat }: { etat: Etat }) {
  const t = useTranslations("espaces.loueur.reversement");
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();

  function ouvrir() {
    setErreur(null);

    demarrer(async () => {
      const resultat = await ouvrirCompteReversement();

      if (resultat.ok && resultat.url) {
        window.location.assign(resultat.url);
        return;
      }

      setErreur(
        !resultat.ok && resultat.cle === "paiementIndisponible"
          ? t("indisponible")
          : t("echec"),
      );
    });
  }

  if (etat === "actif") {
    return (
      <p className="mt-2 inline-flex items-center gap-2 text-[0.9375rem] text-succes">
        <span aria-hidden>●</span>
        {t("actif")}
      </p>
    );
  }

  return (
    <div
      className={cn(
        "mt-4 rounded-carte border p-5",
        etat === "indisponible"
          ? "border-bordure bg-fond-eleve"
          : "border-attention/40 bg-attention/10",
      )}
    >
      <p className="text-[0.9375rem] font-medium">
        {etat === "indisponible"
          ? t("indisponible")
          : etat === "incomplet"
            ? t("incomplet")
            : t("absent")}
      </p>

      {etat !== "indisponible" ? (
        <>
          <p className="mt-1 text-sm text-texte-attenue">{t("aide")}</p>
          <button
            type="button"
            onClick={ouvrir}
            disabled={enCours}
            className="mt-3 rounded-champ bg-accent px-4 py-2.5 text-sm font-medium text-accent-contraste transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {enCours
              ? t("ouverture")
              : etat === "incomplet"
                ? t("reprendre")
                : t("ouvrir")}
          </button>
        </>
      ) : null}

      {erreur ? (
        <p role="alert" className="mt-2 text-sm text-danger">
          {erreur}
        </p>
      ) : null}
    </div>
  );
}
