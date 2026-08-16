"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import type { CategoriePermis } from "@/domain/compatibilite/permis";
import { cn } from "@/lib/cn";

/**
 * Relevé du conducteur, au départ.
 *
 * **La question est posée, elle n'est pas devinée.** Rien n'obligeait le
 * locataire à être celui qui conduit, et la plateforme faisait comme si. Deux
 * boutons — « c'est moi » ou « quelqu'un d'autre » — suffisent à lever une
 * ambiguïté qui, sans eux, ne se découvre qu'au moment du sinistre.
 *
 * **Le tiers demande davantage, et cela se voit.** Le champ du nom et le
 * rappel de photographier le permis n'apparaissent que dans ce cas : les
 * afficher toujours ferait remplir au titulaire des informations que la
 * plateforme possède déjà, et un formulaire qui redemande ce qu'il sait est un
 * formulaire qu'on remplit de travers.
 *
 * Le nom est prérempli avec celui du locataire quand il conduit — non pour
 * gagner une frappe, mais pour que le constat porte toujours un nom, y compris
 * quand personne n'a touché ce bloc.
 */
export function ReleveConducteur({
  nomLocataire,
  categoriesConnues,
}: {
  nomLocataire: string;
  /** Catégories déjà vérifiées au dossier du locataire, s'il en a. */
  categoriesConnues: CategoriePermis[];
}) {
  const t = useTranslations("espaces.loueur.etatsDesLieux.conducteur");

  const [qualite, setQualite] = useState<"locataire" | "tiers">("locataire");
  const [categories, setCategories] = useState<CategoriePermis[]>(
    categoriesConnues.length > 0 ? categoriesConnues : ["B"],
  );

  function basculer(categorie: CategoriePermis) {
    setCategories((etat) =>
      etat.includes(categorie)
        ? etat.filter((entree) => entree !== categorie)
        : [...etat, categorie],
    );
  }

  return (
    <fieldset className="rounded-carte border border-bordure bg-fond-eleve p-5 shadow-(--ombre-carte)">
      <legend className="px-2 text-[0.9375rem] font-semibold">
        {t("titre")}
      </legend>

      <p className="mt-2 text-sm text-texte-attenue">{t("aide")}</p>

      <input type="hidden" name="conducteurQualite" value={qualite} />

      <div className="mt-4 flex flex-wrap gap-2">
        {(["locataire", "tiers"] as const).map((valeur) => (
          <button
            key={valeur}
            type="button"
            onClick={() => setQualite(valeur)}
            aria-pressed={qualite === valeur}
            className={cn(
              "rounded-champ border px-4 py-2.5 text-sm font-medium transition-colors",
              qualite === valeur
                ? "border-accent bg-accent text-accent-contraste"
                : "border-bordure hover:border-accent",
            )}
          >
            {t(`qualite.${valeur}`)}
          </button>
        ))}
      </div>

      <div className="mt-5">
        <label htmlFor="conducteurNom" className="text-sm font-medium">
          {t("nom")}
        </label>
        <input
          id="conducteurNom"
          name="conducteurNom"
          type="text"
          required
          maxLength={120}
          // Le nom du locataire reste modifiable : il arrive qu'il diffère de
          // celui du permis — nom d'usage, nom de jeune fille. C'est celui du
          // permis qui fait foi.
          defaultValue={nomLocataire}
          key={qualite}
          placeholder={qualite === "tiers" ? t("nomTiers") : undefined}
          className="mt-2 h-12 w-full rounded-champ border border-bordure bg-fond-eleve px-4 text-base focus:border-accent"
        />
        <p className="mt-1.5 text-xs text-texte-attenue">{t("nomAide")}</p>
      </div>

      <div className="mt-5">
        <p className="text-sm font-medium">{t("categories")}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {(["B", "B96", "BE"] as const).map((categorie) => (
            <label
              key={categorie}
              className={cn(
                "cursor-pointer rounded-champ border px-4 py-2.5 text-sm font-medium transition-colors",
                categories.includes(categorie)
                  ? "border-accent bg-accent text-accent-contraste"
                  : "border-bordure hover:border-accent",
              )}
            >
              <input
                type="checkbox"
                name="conducteurCategories"
                value={categorie}
                checked={categories.includes(categorie)}
                onChange={() => basculer(categorie)}
                className="sr-only"
              />
              {categorie}
            </label>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-texte-attenue">
          {t("categoriesAide")}
        </p>
      </div>

      {qualite === "tiers" ? (
        <p className="mt-5 rounded-champ border border-attention/30 bg-attention/5 px-4 py-3 text-sm">
          {t("photographierPermis")}
        </p>
      ) : null}
    </fieldset>
  );
}
