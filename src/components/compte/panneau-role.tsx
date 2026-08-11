"use client";

import { useTranslations } from "next-intl";

import { Illustration } from "@/components/ui/illustration";
import type { Role } from "@/domain/compte/roles";
import { cn } from "@/lib/cn";

/**
 * Panneau de réassurance de l'inscription, accordé au rôle choisi.
 *
 * Il changeait autrefois de rien du tout : la même photographie et les mêmes
 * arguments, qu'on vienne louer une remorque ou mettre la sienne à
 * disposition. C'était une occasion manquée — la seconde colonne existe pour
 * répondre à « qu'est-ce que je risque ? », et cette question n'a pas la même
 * réponse des deux côtés. Un propriétaire veut savoir si son matériel est
 * couvert ; un locataire, si sa caution va être prélevée.
 *
 * Le panneau bascule à gauche pour le propriétaire. Ce n'est pas un caprice
 * graphique : le changement de côté est ce qui rend le basculement *perceptible*
 * — une photographie qui se remplace au même endroit peut passer inaperçue, un
 * panneau qui traverse l'écran, non. Il signale qu'on a changé de parcours.
 */

const ILLUSTRATIONS: Record<Role, string> = {
  locataire: "/images/remorque-benne.webp",
  proprietaire: "/images/proprietaires.webp",
};

export function PanneauRole({ role }: { role: Role | null }) {
  const t = useTranslations("compte.inscription.panneau");

  // Sans choix encore fait, on montre le panneau du locataire : c'est le cas
  // le plus fréquent, et un panneau vide serait une colonne perdue.
  const actif: Role = role ?? "locataire";

  return (
    <aside
      className={cn(
        "relative hidden overflow-hidden bg-encre text-encre-texte lg:block",
        // Toujours à gauche. L'illustration changeait de côté selon le rôle
        // choisi : l'intention était de marquer le choix, l'effet était que
        // le formulaire sautait d'un bord à l'autre de l'écran pendant qu'on
        // le remplissait. Une mise en page ne doit pas bouger sous les doigts
        // de qui la remplit.
        "lg:order-first",
      )}
    >
      {/*
        Les trois images sont montées en permanence et se croisent en opacité.
        Monter et démonter à chaque choix relancerait un téléchargement, et le
        panneau resterait noir le temps du chargement — exactement l'inverse de
        l'effet recherché.
      */}
      {(Object.keys(ILLUSTRATIONS) as Role[]).map((cle) => (
        <div
          key={cle}
          aria-hidden={cle !== actif}
          className={cn(
            "absolute inset-0 transition-opacity duration-500 ease-out motion-reduce:transition-none",
            cle === actif ? "opacity-100" : "opacity-0",
          )}
        >
          <Illustration
            src={ILLUSTRATIONS[cle]}
            alt={cle === actif ? t(`${cle}.illustration`) : ""}
            className="h-full w-full"
            tailles="50vw"
          />
        </div>
      ))}

      <div aria-hidden className="absolute inset-0 bg-marque-950/70" />
      <div
        aria-hidden
        className="absolute inset-0 bg-linear-to-t from-marque-950 via-marque-950/50 to-transparent"
      />

      {/*
        Le texte est remonté par une clé : changer la clé démonte et remonte le
        bloc, ce qui relance l'animation d'entrée. Une simple transition ne
        rejouerait rien, le contenu étant remplacé d'un coup.
      */}
      <div
        key={actif}
        className="animate-panneau relative flex h-full flex-col justify-end p-12 xl:p-16"
      >
        <p className="text-[0.6875rem] font-semibold tracking-[0.14em] text-encre-texte-attenue uppercase">
          {t(`${actif}.surtitre`)}
        </p>
        <p className="mt-4 max-w-md text-[1.75rem] leading-[1.15] font-bold tracking-[-0.025em] text-balance">
          {t(`${actif}.titre`)}
        </p>

        <ul className="mt-10 space-y-5">
          {(["a1", "a2", "a3"] as const).map((cle, rang) => (
            <li
              key={cle}
              className="animate-argument flex items-start gap-3 opacity-0"
              // Décalage léger : les arguments arrivent l'un après l'autre, ce
              // qui guide la lecture au lieu de tout présenter d'un bloc.
              style={{ animationDelay: `${120 + rang * 90}ms` }}
            >
              <svg
                viewBox="0 0 20 20"
                aria-hidden
                className="mt-0.5 size-5 shrink-0"
                fill="none"
              >
                <circle
                  cx="10"
                  cy="10"
                  r="9"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  opacity="0.4"
                />
                <path
                  d="m6 10.5 2.5 2.5L14 7.5"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="text-[0.9375rem] text-encre-texte-attenue">
                {t(`${actif}.${cle}`)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
