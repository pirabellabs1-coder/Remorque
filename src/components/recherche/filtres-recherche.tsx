"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { CATEGORIES } from "@/config/categories";
import { Link, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/cn";

/**
 * Filtres de recherche, en colonne.
 *
 * Une seule liste déroulante existait — la catégorie — alors que les libellés
 * du prix, du PTAC, du freinage et de la réservation instantanée étaient
 * traduits depuis le début, sans interface derrière. D'où l'impression, juste,
 * que « les filtres ne fonctionnent pas » : il n'y en avait qu'un.
 *
 * **Des paliers plutôt que des curseurs.** Un curseur à deux poignées se
 * manipule mal au doigt, et personne ne cherche « entre 37 et 62 € » : on
 * cherche « pas plus de 50 ». Un palier se choisit d'un geste et se lit d'un
 * regard.
 *
 * **La charge utile plutôt que le PTAC.** C'est la question réelle du
 * locataire — « puis-je y mettre une tonne ? » — là où le PTAC comprend le
 * poids de la remorque elle-même et trompe son monde.
 *
 * Chaque filtre est un lien : l'état vit dans l'adresse, se partage, se met en
 * favori et revient intact par le bouton « précédent ». Sur mobile, la colonne
 * se replie derrière un bouton — elle occuperait sinon tout le premier écran,
 * avant le moindre résultat.
 */
export function FiltresRecherche({
  parametres,
  actifs,
  paliersPrix,
  paliersCharge,
  monnaie,
  nombreFiltresActifs,
}: {
  /** Critères courants, hors ceux que chaque lien modifie. */
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
  /** Symbole ou code de la devise du marché. */
  monnaie: string;
  nombreFiltresActifs: number;
}) {
  const t = useTranslations("recherche.filtres");
  const routeur = useRouter();
  const [ouvert, setOuvert] = useState(false);

  /** Reconstruit l'adresse en changeant une seule clé. */
  const avec = (cle: string, valeur?: string) => {
    const requete = { ...parametres };
    if (valeur === undefined) delete requete[cle];
    else requete[cle] = valeur;
    return { pathname: "/recherche" as const, query: requete };
  };

  const pastille = (actif: boolean) =>
    cn(
      "inline-flex items-center rounded-full border px-3 py-1.5 text-sm transition-colors",
      actif
        ? "border-accent bg-accent text-accent-contraste"
        : "border-bordure hover:border-accent",
    );

  return (
    <aside className="lg:sticky lg:top-40">
      {/* Sur mobile, la colonne se replie : douze filtres avant le premier
          résultat feraient croire à un formulaire, pas à un catalogue. */}
      <button
        type="button"
        onClick={() => setOuvert(!ouvert)}
        aria-expanded={ouvert}
        className="mb-4 inline-flex h-11 w-full items-center justify-between rounded-champ border border-bordure bg-fond-eleve px-4 text-[0.9375rem] font-medium lg:hidden"
      >
        <span>
          {t("titre")}
          {nombreFiltresActifs > 0 ? (
            <span className="ml-2 rounded-full bg-accent px-2 py-0.5 text-xs text-accent-contraste">
              {nombreFiltresActifs}
            </span>
          ) : null}
        </span>
        <span aria-hidden>{ouvert ? "▲" : "▼"}</span>
      </button>

      <div
        className={cn(
          "space-y-7 rounded-carte border border-bordure bg-fond-eleve p-5",
          ouvert ? "block" : "hidden lg:block",
        )}
      >
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-[0.9375rem] font-semibold">{t("titre")}</h2>
          {nombreFiltresActifs > 0 ? (
            <button
              type="button"
              onClick={() => routeur.push({ pathname: "/recherche", query: {} })}
              className="text-sm font-medium text-accent underline underline-offset-4"
            >
              {t("effacer")}
            </button>
          ) : null}
        </div>

        {/* ---------- Catégorie ---------- */}
        <div>
          <p className="text-[0.6875rem] font-semibold tracking-[0.14em] text-texte-attenue uppercase">
            {t("categorie")}
          </p>
          <ul className="mt-3 flex flex-wrap gap-2">
            <li>
              <Link
                href={avec("categorie")}
                className={pastille(!actifs.categorie)}
              >
                {t("tout")}
              </Link>
            </li>
            {CATEGORIES.map((entree) => (
              <li key={entree.slug}>
                <Link
                  href={avec("categorie", entree.slug)}
                  className={pastille(actifs.categorie === entree.slug)}
                >
                  {entree.nom}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* ---------- Prix ---------- */}
        <div>
          <p className="text-[0.6875rem] font-semibold tracking-[0.14em] text-texte-attenue uppercase">
            {t("prix")}
          </p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {paliersPrix.map((palier) => (
              <li key={palier}>
                <Link
                  href={
                    actifs.prixMax === palier
                      ? avec("prixMax")
                      : avec("prixMax", String(palier))
                  }
                  className={pastille(actifs.prixMax === palier)}
                >
                  {t("jusqua", { montant: `${palier / 100} ${monnaie}` })}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* ---------- Charge utile ---------- */}
        <div>
          <p className="text-[0.6875rem] font-semibold tracking-[0.14em] text-texte-attenue uppercase">
            {t("charge")}
          </p>
          <p className="mt-1 text-sm text-texte-attenue">{t("chargeAide")}</p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {paliersCharge.map((palier) => (
              <li key={palier}>
                <Link
                  href={
                    actifs.chargeMin === palier
                      ? avec("chargeMin")
                      : avec("chargeMin", String(palier))
                  }
                  className={pastille(actifs.chargeMin === palier)}
                >
                  {t("apartir", { kg: palier })}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* ---------- Interrupteurs ---------- */}
        <div className="space-y-3 border-t border-bordure pt-5">
          <Link
            href={actifs.freinee ? avec("freinee") : avec("freinee", "oui")}
            className="flex items-start gap-3 text-[0.9375rem]"
          >
            <span
              aria-hidden
              className={cn(
                "mt-0.5 grid size-5 shrink-0 place-items-center rounded border text-xs",
                actifs.freinee
                  ? "border-accent bg-accent text-accent-contraste"
                  : "border-bordure",
              )}
            >
              {actifs.freinee ? "✓" : ""}
            </span>
            <span>
              {t("freinee")}
              <span className="mt-0.5 block text-sm text-texte-attenue">
                {t("freineeAide")}
              </span>
            </span>
          </Link>

          <Link
            href={
              actifs.instantanee ? avec("instantanee") : avec("instantanee", "oui")
            }
            className="flex items-start gap-3 text-[0.9375rem]"
          >
            <span
              aria-hidden
              className={cn(
                "mt-0.5 grid size-5 shrink-0 place-items-center rounded border text-xs",
                actifs.instantanee
                  ? "border-accent bg-accent text-accent-contraste"
                  : "border-bordure",
              )}
            >
              {actifs.instantanee ? "✓" : ""}
            </span>
            <span>
              {t("reservationInstantanee")}
              <span className="mt-0.5 block text-sm text-texte-attenue">
                {t("instantaneeAide")}
              </span>
            </span>
          </Link>
        </div>
      </div>
    </aside>
  );
}
