import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

import { Logo } from "@/components/navigation/logo";
import { Illustration } from "@/components/ui/illustration";
import { TITRE } from "@/components/ui/typographie";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";

/**
 * Mise en page commune aux écrans de connexion et d'inscription.
 *
 * Deux colonnes sur grand écran : le formulaire à gauche, une colonne de
 * réassurance à droite. Cette seconde colonne n'est pas décorative — c'est là
 * qu'on répond à la question que se pose l'utilisateur au moment précis où on
 * lui demande ses données : « qu'est-ce que je risque ? ». Elle disparaît sur
 * mobile, où l'espace doit aller au formulaire.
 */
export async function CoquilleAuthentification({
  titre,
  sousTitre,
  children,
  bas,
  illustration,
  illustrationAlt,
}: {
  titre: string;
  sousTitre: ReactNode;
  children: ReactNode;
  bas: ReactNode;
  illustration: string;
  illustrationAlt: string;
}) {
  const t = await getTranslations("compte");

  const arguments_ = ["assurance", "caution", "gratuit"] as const;

  return (
    <div className="flex min-h-dvh flex-col lg:grid lg:grid-cols-2">
      {/* --- Formulaire --- */}
      <div className="flex flex-1 flex-col px-5 py-8 sm:px-8 lg:px-12 xl:px-20">
        <Link href="/" className="inline-flex self-start">
          <Logo />
        </Link>

        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-12">
          <h1 className={cn(TITRE.section, "text-balance")}>{titre}</h1>
          <p className="mt-4 text-[1.0625rem] text-texte-attenue">{sousTitre}</p>

          <div className="mt-10">{children}</div>

          <p className="mt-8 text-[0.9375rem] text-texte-attenue">{bas}</p>
        </div>

        <p className="mx-auto w-full max-w-md text-xs text-texte-attenue">
          {t("mentionLegale")}
        </p>
      </div>

      {/* --- Réassurance --- */}
      {/* L'illustration passe à gauche : elle suivait le formulaire dans
          l'ordre du document, donc se posait à droite de la grille. Les deux
          écrans d'authentification se ressemblent désormais, et l'œil retrouve
          le formulaire au même endroit en passant de l'un à l'autre. */}
      <aside className="relative hidden overflow-hidden bg-encre text-encre-texte lg:order-first lg:block">
        <div className="absolute inset-0">
          <Illustration
            src={illustration}
            alt={illustrationAlt}
            className="h-full w-full"
            tailles="50vw"
          />
        </div>
        <div aria-hidden className="absolute inset-0 bg-marque-950/70" />
        <div
          aria-hidden
          className="absolute inset-0 bg-linear-to-t from-marque-950 via-marque-950/50 to-transparent"
        />

        <div className="relative flex h-full flex-col justify-end p-12 xl:p-16">
          <p className="text-[0.6875rem] font-semibold tracking-[0.14em] text-encre-texte-attenue uppercase">
            {t("reassurance.surtitre")}
          </p>
          <p className="mt-4 max-w-md text-[1.75rem] leading-[1.15] font-bold tracking-[-0.025em] text-balance">
            {t("reassurance.titre")}
          </p>

          <ul className="mt-10 space-y-5">
            {arguments_.map((cle) => (
              <li key={cle} className="flex items-start gap-3">
                <svg
                  viewBox="0 0 20 20"
                  aria-hidden
                  className="mt-0.5 size-5 shrink-0"
                  fill="none"
                >
                  <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
                  <path
                    d="m6 10.5 2.5 2.5L14 7.5"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span className="text-[0.9375rem] text-encre-texte-attenue">
                  {t(`reassurance.${cle}`)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}
