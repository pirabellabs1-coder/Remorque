"use client";

import { useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";

import { BoutonsFournisseurs } from "@/components/compte/boutons-fournisseurs";
import { ChoixRole, type Role } from "@/components/compte/choix-role";
import { Bouton } from "@/components/ui/bouton";
import { Champ, Separateur } from "@/components/ui/champ";
import { useRouter } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import { inscrire } from "@/server/authentification/actions";

/** Longueur minimale exigée du mot de passe. */
const LONGUEUR_MINIMALE = 12;

export function FormulaireInscription() {
  const t = useTranslations("compte.inscription");
  const tCommun = useTranslations("compte");
  const identifiant = useId();
  const router = useRouter();

  const [motDePasse, setMotDePasse] = useState("");
  const [role, setRole] = useState<Role | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();

  const assezLong = motDePasse.length >= LONGUEUR_MINIMALE;

  function soumettre(evenement: React.FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    setErreur(null);

    const donnees = new FormData(evenement.currentTarget);

    demarrer(async () => {
      const resultat = await inscrire(donnees);

      if (resultat.ok) {
        // `refresh` avant `push` : la coquille d'espace lit la session côté
        // serveur, et sans rafraîchissement elle servirait la version mise en
        // cache d'un visiteur non connecté.
        router.refresh();
        router.push(resultat.redirection as never);
        return;
      }

      setErreur(
        resultat.cle === "dejaUtilise" ? t("dejaUtilise") : t("echec"),
      );
    });
  }

  return (
    <div className="space-y-8">
      <BoutonsFournisseurs />
      <Separateur libelle={tCommun("ou")} />

      <form onSubmit={soumettre} className="space-y-6">
        {/* Le rôle en premier : il décide de l'espace d'atterrissage, et le
            demander après le mot de passe donnerait l'impression d'une
            question accessoire. */}
        <ChoixRole
          valeur={role}
          surChangement={setRole}
          erreur={erreur === t("role.obligatoire") ? erreur : undefined}
        />

        <Champ
          libelle={t("prenom")}
          name="prenom"
          autoComplete="given-name"
          required
          maxLength={80}
        />

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
          disabled={!assezLong || role === null || enCours}
        >
          {enCours ? t("creation") : t("action")}
        </Bouton>

        <p aria-live="polite" role="status" className="min-h-5 text-sm text-danger">
          {erreur}
        </p>
      </form>
    </div>
  );
}
