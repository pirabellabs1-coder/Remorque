"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition, type ReactNode } from "react";

import { Bouton } from "@/components/ui/bouton";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/cn";

/**
 * Formulaire qui enregistre vraiment, et qui le dit.
 *
 * Les cinq écrans de profil et de paramètres affichaient un bouton
 * « Enregistrer » sans action. Le remède ne se limite pas à brancher l'appel :
 * un enregistrement silencieux se recharge et laisse douter qu'il ait eu lieu.
 * Trois états sont donc distingués — au repos, en cours, enregistré — et le
 * troisième s'efface au bout de quelques secondes, parce qu'une confirmation
 * qui reste finit par ne plus rien confirmer.
 *
 * Le bouton reste inerte tant que rien n'a changé. Un bouton toujours actif
 * invite à cliquer pour vérifier qu'il fonctionne, ce qui envoie une écriture
 * inutile à chaque visite.
 */
export function FormulaireEnregistre({
  action,
  children,
  libelle,
  className,
}: {
  action: (donnees: FormData) => Promise<{ ok: true } | { ok: false; cle: string }>;
  children: ReactNode;
  libelle?: string;
  className?: string;
}) {
  const t = useTranslations("espaces.formulaire");
  const router = useRouter();

  const [modifie, setModifie] = useState(false);
  const [enregistre, setEnregistre] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();

  function soumettre(evenement: React.FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    setErreur(null);

    const donnees = new FormData(evenement.currentTarget);

    demarrer(async () => {
      const resultat = await action(donnees);

      if (resultat.ok) {
        setEnregistre(true);
        setModifie(false);
        router.refresh();
        // La confirmation s'efface : laissée en place, elle décrirait bientôt
        // un enregistrement vieux de dix minutes.
        setTimeout(() => setEnregistre(false), 4000);
        return;
      }

      const connues = [
        "invalide",
        "vehiculeInvalide",
        "massesInversees",
        "connexionRequise",
      ];
      setErreur(
        connues.includes(resultat.cle)
          ? t(`erreurs.${resultat.cle}` as never)
          : t("erreurs.echec"),
      );
    });
  }

  return (
    <form
      onSubmit={soumettre}
      onChange={() => {
        setModifie(true);
        setEnregistre(false);
      }}
      className={cn("space-y-8", className)}
    >
      {children}

      <div className="flex flex-wrap items-center gap-4">
        <Bouton type="submit" disabled={!modifie || enCours}>
          {enCours ? t("enregistrement") : (libelle ?? t("enregistrer"))}
        </Bouton>

        <p aria-live="polite" role="status" className="text-sm">
          {erreur ? (
            <span className="text-danger">{erreur}</span>
          ) : enregistre ? (
            <span className="inline-flex items-center gap-1.5 text-succes">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                aria-hidden
                className="size-4"
              >
                <path d="M20 6 9 17l-5-5" />
              </svg>
              {t("enregistre")}
            </span>
          ) : modifie ? (
            <span className="text-texte-attenue">{t("nonEnregistre")}</span>
          ) : null}
        </p>
      </div>
    </form>
  );
}
