"use client";

import { useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";

import { Icone } from "@/components/espace/icone";
import { MenuCompte } from "@/components/espace/menu-compte";
import type { GroupeEspace } from "@/components/espace/navigation-espace";
import {
  useBarreRepliee,
  useGrandEcran,
} from "@/components/espace/preference-barre";
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
  nomCompte,
  courrielCompte,
}: {
  espace: "locataire" | "loueur" | "admin";
  navigation: readonly GroupeEspace[];
  children: ReactNode;
  /** Compte connecté, lu par la garde du layout et transmis ici. */
  nomCompte: string;
  courrielCompte: string;
}) {
  const t = useTranslations("espaces");
  const chemin = usePathname();

  const [replie, basculerRepli] = useBarreRepliee();
  const [tiroir, setTiroir] = useState(false);
  const estGrandEcran = useGrandEcran();

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
              {/* Une seule commande de barre, et elle est ici.
                  Le repli vivait au pied de la barre latérale, sous treize
                  entrées dans l'administration : pour le trouver il fallait
                  déjà savoir qu'il existait. Remonté dans l'en-tête, il est au
                  même endroit dans les trois espaces, visible sans défiler.

                  Le même bouton fait deux gestes selon la largeur, parce que
                  la barre n'est pas la même chose de part et d'autre : sous
                  `lg` c'est un tiroir qui s'ouvre par-dessus, au-delà c'est
                  une colonne qui se replie sur ses icônes. Deux boutons pour
                  la même intention — « montre-moi la navigation, ou rends-moi
                  la place » — auraient demandé de choisir lequel regarder. */}
              <button
                type="button"
                aria-expanded={estGrandEcran ? !replie : tiroir}
                onClick={() => (estGrandEcran ? basculerRepli() : setTiroir(true))}
                className="-ml-2 inline-flex size-11 items-center justify-center rounded-champ transition-colors hover:bg-fond-doux"
              >
                <span className="sr-only">
                  {estGrandEcran
                    ? replie
                      ? t("deplier")
                      : t("replier")
                    : t("ouvrirMenu")}
                </span>
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
                {/* Aucune bascule d'un espace à l'autre.
                    Elle promettait ce qu'elle ne pouvait pas tenir : un compte
                    ne porte pas forcément les deux profils, et le bouton menait
                    alors à une garde qui renvoyait d'où l'on venait — un aller
                    et retour muet, que l'on prend pour une panne. Le second
                    profil s'active depuis les paramètres ; tant qu'il ne l'est
                    pas, l'autre espace n'existe pas pour ce compte. */}
                <Link
                  href="/"
                  className="hidden rounded-champ px-3 py-2 text-sm text-texte-attenue transition-colors hover:text-texte sm:block"
                >
                  {t("voirLeSite")}
                </Link>
                <MenuCompte nom={nomCompte} courriel={courrielCompte} />
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
