"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { BoutonsFournisseurs } from "@/components/compte/boutons-fournisseurs";
import { Bouton } from "@/components/ui/bouton";
import { Champ, Separateur } from "@/components/ui/champ";
import { Link, useRouter } from "@/i18n/navigation";
import { connecter } from "@/server/authentification/actions";

/**
 * Formulaire de connexion.
 *
 * Un seul message d'erreur, quelle que soit la cause. Distinguer « adresse
 * inconnue » de « mot de passe faux » permettrait d'énumérer les comptes de la
 * plateforme — exactement ce que cherche une attaque par bourrage
 * d'identifiants.
 */
export function FormulaireConnexion() {
  const t = useTranslations("compte.connexion");
  const tCommun = useTranslations("compte");
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();

  function soumettre(evenement: React.FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    setMessage(null);

    const donnees = new FormData(evenement.currentTarget);

    demarrer(async () => {
      const resultat = await connecter(donnees);

      if (resultat.ok) {
        // `refresh` avant `push` : la coquille d'espace lit la session côté
        // serveur, et sans rafraîchissement elle servirait la version mise en
        // cache d'un visiteur non connecté.
        router.refresh();
        router.push(resultat.redirection as never);
        return;
      }

      // Le blocage se dit en minutes : « réessayez dans 847 secondes » oblige
      // à faire une division pour savoir s'il faut attendre ou aller boire un
      // café.
      setMessage(
        resultat.cle === "tropDeTentatives"
          ? t("tropDeTentatives", {
              minutes: Math.max(1, Math.ceil((resultat.secondes ?? 60) / 60)),
            })
          : t("echec"),
      );
    });
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

        <Bouton type="submit" taille="grand" pleineLargeur disabled={enCours}>
          {enCours ? t("connexion") : t("action")}
        </Bouton>

        {/* `aria-live` : sans lui, le message n'existe que pour ceux qui le
            voient. */}
        <p aria-live="polite" className="min-h-5 text-sm text-danger">
          {message}
        </p>
      </form>
    </div>
  );
}
