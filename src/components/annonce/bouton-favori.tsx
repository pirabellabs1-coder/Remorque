"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";

import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { basculerFavori, estFavori } from "@/server/annonces/favoris";

/**
 * Cœur d'ajout aux favoris, sur la fiche publique.
 *
 * La fiche est pré-générée et ne connaît pas la session : l'état initial est
 * demandé après l'hydratation, et le bouton reste neutre d'ici là plutôt que
 * d'afficher un cœur vide qui se remplirait tout seul une seconde plus tard.
 * Sans session, le clic mène à la connexion — c'est le seul geste de la fiche
 * qui exige un compte.
 */
export function BoutonFavori({ annonceId }: { annonceId: string }) {
  const t = useTranslations("annonce");
  const router = useRouter();
  const [actif, setActif] = useState(false);
  const [enCours, demarrer] = useTransition();

  useEffect(() => {
    let vivant = true;
    estFavori(annonceId).then((valeur) => {
      if (vivant) setActif(valeur);
    });
    return () => {
      vivant = false;
    };
  }, [annonceId]);

  function basculer() {
    demarrer(async () => {
      const resultat = await basculerFavori(annonceId);

      if (!resultat.ok) {
        if (resultat.cle === "connexionRequise") router.push("/connexion");
        return;
      }

      setActif(resultat.favori);
    });
  }

  return (
    <button
      type="button"
      onClick={basculer}
      disabled={enCours}
      aria-pressed={actif}
      aria-label={actif ? t("favoriRetirer") : t("favoriAjouter")}
      title={actif ? t("favoriRetirer") : t("favoriAjouter")}
      className={cn(
        "grid size-11 shrink-0 place-items-center rounded-full border transition-colors",
        actif
          ? "border-accent/40 bg-accent/10 text-accent"
          : "border-bordure text-texte-attenue hover:border-accent hover:text-accent",
      )}
    >
      <svg
        viewBox="0 0 24 24"
        className="size-5"
        fill={actif ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.8"
        aria-hidden
      >
        <path d="M12 21c-4.8-3.4-8-6.4-8-10a4.6 4.6 0 0 1 8-3.1A4.6 4.6 0 0 1 20 11c0 3.6-3.2 6.6-8 10Z" />
      </svg>
    </button>
  );
}
