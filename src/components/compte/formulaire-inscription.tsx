"use client";

import { useTranslations } from "next-intl";
import { useId, useState } from "react";

import { BoutonsFournisseurs } from "@/components/compte/boutons-fournisseurs";
import { Bouton } from "@/components/ui/bouton";
import { Champ, Separateur } from "@/components/ui/champ";
import { Link } from "@/i18n/navigation";

/** Longueur minimale exigée du mot de passe. */
const LONGUEUR_MINIMALE = 12;

export function FormulaireInscription() {
  const t = useTranslations("compte.inscription");
  const tCommun = useTranslations("compte");
  const identifiant = useId();

  const [motDePasse, setMotDePasse] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const assezLong = motDePasse.length >= LONGUEUR_MINIMALE;

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
          autoComplete="new-password"
          required
          minLength={LONGUEUR_MINIMALE}
          value={motDePasse}
          onChange={(evenement) => setMotDePasse(evenement.target.value)}
          aide={t("motDePasseAide", { longueur: LONGUEUR_MINIMALE })}
        />

        {/*
          Registre des consentements (M21) : l'acceptation doit être un acte
          explicite et horodaté. Une case pré-cochée, ou un simple « en
          continuant vous acceptez », ne constitue pas une preuve opposable.
        */}
        <div className="flex items-start gap-3">
          <input
            id={`${identifiant}-conditions`}
            name="conditions"
            type="checkbox"
            required
            className="mt-1 size-4 shrink-0 accent-[var(--accent)]"
          />
          <label
            htmlFor={`${identifiant}-conditions`}
            className="text-sm leading-[1.55] text-texte-attenue"
          >
            {t.rich("conditions", {
              cgu: (contenu) => (
                <Link href="/cgu" className="text-accent underline underline-offset-4">
                  {contenu}
                </Link>
              ),
              confidentialite: (contenu) => (
                <Link
                  href="/confidentialite"
                  className="text-accent underline underline-offset-4"
                >
                  {contenu}
                </Link>
              ),
            })}
          </label>
        </div>

        <Bouton
          type="submit"
          taille="grand"
          pleineLargeur
          disabled={!assezLong}
        >
          {t("action")}
        </Bouton>

        <p aria-live="polite" className="min-h-5 text-sm text-attention">
          {message}
        </p>
      </form>
    </div>
  );
}
