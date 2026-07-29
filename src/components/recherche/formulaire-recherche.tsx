"use client";

import { useTranslations } from "next-intl";
import { useId, useState } from "react";

import { CATEGORIES } from "@/config/categories";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/cn";

/** Date du jour au format attendu par un champ `date`, sans dépendance. */
function aujourdhui(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Formulaire de recherche principal.
 *
 * Rendu dans un vrai `<form>` : la recherche reste possible sans JavaScript,
 * la touche Entrée fonctionne, et les navigateurs proposent leur
 * autocomplétion. Les critères passent par l'adresse — une recherche doit
 * pouvoir être partagée, mise en favori et indexée (M03, M15).
 */
export function FormulaireRecherche({
  variante = "carte",
}: {
  /**
   * `carte` : le formulaire porte son propre cadre — barre de rappel en tête
   * des résultats. `nu` : le cadre est fourni par le conteneur, cas de la
   * carte de recherche flottante de la page d'accueil.
   */
  variante?: "carte" | "nu";
}) {
  const t = useTranslations("recherche.formulaire");
  const router = useRouter();
  const identifiant = useId();

  const [ville, setVille] = useState("");
  const [debut, setDebut] = useState("");
  const [fin, setFin] = useState("");
  const [categorie, setCategorie] = useState("");

  function soumettre(evenement: React.FormEvent<HTMLFormElement>) {
    evenement.preventDefault();

    const parametres = new URLSearchParams();
    if (ville.trim()) parametres.set("ville", ville.trim());
    if (debut) parametres.set("debut", debut);
    if (fin) parametres.set("fin", fin);
    if (categorie) parametres.set("categorie", categorie);

    router.push({
      pathname: "/recherche",
      query: Object.fromEntries(parametres),
    });
  }

  const classeChamp =
    "h-12 w-full rounded-champ border border-bordure bg-fond-eleve px-3 text-[0.9375rem]";

  return (
    <form
      onSubmit={soumettre}
      className={cn(
        variante === "carte" &&
          "rounded-carte border border-bordure bg-fond-eleve p-3 shadow-sm",
      )}
    >
      <div className="grid gap-3 md:grid-cols-[1.4fr_1fr_1fr_1.2fr_auto]">
        <div>
          <label
            htmlFor={`${identifiant}-ville`}
            className="block px-1 pb-1 text-xs font-medium text-texte-attenue"
          >
            {t("ou")}
          </label>
          <input
            id={`${identifiant}-ville`}
            name="ville"
            type="text"
            autoComplete="postal-code"
            enterKeyHint="search"
            placeholder={t("ouPlaceholder")}
            value={ville}
            onChange={(evenement) => setVille(evenement.target.value)}
            className={classeChamp}
          />
        </div>

        <div>
          <label
            htmlFor={`${identifiant}-debut`}
            className="block px-1 pb-1 text-xs font-medium text-texte-attenue"
          >
            {t("du")}
          </label>
          <input
            id={`${identifiant}-debut`}
            name="debut"
            type="date"
            min={aujourdhui()}
            value={debut}
            onChange={(evenement) => {
              setDebut(evenement.target.value);
              // Une date de fin antérieure au nouveau début n'a pas de sens :
              // on la corrige plutôt que d'afficher une erreur.
              if (fin && evenement.target.value > fin) setFin("");
            }}
            className={classeChamp}
          />
        </div>

        <div>
          <label
            htmlFor={`${identifiant}-fin`}
            className="block px-1 pb-1 text-xs font-medium text-texte-attenue"
          >
            {t("au")}
          </label>
          <input
            id={`${identifiant}-fin`}
            name="fin"
            type="date"
            min={debut || aujourdhui()}
            value={fin}
            onChange={(evenement) => setFin(evenement.target.value)}
            className={classeChamp}
          />
        </div>

        <div>
          <label
            htmlFor={`${identifiant}-categorie`}
            className="block px-1 pb-1 text-xs font-medium text-texte-attenue"
          >
            {t("quoi")}
          </label>
          <select
            id={`${identifiant}-categorie`}
            name="categorie"
            value={categorie}
            onChange={(evenement) => setCategorie(evenement.target.value)}
            className={classeChamp}
          >
            <option value="">{t("toutesCategories")}</option>
            {CATEGORIES.map((entree) => (
              <option key={entree.slug} value={entree.slug}>
                {entree.nom}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-end">
          <button
            type="submit"
            className="h-12 w-full rounded-champ bg-accent px-6 font-medium text-accent-contraste transition-opacity hover:opacity-90 md:w-auto"
          >
            {t("rechercher")}
          </button>
        </div>
      </div>
    </form>
  );
}
