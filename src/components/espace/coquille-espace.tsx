"use client";

import { useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";

import type { EntreeEspace } from "@/components/espace/navigation-espace";
import { Logo } from "@/components/navigation/logo";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/cn";

/**
 * Coquille commune aux trois espaces authentifiés.
 *
 * Une barre latérale fixe sur grand écran, un tiroir sur mobile. Le choix
 * n'est pas cosmétique : ces espaces servent à faire, pas à découvrir. On y
 * revient plusieurs fois par session et l'on doit pouvoir sauter d'une section
 * à l'autre sans repasser par un menu qui se déplie.
 *
 * L'espace public a l'en-tête horizontal et son méga-menu, parce qu'il vend.
 * Ici on travaille.
 */
export function CoquilleEspace({
  espace,
  navigation,
  children,
}: {
  /** Clé de traduction du nom de l'espace, dans `espaces`. */
  espace: "locataire" | "loueur" | "admin";
  navigation: readonly EntreeEspace[];
  children: ReactNode;
}) {
  const t = useTranslations("espaces");
  const chemin = usePathname();
  const [tiroir, setTiroir] = useState(false);

  const lien = (entree: EntreeEspace) => {
    // Correspondance exacte pour la racine de l'espace, préfixe pour le reste :
    // sans cela, « Tableau de bord » resterait actif sur toutes les pages.
    const racine = entree.href === navigation[0]?.href;
    const actif = racine
      ? chemin === entree.href
      : chemin.startsWith(entree.href);

    return (
      <li key={entree.cle}>
        <Link
          href={entree.href}
          aria-current={actif ? "page" : undefined}
          onClick={() => setTiroir(false)}
          className={cn(
            "block rounded-champ px-3 py-2.5 text-[0.9375rem] transition-colors",
            actif
              ? "bg-fond-doux font-medium text-accent"
              : "text-texte-attenue hover:bg-fond-doux hover:text-texte",
          )}
        >
          {t(`${espace}.nav.${entree.cle}`)}
        </Link>
      </li>
    );
  };

  return (
    <div className="min-h-dvh bg-fond">
      {/* --- Barre supérieure --- */}
      <header className="sticky top-0 z-40 border-b border-bordure bg-fond-eleve">
        <div className="flex h-16 items-center gap-4 px-4 sm:px-6">
          <Link href="/" className="shrink-0">
            <Logo />
          </Link>

          <span
            aria-hidden
            className="hidden h-5 w-px bg-bordure lg:block"
          />
          <p className="hidden text-[0.9375rem] font-medium lg:block">
            {t(`${espace}.nom`)}
          </p>

          <div className="ml-auto flex items-center gap-2">
            {/* Bascule entre les deux profils d'un même compte (section 03 :
                « un compte, deux profils »). */}
            {espace !== "admin" ? (
              <Link
                href={espace === "locataire" ? "/proprietaire" : "/compte"}
                className="rounded-champ border border-bordure px-3 py-2 text-sm font-medium transition-colors hover:border-accent hover:text-accent"
              >
                {t(`${espace}.bascule`)}
              </Link>
            ) : null}

            <button
              type="button"
              aria-expanded={tiroir}
              onClick={() => setTiroir(!tiroir)}
              className="-mr-2 inline-flex size-11 items-center justify-center rounded-champ lg:hidden"
            >
              <span className="sr-only">
                {tiroir ? t("fermerMenu") : t("ouvrirMenu")}
              </span>
              <svg viewBox="0 0 24 24" aria-hidden className="size-6" fill="none">
                <path
                  d={tiroir ? "M6 6l12 12M18 6L6 18" : "M4 7h16M4 12h16M4 17h16"}
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <div className="lg:flex">
        {/* --- Barre latérale --- */}
        <nav
          aria-label={t(`${espace}.nom`)}
          className={cn(
            "border-bordure bg-fond-eleve lg:sticky lg:top-16 lg:h-[calc(100dvh-4rem)] lg:w-64 lg:shrink-0 lg:overflow-y-auto lg:border-r",
            tiroir ? "block border-b" : "hidden lg:block",
          )}
        >
          <ul className="space-y-0.5 p-4">{navigation.map(lien)}</ul>
        </nav>

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}

/** En-tête d'une page d'espace : titre, sous-titre, actions. */
export function EnTeteEspace({
  titre,
  sousTitre,
  actions,
}: {
  titre: string;
  sousTitre?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-bordure pb-6">
      <div>
        <h1 className="text-[1.5rem] font-bold tracking-[-0.02em] sm:text-[1.75rem]">
          {titre}
        </h1>
        {sousTitre ? (
          <p className="mt-2 max-w-2xl text-[0.9375rem] text-texte-attenue">
            {sousTitre}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex gap-2">{actions}</div> : null}
    </div>
  );
}
