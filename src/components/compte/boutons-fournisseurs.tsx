"use client";

import { useTranslations } from "next-intl";

/**
 * Connexion par fournisseur tiers (M01).
 *
 * « Réduit fortement l'abandon à l'inscription, surtout sur mobile » — d'où sa
 * place au-dessus du formulaire par courriel, et non en dessous.
 *
 * Les boutons sont désactivés tant que l'authentification n'est pas branchée :
 * un bouton qui ne fait rien au clic est pire qu'un bouton visiblement
 * indisponible, parce qu'il laisse croire à une panne.
 */
export function BoutonsFournisseurs({ actif = false }: { actif?: boolean }) {
  const t = useTranslations("compte.fournisseurs");

  const fournisseurs = [
    {
      cle: "google",
      libelle: t("google"),
      icone: (
        <svg viewBox="0 0 18 18" aria-hidden className="size-5">
          <path
            fill="#4285F4"
            d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.91c1.7-1.57 2.69-3.88 2.69-6.62Z"
          />
          <path
            fill="#34A853"
            d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.91-2.26c-.81.54-1.84.86-3.05.86-2.34 0-4.33-1.58-5.04-3.71H.96v2.33A9 9 0 0 0 9 18Z"
          />
          <path
            fill="#FBBC05"
            d="M3.96 10.71a5.41 5.41 0 0 1 0-3.42V4.96H.96a9 9 0 0 0 0 8.08l3-2.33Z"
          />
          <path
            fill="#EA4335"
            d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.96l3 2.33C4.67 5.16 6.66 3.58 9 3.58Z"
          />
        </svg>
      ),
    },
    {
      cle: "apple",
      libelle: t("apple"),
      icone: (
        <svg viewBox="0 0 16 20" aria-hidden className="size-5" fill="currentColor">
          <path d="M13.29 10.63a4.05 4.05 0 0 1 1.94-3.4 4.16 4.16 0 0 0-3.28-1.77c-1.38-.14-2.72.82-3.42.82-.71 0-1.79-.8-2.95-.78A4.36 4.36 0 0 0 1.9 7.74c-1.58 2.73-.4 6.77 1.13 8.99.75 1.09 1.63 2.3 2.8 2.26 1.13-.05 1.55-.73 2.91-.73 1.35 0 1.75.73 2.94.7 1.22-.02 1.98-1.1 2.72-2.19a9.02 9.02 0 0 0 1.24-2.53 3.92 3.92 0 0 1-2.35-3.61ZM11.06 3.9A3.99 3.99 0 0 0 11.97 1a4.06 4.06 0 0 0-2.66 1.38 3.8 3.8 0 0 0-.94 2.8 3.36 3.36 0 0 0 2.69-1.28Z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {fournisseurs.map((fournisseur) => (
        <button
          key={fournisseur.cle}
          type="button"
          disabled={!actif}
          className="inline-flex h-12 items-center justify-center gap-3 rounded-champ border border-bordure bg-fond-eleve px-4 text-[0.9375rem] font-medium transition-colors hover:bg-fond disabled:cursor-not-allowed disabled:opacity-50"
        >
          {fournisseur.icone}
          {fournisseur.libelle}
        </button>
      ))}
    </div>
  );
}
