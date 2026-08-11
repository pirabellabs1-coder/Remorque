"use client";

import { useTranslations } from "next-intl";
import { useId, useState } from "react";

import { CATEGORIES } from "@/config/categories";
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
  const [categorie, setCategorie] = useState("");
  const [du, setDu] = useState("");
  const [au, setAu] = useState("");

  function soumettre(evenement: React.FormEvent<HTMLFormElement>) {
    evenement.preventDefault();

    const query: Record<string, string> = {};
    const saisie = ville.trim();
    if (saisie) query.ville = saisie;
    if (categorie) query.categorie = categorie;

    // Les deux dates ne partent qu'ensemble : une période ouverte d'un côté
    // ne veut rien dire pour une disponibilité, et filtrer sur une seule
    // écarterait des annonces sans que personne ne l'ait demandé.
    if (du && au) {
      query.du = du;
      query.au = au;
    }

    router.push({ pathname: "/recherche", query });
  }

  const aujourdhui = new Date().toISOString().slice(0, 10);

  const champSecondaire =
    "h-12 w-full rounded-champ border border-bordure bg-fond-eleve px-3 text-[0.9375rem] text-texte";

  return (
    <form
      onSubmit={soumettre}
      role="search"
      className={cn(
        variante === "carte"
          ? "rounded-carte border border-bordure bg-fond-eleve p-3 shadow-(--ombre-carte)"
          : "flex flex-col gap-3 sm:flex-row",
      )}
    >
      <div className={cn(variante === "carte" && "flex flex-col gap-3 sm:flex-row")}>
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
      </div>

      {/* Type et période, sur la carte de première vue seulement. La barre de
          rappel des résultats a déjà ses filtres juste en dessous : les
          répéter à deux endroits ferait deux sources pour un même réglage. */}
      {variante === "carte" ? (
        <div className="mt-3 grid gap-3 border-t border-bordure pt-3 sm:grid-cols-3">
          <div>
            <label
              htmlFor={`${identifiant}-type`}
              className="block text-xs font-medium text-texte-attenue"
            >
              {t("type")}
            </label>
            <select
              id={`${identifiant}-type`}
              value={categorie}
              onChange={(evenement) => setCategorie(evenement.target.value)}
              className={cn(champSecondaire, "mt-1")}
            >
              <option value="">{t("toutes")}</option>
              {CATEGORIES.map((entree) => (
                <option key={entree.slug} value={entree.slug}>
                  {entree.nom}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor={`${identifiant}-du`}
              className="block text-xs font-medium text-texte-attenue"
            >
              {t("retrait")}
            </label>
            <input
              id={`${identifiant}-du`}
              type="date"
              min={aujourdhui}
              value={du}
              onChange={(evenement) => {
                setDu(evenement.target.value);
                if (au && evenement.target.value > au) setAu("");
              }}
              className={cn(champSecondaire, "mt-1")}
            />
          </div>

          <div>
            <label
              htmlFor={`${identifiant}-au`}
              className="block text-xs font-medium text-texte-attenue"
            >
              {t("retour")}
            </label>
            <input
              id={`${identifiant}-au`}
              type="date"
              min={du || aujourdhui}
              value={au}
              onChange={(evenement) => setAu(evenement.target.value)}
              className={cn(champSecondaire, "mt-1")}
            />
          </div>
        </div>
      ) : null}
    </form>
  );
}
