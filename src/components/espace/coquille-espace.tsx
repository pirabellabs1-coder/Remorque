"use client";

import { useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";

import { Icone } from "@/components/espace/icone";
import type { GroupeEspace } from "@/components/espace/navigation-espace";
import { useBarreRepliee } from "@/components/espace/preference-barre";
import { Logo } from "@/components/navigation/logo";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/cn";

/**
 * Coquille commune aux trois espaces authentifiés.
 *
 * Barre latérale sombre, et non blanche comme le contenu. C'est ce qui donne
 * un cadre à l'écran : sur un fond entièrement blanc, la navigation et les
 * données se confondent, et l'œil ne sait plus où commence l'espace de
 * travail. Le bleu profond est déjà celui des bandeaux de l'espace public —
 * on ne fait ici qu'en prolonger l'usage.
 *
 * Repliable, et l'état est retenu d'une visite à l'autre : sur un écran de
 * travail, certains veulent les libellés, d'autres veulent la place. Le choix
 * leur appartient, et il n'a pas à être refait à chaque connexion.
 */
export function CoquilleEspace({
  espace,
  navigation,
  children,
}: {
  espace: "locataire" | "loueur" | "admin";
  navigation: readonly GroupeEspace[];
  children: ReactNode;
}) {
  const t = useTranslations("espaces");
  const chemin = usePathname();

  const [replie, basculerRepli] = useBarreRepliee();
  const [tiroir, setTiroir] = useState(false);

  const racine = navigation[0]?.entrees[0]?.href;

  return (
    <div className="min-h-dvh bg-fond">
      <div className="flex">
        {/* ============ Barre latérale ============ */}
        <div
          className={cn(
            "fixed inset-y-0 left-0 z-50 flex flex-col bg-encre text-encre-texte transition-[width,transform] duration-200",
            replie ? "w-[4.5rem]" : "w-64",
            tiroir ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
          )}
        >
          <div
            className={cn(
              "flex h-16 shrink-0 items-center border-b border-encre-bordure",
              replie ? "justify-center px-2" : "px-5",
            )}
          >
            <Link href="/" onClick={() => setTiroir(false)}>
              {replie ? (
                <span className="grid size-9 place-items-center rounded-champ bg-white/10 font-bold">
                  F
                </span>
              ) : (
                <Logo clair />
              )}
            </Link>
          </div>

          <nav
            aria-label={t(`${espace}.nom`)}
            className="flex-1 overflow-x-hidden overflow-y-auto px-3 py-4"
          >
            {navigation.map((groupe, index) => (
              <div key={groupe.cle ?? index} className={index > 0 ? "mt-6" : ""}>
                {groupe.cle && !replie ? (
                  <p className="px-3 pb-2 text-[0.6875rem] font-semibold tracking-[0.14em] text-encre-texte-attenue uppercase">
                    {t(`${espace}.${groupe.cle}`)}
                  </p>
                ) : null}
                {groupe.cle && replie ? (
                  <div
                    aria-hidden
                    className="mx-3 mb-3 h-px bg-encre-bordure"
                  />
                ) : null}

                <ul className="space-y-0.5">
                  {groupe.entrees.map((entree) => {
                    // Correspondance exacte pour la racine, préfixe ailleurs :
                    // sans cela « Tableau de bord » resterait actif partout.
                    const actif =
                      entree.href === racine
                        ? chemin === entree.href
                        : chemin.startsWith(entree.href);
                    const libelle = t(`${espace}.nav.${entree.cle}`);

                    return (
                      <li key={entree.cle}>
                        <Link
                          href={entree.href}
                          aria-current={actif ? "page" : undefined}
                          title={replie ? libelle : undefined}
                          onClick={() => setTiroir(false)}
                          className={cn(
                            "flex items-center gap-3 rounded-champ text-[0.9375rem] transition-colors",
                            replie ? "justify-center px-2 py-2.5" : "px-3 py-2.5",
                            actif
                              ? "bg-white/15 font-medium text-encre-texte"
                              : "text-encre-texte-attenue hover:bg-white/8 hover:text-encre-texte",
                          )}
                        >
                          <Icone nom={entree.icone} />
                          {!replie ? (
                            <span className="truncate">{libelle}</span>
                          ) : (
                            <span className="sr-only">{libelle}</span>
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>

          {/* Repli — sur grand écran seulement : sur mobile la barre est un
              tiroir, qui se ferme et n'a pas d'état intermédiaire. */}
          <button
            type="button"
            onClick={basculerRepli}
            aria-pressed={replie}
            className={cn(
              "hidden shrink-0 items-center gap-3 border-t border-encre-bordure px-5 py-4 text-sm text-encre-texte-attenue transition-colors hover:text-encre-texte lg:flex",
              replie && "justify-center px-2",
            )}
          >
            <svg viewBox="0 0 24 24" aria-hidden className="size-5" fill="none">
              <path
                d={replie ? "M9 6l6 6-6 6" : "M15 6l-6 6 6 6"}
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {!replie ? t("replier") : <span className="sr-only">{t("deplier")}</span>}
          </button>
        </div>

        {/* Voile du tiroir mobile. */}
        {tiroir ? (
          <button
            type="button"
            aria-label={t("fermerMenu")}
            onClick={() => setTiroir(false)}
            className="fixed inset-0 z-40 bg-marque-950/50 lg:hidden"
          />
        ) : null}

        {/* ============ Contenu ============ */}
        <div
          className={cn(
            "min-w-0 flex-1 transition-[padding] duration-200",
            replie ? "lg:pl-[4.5rem]" : "lg:pl-64",
          )}
        >
          <header className="sticky top-0 z-30 border-b border-bordure bg-fond-eleve/95 backdrop-blur">
            <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
              <button
                type="button"
                aria-expanded={tiroir}
                onClick={() => setTiroir(true)}
                className="-ml-2 inline-flex size-11 items-center justify-center rounded-champ lg:hidden"
              >
                <span className="sr-only">{t("ouvrirMenu")}</span>
                <svg viewBox="0 0 24 24" aria-hidden className="size-6" fill="none">
                  <path
                    d="M4 7h16M4 12h16M4 17h16"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>

              <p className="text-[0.9375rem] font-semibold">
                {t(`${espace}.nom`)}
              </p>

              <div className="ml-auto flex items-center gap-2">
                {espace !== "admin" ? (
                  <Link
                    href={espace === "locataire" ? "/proprietaire" : "/compte"}
                    className="rounded-champ border border-bordure px-3 py-2 text-sm font-medium transition-colors hover:border-accent hover:text-accent"
                  >
                    {t(`${espace}.bascule`)}
                  </Link>
                ) : null}
                <Link
                  href="/"
                  className="hidden rounded-champ px-3 py-2 text-sm text-texte-attenue transition-colors hover:text-texte sm:block"
                >
                  {t("voirLeSite")}
                </Link>
              </div>
            </div>
          </header>

          <main>{children}</main>
        </div>
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
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
