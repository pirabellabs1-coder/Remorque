"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, useTransition } from "react";

import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { deconnecter } from "@/server/authentification/actions";

/**
 * Menu du compte connecté, en haut de chaque espace.
 *
 * L'interface ne disait pas qui était connecté. Sur une plateforme où l'on
 * bascule entre deux profils — et où l'on peut ouvrir un compte de
 * démonstration à côté du sien — c'est la première question qu'on se pose
 * devant un écran qui n'affiche pas les données attendues.
 *
 * Il porte aussi la déconnexion, jusqu'ici absente : l'action existait côté
 * serveur, rien ne l'appelait. Un compte dont on ne peut pas sortir est un
 * problème sur un poste partagé.
 */
export function MenuCompte({
  nom,
  courriel,
}: {
  nom: string;
  courriel: string;
}) {
  const t = useTranslations("espaces.compte");
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const [enCours, demarrer] = useTransition();
  const conteneur = useRef<HTMLDivElement>(null);

  // Fermeture au clic extérieur et à la touche d'échappement. Un menu qui ne
  // se ferme qu'en recliquant sur son bouton piège au premier essai.
  useEffect(() => {
    if (!ouvert) return;

    function auClic(evenement: MouseEvent) {
      if (!conteneur.current?.contains(evenement.target as Node)) setOuvert(false);
    }
    function auClavier(evenement: KeyboardEvent) {
      if (evenement.key === "Escape") setOuvert(false);
    }

    document.addEventListener("mousedown", auClic);
    document.addEventListener("keydown", auClavier);
    return () => {
      document.removeEventListener("mousedown", auClic);
      document.removeEventListener("keydown", auClavier);
    };
  }, [ouvert]);

  function sortir() {
    demarrer(async () => {
      await deconnecter();
      // `refresh` avant `push` : les gardes lisent la session côté serveur, et
      // sans rafraîchissement le routeur servirait la version en cache d'un
      // visiteur encore connecté.
      router.refresh();
      router.push("/");
    });
  }

  const initiale = (nom || courriel).charAt(0).toUpperCase();

  return (
    <div ref={conteneur} className="relative">
      <button
        type="button"
        onClick={() => setOuvert((etat) => !etat)}
        aria-expanded={ouvert}
        aria-haspopup="menu"
        className="flex items-center gap-2 rounded-champ px-2 py-1.5 transition-colors hover:bg-fond-doux"
      >
        <span
          aria-hidden
          className="grid size-8 shrink-0 place-items-center rounded-full bg-accent text-sm font-semibold text-accent-contraste"
        >
          {initiale}
        </span>
        <span className="hidden max-w-32 truncate text-sm font-medium sm:block">
          {nom || courriel}
        </span>
        <svg
          aria-hidden
          viewBox="0 0 20 20"
          className={cn(
            "size-4 shrink-0 text-texte-attenue transition-transform",
            ouvert && "rotate-180",
          )}
          fill="none"
        >
          <path
            d="m5 7.5 5 5 5-5"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {ouvert ? (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-carte border border-bordure bg-fond-eleve shadow-(--ombre-carte)"
        >
          {/* L'adresse est écrite en entier : c'est elle qui lève le doute
              quand on jongle entre plusieurs comptes, pas le prénom. */}
          <div className="border-b border-bordure px-4 py-3">
            <p className="truncate text-sm font-medium">{nom || courriel}</p>
            <p className="mt-0.5 truncate text-xs text-texte-attenue">{courriel}</p>
          </div>

          <button
            type="button"
            role="menuitem"
            onClick={sortir}
            disabled={enCours}
            className="w-full px-4 py-3 text-left text-sm font-medium transition-colors hover:bg-fond-doux disabled:opacity-60"
          >
            {enCours ? t("deconnexionEnCours") : t("deconnexion")}
          </button>
        </div>
      ) : null}
    </div>
  );
}
