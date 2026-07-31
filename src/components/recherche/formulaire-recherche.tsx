"use client";

import { useTranslations } from "next-intl";
import { useId, useState } from "react";

import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/cn";

/**
 * Formulaire de recherche principal.
 *
 * Un seul champ, volontairement.
 *
 * Les deux sélecteurs de dates et la liste de catégories ont été retirés : sur
 * mobile, chaque champ de date ouvre un calendrier plein écran pour un critère
 * que le visiteur ne connaît souvent pas encore, et une liste de dix catégories
 * en amont de tout résultat est un filtre déguisé en critère d'entrée. Les deux
 * se règlent bien mieux sur l'écran de résultats, où l'on voit ce que l'on
 * filtre. C'est aussi ce que font les places de marché de référence : « où ? »,
 * puis rien.
 *
 * Rendu dans un vrai `<form>` : la touche Entrée fonctionne, la recherche reste
 * possible sans JavaScript, et les critères passent par l'adresse — une
 * recherche doit pouvoir être partagée, mise en favori et indexée (M03, M15).
 */
export function FormulaireRecherche({
  variante = "carte",
  valeurInitiale = "",
}: {
  /**
   * `carte` : le formulaire porte son propre cadre — barre de rappel en tête
   * des résultats. `nu` : le cadre est fourni par le conteneur, cas de la
   * carte de recherche de la première vue.
   */
  variante?: "carte" | "nu";
  valeurInitiale?: string;
}) {
  const t = useTranslations("recherche.formulaire");
  const router = useRouter();
  const identifiant = useId();

  const [ville, setVille] = useState(valeurInitiale);

  function soumettre(evenement: React.FormEvent<HTMLFormElement>) {
    evenement.preventDefault();

    const saisie = ville.trim();
    router.push({
      pathname: "/recherche",
      query: saisie ? { ville: saisie } : {},
    });
  }

  return (
    <form
      onSubmit={soumettre}
      role="search"
      className={cn(
        "flex flex-col gap-3 sm:flex-row",
        variante === "carte" &&
          "rounded-carte border border-bordure bg-fond-eleve p-3 shadow-(--ombre-carte)",
      )}
    >
      <div className="flex-1">
        <label htmlFor={`${identifiant}-ville`} className="sr-only">
          {t("ou")}
        </label>
        <input
          id={`${identifiant}-ville`}
          name="ville"
          type="search"
          // `address-level2` correspond à la ville ; `postal-code` proposerait
          // un code postal seul, que le champ n'attend pas en premier.
          autoComplete="address-level2"
          enterKeyHint="search"
          placeholder={t("ouPlaceholder")}
          value={ville}
          onChange={(evenement) => setVille(evenement.target.value)}
          // `text-texte` est indispensable : dans la première vue, le
          // formulaire est posé dans une section en `text-encre-texte`, donc
          // blanche. Sans cette classe, le champ héritait du blanc et l'on
          // écrivait en blanc sur blanc.
          className="h-14 w-full rounded-champ border border-bordure bg-fond-eleve px-4 text-base text-texte placeholder:text-texte-attenue"
        />
      </div>

      <button
        type="submit"
        className="h-14 shrink-0 rounded-champ bg-accent px-8 font-medium text-accent-contraste transition-opacity hover:opacity-90"
      >
        {t("rechercher")}
      </button>
    </form>
  );
}
