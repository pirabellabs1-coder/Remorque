"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

/**
 * Référence publique et code QR d'une annonce.
 *
 * Deux façons de désigner le même bien hors de l'écran : une référence qu'on
 * dicte au téléphone et qu'on recopie sur un constat, un code QR qu'on colle
 * sur le timon et que le locataire photographie pour retrouver la fiche —
 * caractéristiques, PTAC, règles d'utilisation — sans avoir à la chercher.
 *
 * Le code QR arrive déjà dessiné du serveur : c'est du SVG, quelques centaines
 * d'octets, sans requête supplémentaire ni bibliothèque envoyée au navigateur.
 * Le téléchargement le reprend tel quel plutôt que d'aller le redemander.
 */
export function CarteReference({
  reference,
  adresse,
  qrSvg,
}: {
  reference: string;
  /** Adresse publique encodée dans le code QR. */
  adresse: string;
  /** Code QR, en SVG, produit par le serveur. */
  qrSvg: string;
}) {
  const t = useTranslations("annonce.reference");
  const [copie, setCopie] = useState(false);

  async function copier() {
    try {
      await navigator.clipboard.writeText(adresse);
      setCopie(true);
      // Le retour redevient neutre : un « copié » qui reste affiché finit par
      // ne plus rien dire, et laisse croire qu'un second clic a échoué.
      setTimeout(() => setCopie(false), 2500);
    } catch {
      // Presse-papiers refusé — navigateur ancien, contexte non sécurisé.
      // L'adresse reste visible et sélectionnable juste au-dessus.
    }
  }

  function telecharger() {
    const lien = document.createElement("a");
    const objet = URL.createObjectURL(
      new Blob([qrSvg], { type: "image/svg+xml" }),
    );

    lien.href = objet;
    lien.download = `${reference}.svg`;
    lien.click();
    URL.revokeObjectURL(objet);
  }

  const bouton =
    "inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-champ border border-bordure px-3 text-sm font-medium transition-colors hover:border-accent hover:text-accent";

  return (
    <div className="rounded-carte border border-bordure bg-fond-eleve p-5 shadow-(--ombre-carte)">
      <div className="flex items-start gap-4">
        {/* Fond blanc en dur : un code QR doit rester lisible en thème sombre
            comme sur une impression en noir et blanc. */}
        <div
          aria-hidden
          className="size-24 shrink-0 rounded-[0.5rem] bg-white p-1.5"
          dangerouslySetInnerHTML={{ __html: qrSvg }}
        />

        <div className="min-w-0">
          <p className="text-[0.6875rem] font-semibold tracking-[0.14em] text-texte-attenue uppercase">
            {t("titre")}
          </p>
          <p className="mt-1 font-mono text-lg font-semibold tracking-tight tabular-nums">
            {reference}
          </p>
          <p className="mt-2 text-sm text-texte-attenue">{t("aide")}</p>
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <button type="button" onClick={() => void copier()} className={bouton}>
          {copie ? t("copie") : t("copier")}
        </button>
        <button type="button" onClick={telecharger} className={bouton}>
          {t("telecharger")}
        </button>
      </div>
    </div>
  );
}
