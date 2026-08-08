"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { choisirMarche } from "@/server/marches/actions";

/**
 * Proposition de changer de marché, d'après le pays du visiteur.
 *
 * Un bandeau, jamais une redirection : voir `server/marches/suggestion.ts`
 * pour le raisonnement. Il se referme définitivement dans les deux cas —
 * accepter ou refuser sont deux réponses, et l'une comme l'autre méritent
 * d'être retenues.
 */
export function BandeauMarche({
  courant,
  suggere,
  paysSuggere,
  prefixeCourant,
  prefixeSuggere,
}: {
  courant: string;
  suggere: string;
  paysSuggere: string;
  /** Préfixe d'adresse de chaque marché ; chaîne vide pour celui de la racine. */
  prefixeCourant: string;
  prefixeSuggere: string;
}) {
  const t = useTranslations("commun.marche");
  const [visible, setVisible] = useState(true);
  const [enCours, demarrer] = useTransition();

  if (!visible) return null;

  /**
   * La même page, dans l'autre marché : on ne renvoie pas à l'accueil
   * quelqu'un qui lisait une fiche.
   *
   * L'échange de préfixe suffit tant que les deux marchés partagent leurs
   * adresses. Le jour où elles seront traduites — « /nl/zoeken » pour
   * « /recherche » — il faudra passer par la table des chemins localisés
   * plutôt que par cette substitution.
   */
  function adresseEquivalente(): string {
    const chemin = window.location.pathname;
    const sansPrefixe = prefixeCourant
      ? chemin.slice(prefixeCourant.length) || "/"
      : chemin;

    return `${prefixeSuggere}${sansPrefixe}${window.location.search}`;
  }

  function accepter() {
    demarrer(async () => {
      await choisirMarche(suggere);
      window.location.assign(adresseEquivalente());
    });
  }

  function refuser() {
    demarrer(async () => {
      // On retient le marché courant : c'est bien un choix, pas un report.
      await choisirMarche(courant);
      setVisible(false);
    });
  }

  return (
    <div
      role="region"
      aria-label={t("titre")}
      className="border-b border-bordure bg-fond-doux"
    >
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
        <p className="flex-1 text-[0.9375rem]">
          {t("proposition", { pays: paysSuggere })}
        </p>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={accepter}
            disabled={enCours}
            className="rounded-champ bg-accent px-4 py-2 text-sm font-medium text-accent-contraste transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {t("aller", { pays: paysSuggere })}
          </button>
          <button
            type="button"
            onClick={refuser}
            disabled={enCours}
            className="rounded-champ border border-bordure px-4 py-2 text-sm font-medium transition-colors hover:border-accent disabled:opacity-60"
          >
            {t("rester")}
          </button>
        </div>
      </div>
    </div>
  );
}
