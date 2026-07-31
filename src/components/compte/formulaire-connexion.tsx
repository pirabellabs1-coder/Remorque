"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { BoutonsFournisseurs } from "@/components/compte/boutons-fournisseurs";
import { Bouton } from "@/components/ui/bouton";
import { Champ, Separateur } from "@/components/ui/champ";
import { Link } from "@/i18n/navigation";

/**
 * Formulaire de connexion.
 *
 * L'authentification n'est pas encore branchée : elle attend la base et
 * `better-auth`. Plutôt que de simuler une réussite, la soumission affiche un
 * message explicite. Un écran qui fait semblant de fonctionner coûte plus cher
 * à déboguer en recette qu'un écran qui dit ce qu'il en est.
 */
export function FormulaireConnexion() {
  const t = useTranslations("compte.connexion");
  const tCommun = useTranslations("compte");
  const [message, setMessage] = useState<string | null>(null);

  function soumettre(evenement: React.FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    setMessage(tCommun("nonBranche"));
  }

  return (
    <div className="space-y-8">
      <BoutonsFournisseurs />
      <Separateur libelle={tCommun("ou")} />

      <form onSubmit={soumettre} className="space-y-5">
        <Champ
          libelle={t("courriel")}
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          placeholder={t("courrielExemple")}
        />

        <Champ
          libelle={t("motDePasse")}
          name="motDePasse"
          type="password"
          autoComplete="current-password"
          required
          action={
            <Link
              href="/mot-de-passe-oublie"
              className="text-sm text-accent underline-offset-4 hover:underline"
            >
              {t("motDePasseOublie")}
            </Link>
          }
        />

        <Bouton type="submit" taille="grand" pleineLargeur>
          {t("action")}
        </Bouton>

        {/* `aria-live` : sans lui, le message n'existe que pour ceux qui le
            voient. */}
        <p aria-live="polite" className="min-h-5 text-sm text-attention">
          {message}
        </p>
      </form>
    </div>
  );
}
