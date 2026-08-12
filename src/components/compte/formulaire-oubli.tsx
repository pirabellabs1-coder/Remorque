"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { Bouton } from "@/components/ui/bouton";
import { Champ } from "@/components/ui/champ";
import { Link } from "@/i18n/navigation";
import { demanderLien } from "@/server/authentification/reinitialisation-actions";

/**
 * Demande d'un lien de réinitialisation.
 *
 * **La confirmation ne dit pas si le compte existe.** « Si un compte est
 * associé à cette adresse, un courriel part » — la même phrase dans les deux
 * cas. Un formulaire qui répondrait « compte introuvable » serait un annuaire
 * d'adresses valides, et c'est précisément ce que cherche qui prépare une
 * campagne d'hameçonnage.
 *
 * Le formulaire disparaît une fois la demande faite, remplacé par la
 * confirmation. Le laisser en place invite à recliquer, ce qui produit un
 * second courriel et invalide le premier — donc un lien mort dans la boîte de
 * réception.
 */
export function FormulaireOubli() {
  const t = useTranslations("compte.oubli");
  const [envoye, setEnvoye] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();

  function soumettre(evenement: React.FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    setMessage(null);

    const donnees = new FormData(evenement.currentTarget);

    demarrer(async () => {
      const resultat = await demanderLien(donnees);

      if (resultat.ok) {
        setEnvoye(true);
        return;
      }

      setMessage(
        t("tropDeTentatives", {
          minutes: Math.max(1, Math.ceil((resultat.secondes ?? 60) / 60)),
        }),
      );
    });
  }

  if (envoye) {
    return (
      <div className="space-y-5">
        <div className="rounded-carte border border-succes/30 bg-succes/5 p-5">
          <p className="text-[0.9375rem] font-medium">{t("envoyeTitre")}</p>
          <p className="mt-2 text-sm text-texte-attenue">{t("envoyeTexte")}</p>
        </div>
        <p className="text-sm text-texte-attenue">{t("delai")}</p>
        <Bouton as={Link} href="/connexion" variante="secondaire">
          {t("retour")}
        </Bouton>
      </div>
    );
  }

  return (
    <form onSubmit={soumettre} className="space-y-5">
      <Champ
        libelle={t("courriel")}
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        required
        placeholder="vous@exemple.fr"
      />

      {message ? (
        <p className="text-sm text-danger" role="alert">
          {message}
        </p>
      ) : null}

      <Bouton type="submit" disabled={enCours} className="w-full">
        {enCours ? t("envoi") : t("envoyer")}
      </Bouton>
    </form>
  );
}
