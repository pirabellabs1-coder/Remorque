"use client";

import { useTranslations } from "next-intl";
import { useTransition } from "react";

import { useRouter } from "@/i18n/navigation";
import { basculerFavori } from "@/server/annonces/favoris";

/**
 * Retrait d'un favori depuis la liste.
 *
 * Pas de confirmation : l'action est réversible en deux clics depuis la fiche,
 * et une boîte de dialogue pour si peu apprendrait surtout à cliquer sans lire.
 */
export function RetirerFavori({ annonceId }: { annonceId: string }) {
  const t = useTranslations("espaces.locataire.favoris");
  const router = useRouter();
  const [enCours, demarrer] = useTransition();

  return (
    <button
      type="button"
      disabled={enCours}
      onClick={() =>
        demarrer(async () => {
          await basculerFavori(annonceId);
          router.refresh();
        })
      }
      className="text-xs font-medium text-texte-attenue underline-offset-4 transition-colors hover:text-danger hover:underline disabled:opacity-60"
    >
      {t("retirer")}
    </button>
  );
}
