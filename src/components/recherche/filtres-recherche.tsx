"use client";

import { useTranslations } from "next-intl";
import { useId, useState } from "react";

import { CATEGORIES } from "@/config/categories";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/cn";

/**
 * Filtres de recherche, en colonne à gauche.
 *
 * Tout est en liste déroulante, y compris les deux critères qui ne prennent
 * que deux valeurs. Une case à cocher aurait été plus courte, mais la colonne
 * y perdait : sept commandes de trois formes différentes se lisent moins vite
 * qu'une pile de listes identiques, où l'œil descend sans se réajuster. Et
 * « Peu importe » dit explicitement qu'on n'a pas filtré, là où une case
 * décochée laisse hésiter.
 *
 * **Des paliers plutôt que des curseurs.** Un curseur à deux poignées se
 * manipule mal au doigt, et personne ne cherche « entre 37 et 62 € » : on
 * cherche « pas plus de 50 ».
 *
 * **La charge utile plutôt que le PTAC.** C'est la question réelle du
 * locataire — « puis-je y mettre une tonne ? » — là où le PTAC comprend le
 * poids de la remorque elle-même et trompe son monde.
 *
 * L'état vit dans l'adresse : chaque choix pousse une nouvelle adresse, qui se
 * partage, se met en favori et revient intacte par le bouton « précédent ».
 */
