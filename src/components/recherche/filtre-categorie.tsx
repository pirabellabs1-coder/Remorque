"use client";

import { useTranslations } from "next-intl";
import { useId } from "react";

import { CATEGORIES } from "@/config/categories";
import { useRouter } from "@/i18n/navigation";

/**
 * Filtre de catégorie, en liste déroulante.
 *
 * Il remplace une rangée de onze pastilles qui débordait de l'écran : sur un
 * ordinateur, elle imposait une barre de défilement horizontale sous le titre ;
 * sur un téléphone, elle cachait sept catégories sur onze derrière un geste que
 * rien n'annonçait. Une liste déroulante montre tout le choix d'un coup, tient
 * sur une ligne, et se manipule au clavier comme au doigt sans apprentissage.
 *
 * Le tri et le rayon restent en pastilles : deux ou quatre valeurs courtes se
 * comparent d'un regard, et ouvrir une liste pour choisir entre « prix » et
 * « note » coûterait plus qu'il ne rapporte.
 */
export function FiltreCategorie({
  valeur,
  parametres,
}: {
  /** Catégorie active, ou chaîne vide pour « toutes ». */
  valeur: string;
  /** Les autres critères en cours, à conserver au changement de catégorie. */
  parametres: Record<string, string>;
}) {
  const t = useTranslations("recherche.filtres");
  const routeur = useRouter();
  const identifiant = useId();

  function changer(choisie: string) {
    const query = { ...parametres };
    if (choisie) query.categorie = choisie;
    else delete query.categorie;

    routeur.push({ pathname: "/recherche", query });
  }

  return (
    <div className="flex items-center gap-3">
      <label
        htmlFor={identifiant}
        className="shrink-0 text-sm font-medium text-texte-attenue"
      >
        {t("categorie")}
      </label>

      <select
        id={identifiant}
        value={valeur}
        onChange={(evenement) => changer(evenement.target.value)}
        className="h-11 w-full max-w-xs rounded-champ border border-bordure bg-fond-eleve px-3 text-[0.9375rem] font-medium transition-colors hover:border-accent focus:border-accent"
      >
        <option value="">{t("tout")}</option>
        {CATEGORIES.map((entree) => (
          <option key={entree.slug} value={entree.slug}>
            {entree.nom}
          </option>
        ))}
      </select>
    </div>
  );
}
