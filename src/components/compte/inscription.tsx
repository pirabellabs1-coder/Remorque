"use client";

import { useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";

import { BoutonsFournisseurs } from "@/components/compte/boutons-fournisseurs";
import { ChoixRole } from "@/components/compte/choix-role";
import { PanneauRole } from "@/components/compte/panneau-role";
import { Logo } from "@/components/navigation/logo";
import { Bouton } from "@/components/ui/bouton";
import { Champ, Separateur } from "@/components/ui/champ";
import { TITRE } from "@/components/ui/typographie";
import type { Role } from "@/domain/compte/roles";
import { Link, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { inscrire } from "@/server/authentification/actions";

/** Longueur minimale exigée du mot de passe. */
const LONGUEUR_MINIMALE = 12;

/**
 * Écran d'inscription complet, formulaire et panneau réunis.
 *
 * Les deux colonnes sont ici plutôt que dans la coquille commune, parce
 * qu'elles partagent un état : le rôle choisi. Le panneau de droite change de
 * contenu — et de côté — selon ce que la personne vient faire, ce qui suppose
 * que la sélection remonte au-dessus des deux. Passer cet état par une coquille
 * serveur aurait exigé un aller-retour réseau à chaque clic sur une carte.
 *
 * La connexion, elle, garde la coquille serveur : elle n'a aucun état à
 * partager, et la rendre cliente pour rien coûterait du JavaScript inutile.
 */
export function Inscription() {
  const t = useTranslations("compte.inscription");
  const tCommun = useTranslations("compte");
  const identifiant = useId();
  const router = useRouter();

  const [role, setRole] = useState<Role | null>(null);
  const [motDePasse, setMotDePasse] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();

  const assezLong = motDePasse.length >= LONGUEUR_MINIMALE;
  const confirmationSaisie = confirmation.length > 0;
  const identiques = motDePasse === confirmation;

  // L'écart n'est signalé qu'une fois la confirmation entamée : prévenir dès
  // le premier caractère reviendrait à afficher une erreur pendant toute la
  // saisie, ce qui apprend à ne plus la lire.
  const erreurConfirmation =
    confirmationSaisie && !identiques ? t("motDePasseDifferent") : undefined;

  const complet = assezLong && identiques && confirmationSaisie && role !== null;

  function soumettre(evenement: React.FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    setErreur(null);

    const donnees = new FormData(evenement.currentTarget);

    demarrer(async () => {
      const resultat = await inscrire(donnees);

      if (resultat.ok) {
        // `refresh` avant `push` : les gardes des espaces lisent la session
        // côté serveur, et sans rafraîchissement le routeur servirait la
        // version mise en cache d'un visiteur non connecté — qui se ferait
        // aussitôt rediriger vers la connexion.
        router.refresh();
        router.push(resultat.redirection as never);
        return;
      }

      setErreur(resultat.cle === "dejaUtilise" ? t("dejaUtilise") : t("echec"));
    });
  }

  return (
    <div className="flex min-h-dvh flex-col lg:grid lg:grid-cols-2">
      <div className="flex flex-1 flex-col px-5 py-8 sm:px-8 lg:px-12 xl:px-20">
        <Link href="/" className="inline-flex self-start">
          <Logo />
        </Link>

        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-12">
          <h1 className={cn(TITRE.section, "text-balance")}>{t("titre")}</h1>
          <p className="mt-4 text-[1.0625rem] text-texte-attenue">
            {t("sousTitre")}
          </p>

          <div className="mt-10 space-y-8">
            <BoutonsFournisseurs />
            <Separateur libelle={tCommun("ou")} />

            <form onSubmit={soumettre} className="space-y-6">
              {/* Le rôle en premier : il décide de l'espace d'atterrissage.
                  Le demander après le mot de passe en ferait une question
                  accessoire, alors que c'est la principale. */}
              <ChoixRole valeur={role} surChangement={setRole} />

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

              {/* Double saisie : une faute de frappe dans un champ masqué ne se
                  voit pas, et produirait un compte dont le mot de passe n'est
                  connu de personne — y compris de celui qui vient de le
                  choisir. */}
              <Champ
                libelle={t("motDePasseConfirmation")}
                name="motDePasseConfirmation"
                type="password"
                autoComplete="new-password"
                required
                value={confirmation}
                onChange={(evenement) => setConfirmation(evenement.target.value)}
                erreur={erreurConfirmation}
                aide={
                  confirmationSaisie && identiques && assezLong
                    ? t("motDePasseIdentique")
                    : undefined
                }
              />

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
                      <Link
                        href="/cgu"
                        className="text-accent underline underline-offset-4"
                      >
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
                disabled={!complet || enCours}
              >
                {enCours ? t("creation") : t("action")}
              </Bouton>

              <p
                aria-live="polite"
                role="status"
                className="min-h-5 text-sm text-danger"
              >
                {erreur}
              </p>
            </form>
          </div>

          <p className="mt-8 text-[0.9375rem] text-texte-attenue">
            {t.rich("dejaInscrit", {
              lien: (contenu) => (
                <Link
                  href="/connexion"
                  className="font-medium text-accent underline underline-offset-4"
                >
                  {contenu}
                </Link>
              ),
            })}
          </p>
        </div>

        <p className="mx-auto w-full max-w-md text-xs text-texte-attenue">
          {tCommun("mentionLegale")}
        </p>
      </div>

      <PanneauRole role={role} />
    </div>
  );
}
