"use client";

import { useTranslations } from "next-intl";
import { useId, useState } from "react";

import { CATEGORIES } from "@/config/categories";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/cn";

/**
 * Filtres de recherche, en barre horizontale.
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
 * **En ligne plutôt qu'en colonne.** Une colonne à gauche mangeait un sixième
 * de la largeur en permanence, pour cinq listes qu'on règle une fois et qu'on
 * ne relit plus. En barre, les critères se comparent d'un regard et la place
 * revient aux résultats et à la carte — ce qu'on est venu voir.
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

  return (
    <div className="rounded-carte border border-bordure bg-fond-eleve">
      {/* Sur mobile la barre se replie : cinq listes empilées avant le premier
          résultat feraient croire à un formulaire, pas à un catalogue. */}
      <button
        type="button"
        onClick={() => setOuvert(!ouvert)}
        aria-expanded={ouvert}
        className="flex h-12 w-full items-center justify-between px-4 text-[0.9375rem] font-medium lg:hidden"
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

      {/* En ligne sur ordinateur : les critères se comparent d'un regard, et
          la largeur libérée sur les côtés revient aux résultats et à la
          carte — ce sont eux qu'on est venu voir. */}
      <div
        className={cn(
          "gap-x-4 gap-y-4 border-bordure p-4 lg:flex lg:flex-wrap lg:items-end",
          ouvert ? "grid border-t lg:border-t-0" : "hidden lg:flex",
        )}
      >
        <Liste
          identifiant={`${identifiant}-categorie`}
          libelle={t("categorie")}
          valeur={actifs.categorie}
          surChangement={(valeur) => changer("categorie", valeur)}
          className="lg:w-52"
        >
          <option value="">{t("tout")}</option>
          {CATEGORIES.map((entree) => (
            <option key={entree.slug} value={entree.slug}>
              {entree.nom}
            </option>
          ))}
        </Liste>

        <Liste
          identifiant={`${identifiant}-prix`}
          libelle={t("prix")}
          valeur={actifs.prixMax ? String(actifs.prixMax) : ""}
          surChangement={(valeur) => changer("prixMax", valeur)}
          className="lg:w-44"
        >
          <option value="">{t("peuImporte")}</option>
          {paliersPrix.map((palier) => (
            <option key={palier} value={palier}>
              {t("jusqua", { montant: `${palier / 100} ${monnaie}` })}
            </option>
          ))}
        </Liste>

        <Liste
          identifiant={`${identifiant}-charge`}
          libelle={t("charge")}
          valeur={actifs.chargeMin ? String(actifs.chargeMin) : ""}
          surChangement={(valeur) => changer("chargeMin", valeur)}
          className="lg:w-44"
        >
          <option value="">{t("peuImporte")}</option>
          {paliersCharge.map((palier) => (
            <option key={palier} value={palier}>
              {t("apartir", { kg: palier })}
            </option>
          ))}
        </Liste>

        <Liste
          identifiant={`${identifiant}-freinee`}
          libelle={t("freinee")}
          valeur={actifs.freinee ? "oui" : ""}
          surChangement={(valeur) => changer("freinee", valeur)}
          className="lg:w-44"
        >
          <option value="">{t("peuImporte")}</option>
          <option value="oui">{t("freineeSeulement")}</option>
        </Liste>

        <Liste
          identifiant={`${identifiant}-instantanee`}
          libelle={t("reservationInstantanee")}
          valeur={actifs.instantanee ? "oui" : ""}
          surChangement={(valeur) => changer("instantanee", valeur)}
          className="lg:w-48"
        >
          <option value="">{t("peuImporte")}</option>
          <option value="oui">{t("instantaneeSeulement")}</option>
        </Liste>

        {nombreActifs > 0 ? (
          <button
            type="button"
            onClick={() => routeur.push({ pathname: "/recherche", query: {} })}
            className="h-11 shrink-0 text-sm font-medium text-accent underline underline-offset-4 lg:mb-0"
          >
            {t("effacer")}
          </button>
        ) : null}
      </div>
    </div>
  );
}

/** Une liste de la barre, libellé compris. */
function Liste({
  identifiant,
  libelle,
  valeur,
  surChangement,
  className,
  children,
}: {
  identifiant: string;
  libelle: string;
  valeur: string;
  surChangement: (valeur: string) => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <label
        htmlFor={identifiant}
        className="block text-xs font-medium text-texte-attenue"
      >
        {libelle}
      </label>
      <select
        id={identifiant}
        value={valeur}
        onChange={(evenement) => surChangement(evenement.target.value)}
        className="mt-1 h-11 w-full rounded-champ border border-bordure bg-fond-eleve px-3 text-[0.9375rem] transition-colors hover:border-accent focus:border-accent"
      >
        {children}
      </select>
    </div>
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
