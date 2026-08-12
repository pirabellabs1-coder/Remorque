"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { Bouton } from "@/components/ui/bouton";
import { Champ } from "@/components/ui/champ";
import { LONGUEUR_MINIMALE } from "@/domain/compte/reinitialisation";
import { useRouter } from "@/i18n/navigation";
import { definirNouveauMotDePasse } from "@/server/authentification/reinitialisation-actions";

/**
 * Choix du nouveau mot de passe.
 *
 * **Un seul champ, pas deux.** La confirmation par ressaisie protège d'une
 * faute de frappe ; l'affichage en clair aussi, et sans faire taper deux fois
 * une longue phrase sur un téléphone. Le bouton « afficher » est ici la
 * meilleure des deux protections — on relit ce qu'on a écrit.
 *
 * Le jeton voyage dans un champ caché plutôt que d'être relu depuis l'adresse
 * au moment de l'envoi : l'adresse peut avoir changé entre-temps, et un jeton
 * lu deux fois à deux endroits est un jeton qu'on finit par lire mal.
 *
 * La redirection mène à la connexion, pas à l'espace. Le mot de passe vient
 * d'être changé et toutes les sessions ont été fermées — y compris celle
 * d'ici, s'il y en avait une. Se retrouver devant l'écran de connexion est la
 * suite logique, et elle prouve que le nouveau mot de passe fonctionne.
 */
export function FormulaireNouveauMotDePasse({ jeton }: { jeton: string }) {
  const t = useTranslations("compte.nouveauMotDePasse");
  const routeur = useRouter();

  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();

  function soumettre(evenement: React.FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    setMessage(null);

    const donnees = new FormData(evenement.currentTarget);

    demarrer(async () => {
      const resultat = await definirNouveauMotDePasse(donnees);

      if (resultat.ok) {
        routeur.refresh();
        routeur.push({ pathname: "/connexion", query: { change: "oui" } });
        return;
      }

      setMessage(t(`erreur.${resultat.cle}`));
    });
  }

  return (
    <form onSubmit={soumettre} className="space-y-5">
      <input type="hidden" name="jeton" value={jeton} />

      <Champ
        libelle={t("motDePasse")}
        name="motDePasse"
        type={visible ? "text" : "password"}
        autoComplete="new-password"
        required
        minLength={LONGUEUR_MINIMALE}
        aide={t("consigne", { minimum: LONGUEUR_MINIMALE })}
      />

      <button
        type="button"
        onClick={() => setVisible(!visible)}
        className="text-sm font-medium text-accent underline underline-offset-4"
      >
        {visible ? t("masquer") : t("afficher")}
      </button>

      {message ? (
        <p className="text-sm text-danger" role="alert">
          {message}
        </p>
      ) : null}

      <Bouton type="submit" disabled={enCours} className="w-full">
        {enCours ? t("enregistrement") : t("enregistrer")}
      </Bouton>
    </form>
  );
}