export function FiltresRecherche({
  parametres,
  actifs,
  paliersPrix,
  paliersCharge,
  monnaie,
}: {
  /** Critères courants, que chaque changement conserve. */
  parametres: Record<string, string>;
  actifs: {
    categorie: string;
    prixMax?: number;
    chargeMin?: number;
    freinee: boolean;
    instantanee: boolean;
  };
  paliersPrix: readonly number[];
  paliersCharge: readonly number[];
  monnaie: string;
}) {
  const t = useTranslations("recherche.filtres");
  const routeur = useRouter();
  const identifiant = useId();
  const [ouvert, setOuvert] = useState(false);

  const nombreActifs = [
    actifs.categorie,
    actifs.prixMax,
    actifs.chargeMin,
    actifs.freinee || undefined,
    actifs.instantanee || undefined,
  ].filter(Boolean).length;

  /** Change une clé et pousse la nouvelle adresse. */
  function changer(cle: string, valeur: string) {
    const requete = { ...parametres };
    if (valeur) requete[cle] = valeur;
    else delete requete[cle];

    routeur.push({ pathname: "/recherche", query: requete });
  }

  const listeClasse =
    "mt-2 h-11 w-full rounded-champ border border-bordure bg-fond-eleve px-3 text-[0.9375rem] transition-colors hover:border-accent focus:border-accent";

  return (
    <aside className="lg:sticky lg:top-40">
      {/* Sur mobile la colonne se replie : cinq listes avant le premier
          résultat feraient croire à un formulaire, pas à un catalogue. */}
      <button
        type="button"
        onClick={() => setOuvert(!ouvert)}
        aria-expanded={ouvert}
        className="mb-4 inline-flex h-11 w-full items-center justify-between rounded-champ border border-bordure bg-fond-eleve px-4 text-[0.9375rem] font-medium lg:hidden"
      >
        <span>
          {t("titre")}
          {nombreActifs > 0 ? (
            <span className="ml-2 rounded-full bg-accent px-2 py-0.5 text-xs text-accent-contraste">
              {nombreActifs}
            </span>
          ) : null}
        </span>
        <span aria-hidden>{ouvert ? "▲" : "▼"}</span>
      </button>

      <div
        className={cn(
          "space-y-5 rounded-carte border border-bordure bg-fond-eleve p-5",
          ouvert ? "block" : "hidden lg:block",
        )}
      >
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-[0.9375rem] font-semibold">{t("titre")}</h2>
          {nombreActifs > 0 ? (
            <button
              type="button"
              onClick={() => routeur.push({ pathname: "/recherche", query: {} })}
              className="text-sm font-medium text-accent underline underline-offset-4"
            >
              {t("effacer")}
            </button>
          ) : null}
        </div>

        <div>
          <label htmlFor={`${identifiant}-categorie`} className="text-sm font-medium">
            {t("categorie")}
          </label>
          <select
            id={`${identifiant}-categorie`}
            value={actifs.categorie}
            onChange={(evenement) => changer("categorie", evenement.target.value)}
            className={listeClasse}
          >
            <option value="">{t("tout")}</option>
            {CATEGORIES.map((entree) => (
              <option key={entree.slug} value={entree.slug}>
                {entree.nom}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor={`${identifiant}-prix`} className="text-sm font-medium">
            {t("prix")}
          </label>
          <select
            id={`${identifiant}-prix`}
            value={actifs.prixMax ? String(actifs.prixMax) : ""}
            onChange={(evenement) => changer("prixMax", evenement.target.value)}
            className={listeClasse}
          >
            <option value="">{t("peuImporte")}</option>
            {paliersPrix.map((palier) => (
              <option key={palier} value={palier}>
                {t("jusqua", { montant: `${palier / 100} ${monnaie}` })}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor={`${identifiant}-charge`} className="text-sm font-medium">
            {t("charge")}
          </label>
          <select
            id={`${identifiant}-charge`}
            value={actifs.chargeMin ? String(actifs.chargeMin) : ""}
            onChange={(evenement) => changer("chargeMin", evenement.target.value)}
            className={listeClasse}
          >
            <option value="">{t("peuImporte")}</option>
            {paliersCharge.map((palier) => (
              <option key={palier} value={palier}>
                {t("apartir", { kg: palier })}
              </option>
            ))}
          </select>
          <p className="mt-2 text-sm text-texte-attenue">{t("chargeAide")}</p>
        </div>

        <div>
          <label htmlFor={`${identifiant}-freinee`} className="text-sm font-medium">
            {t("freinee")}
          </label>
          <select
            id={`${identifiant}-freinee`}
            value={actifs.freinee ? "oui" : ""}
            onChange={(evenement) => changer("freinee", evenement.target.value)}
            className={listeClasse}
          >
            <option value="">{t("peuImporte")}</option>
            <option value="oui">{t("freineeSeulement")}</option>
          </select>
          <p className="mt-2 text-sm text-texte-attenue">{t("freineeAide")}</p>
        </div>

        <div>
          <label
            htmlFor={`${identifiant}-instantanee`}
            className="text-sm font-medium"
          >
            {t("reservationInstantanee")}
          </label>
          <select
            id={`${identifiant}-instantanee`}
            value={actifs.instantanee ? "oui" : ""}
            onChange={(evenement) => changer("instantanee", evenement.target.value)}
            className={listeClasse}
          >
            <option value="">{t("peuImporte")}</option>
            <option value="oui">{t("instantaneeSeulement")}</option>
          </select>
          <p className="mt-2 text-sm text-texte-attenue">{t("instantaneeAide")}</p>
        </div>
      </div>
    </aside>
  );
}

/**
 * Ordre des résultats.
 *
 * En liste déroulante et non en onglets : quatre onglets alignés à droite du
 * titre flottaient dans le vide dès que la colonne de filtres a pris sa place
 * à gauche, et se comparaient mal à ce qu'ils commandaient. Une liste posée
 * contre le nombre de résultats dit ce qu'elle trie.
 */
export function TriResultats({
  parametres,
  valeur,
  tris,
}: {
  parametres: Record<string, string>;
  valeur: string;
  tris: readonly string[];
}) {
  const t = useTranslations("recherche.tri");
  const routeur = useRouter();
  const identifiant = useId();

  return (
    <div className="flex items-center gap-2">
      <label htmlFor={identifiant} className="shrink-0 text-sm text-texte-attenue">
        {t("label")}
      </label>
      <select
        id={identifiant}
        value={valeur}
        onChange={(evenement) => {
          const requete = { ...parametres };
          if (evenement.target.value === "pertinence") delete requete.tri;
          else requete.tri = evenement.target.value;

          routeur.push({ pathname: "/recherche", query: requete });
        }}
        className="h-10 rounded-champ border border-bordure bg-fond-eleve px-3 text-sm font-medium transition-colors hover:border-accent focus:border-accent"
      >
        {tris.map((entree) => (
          <option key={entree} value={entree}>
            {t(entree as never)}
          </option>
        ))}
      </select>
    </div>
  );
}
