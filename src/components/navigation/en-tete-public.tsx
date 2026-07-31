"use client";

import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState, type ComponentProps } from "react";

import { Logo } from "@/components/navigation/logo";
import {
  CATEGORIES_EN_AVANT,
  LIENS_AIDE,
  LIENS_LOCATAIRE,
  LIENS_PROPRIETAIRE,
  OUTILS,
  VILLES_EN_AVANT,
} from "@/components/navigation/menu";
import { Bouton } from "@/components/ui/bouton";
import { Illustration } from "@/components/ui/illustration";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";

type Panneau = "louer" | "proprietaire" | "aide";

/**
 * En-tête de l'espace public, avec méga-menu.
 *
 * La barre est opaque partout, y compris sur l'accueil. Une barre transparente
 * posée sur la photographie de première vue se confondait avec elle : on ne
 * distinguait plus la navigation du décor, et la lisibilité des libellés
 * dépendait de ce que la photographie avait sous eux.
 *
 * Le déploiement se fait au clic et au survol, mais l'état de référence est le
 * clic : un menu qui ne s'ouvre qu'au survol est inutilisable au clavier et au
 * doigt. Échappement referme et rend le focus au déclencheur.
 */
export function EnTetePublic() {
  const t = useTranslations("menu");
  const tNav = useTranslations("navigation");
  const identifiant = useId();

  const [ouvert, setOuvert] = useState<Panneau | null>(null);
  const [tiroirOuvert, setTiroirOuvert] = useState(false);
  const [defile, setDefile] = useState(false);

  const enTete = useRef<HTMLElement>(null);
  const minuterie = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Referme tout. Branché sur le conteneur des panneaux plutôt que sur un
   * effet réagissant au changement d'adresse : la fermeture est la conséquence
   * directe du clic, elle n'a pas à transiter par un rendu supplémentaire.
   */
  function fermer() {
    setOuvert(null);
    setTiroirOuvert(false);
  }

  // L'ombre portée n'apparaît qu'au défilement : la barre se détache du
  // contenu qui passe dessous, sans peser lorsque la page est en haut.
  useEffect(() => {
    const auDefilement = () => setDefile(window.scrollY > 8);
    auDefilement();
    window.addEventListener("scroll", auDefilement, { passive: true });
    return () => window.removeEventListener("scroll", auDefilement);
  }, []);

  useEffect(() => {
    if (ouvert === null && !tiroirOuvert) return;

    const auClavier = (evenement: KeyboardEvent) => {
      if (evenement.key !== "Escape") return;
      setOuvert(null);
      setTiroirOuvert(false);
      // Le focus revient sur le déclencheur, sinon il repart au début du
      // document et l'utilisateur au clavier perd sa place.
      const declencheur = document.getElementById(`${identifiant}-${ouvert}`);
      declencheur?.focus();
    };

    const auClicExterieur = (evenement: MouseEvent) => {
      if (enTete.current?.contains(evenement.target as Node)) return;
      setOuvert(null);
    };

    document.addEventListener("keydown", auClavier);
    document.addEventListener("mousedown", auClicExterieur);
    return () => {
      document.removeEventListener("keydown", auClavier);
      document.removeEventListener("mousedown", auClicExterieur);
    };
  }, [ouvert, tiroirOuvert, identifiant]);

  /** Petit délai au survol : évite qu'un passage de souris ouvre un panneau. */
  function survoler(panneau: Panneau | null) {
    if (minuterie.current) clearTimeout(minuterie.current);
    minuterie.current = setTimeout(() => setOuvert(panneau), panneau ? 120 : 180);
  }

  const declencheurs: Array<{ cle: Panneau; libelle: string }> = [
    { cle: "louer", libelle: t("louer") },
    { cle: "proprietaire", libelle: t("mettreEnLocation") },
    { cle: "aide", libelle: t("aide") },
  ];

  return (
    <header
      ref={enTete}
      onMouseLeave={() => survoler(null)}
      className={cn(
        "sticky top-0 z-50 border-b border-bordure bg-fond-eleve text-texte",
        "transition-shadow duration-200",
        defile && "shadow-(--ombre-carte)",
      )}
    >
      {/* Grille en trois colonnes plutôt qu'une rangée souple : la navigation
          est ainsi centrée sur la page, et non sur l'espace laissé libre par
          le logo et les actions. */}
      <div className="mx-auto grid h-16 w-full max-w-6xl grid-cols-[auto_1fr_auto] items-center gap-4 px-4 sm:px-6">
        <Link
          href="/"
          className="shrink-0"
          aria-label={tNav("accueil")}
          onClick={fermer}
        >
          <Logo />
        </Link>

        {/* --- Navigation bureau --- */}
        <nav aria-label={t("principale")} className="hidden justify-self-center md:block">
          <ul className="flex items-center gap-1">
            {declencheurs.map((declencheur) => (
              <li key={declencheur.cle}>
                <button
                  id={`${identifiant}-${declencheur.cle}`}
                  type="button"
                  aria-expanded={ouvert === declencheur.cle}
                  aria-controls={`${identifiant}-panneau`}
                  onClick={() =>
                    setOuvert(ouvert === declencheur.cle ? null : declencheur.cle)
                  }
                  onMouseEnter={() => survoler(declencheur.cle)}
                  className={cn(
                    "group inline-flex items-center gap-1.5 rounded-champ px-4 py-2",
                    "text-[0.9375rem] font-medium transition-colors",
                    ouvert === declencheur.cle
                      ? "bg-fond-doux text-accent"
                      : "hover:bg-fond-doux hover:text-accent",
                  )}
                >
                  {declencheur.libelle}
                  {/* Le chevron est ce qui distingue une entrée dépliante d'un
                      simple lien : sans lui, rien n'indique qu'un panneau
                      attend derrière, et le menu n'est découvert qu'au hasard
                      d'un survol. */}
                  <svg
                    viewBox="0 0 12 12"
                    aria-hidden
                    className={cn(
                      "size-3 transition-transform duration-200",
                      ouvert === declencheur.cle && "rotate-180",
                    )}
                    fill="none"
                  >
                    <path
                      d="m2.5 4.5 3.5 3.5 3.5-3.5"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-2 justify-self-end">
          <Bouton
            as={Link}
            href="/connexion"
            variante="secondaire"
            taille="petit"
            className="hidden sm:inline-flex"
          >
            {tNav("connexion")}
          </Bouton>
          <Bouton as={Link} href="/inscription" taille="petit">
            {tNav("inscription")}
          </Bouton>

          {/* --- Bascule du tiroir mobile --- */}
          <button
            type="button"
            aria-expanded={tiroirOuvert}
            aria-controls={`${identifiant}-tiroir`}
            onClick={() => setTiroirOuvert(!tiroirOuvert)}
            className="-mr-2 inline-flex size-11 items-center justify-center rounded-champ md:hidden"
          >
            <span className="sr-only">
              {tiroirOuvert ? t("fermerMenu") : t("ouvrirMenu")}
            </span>
            <svg viewBox="0 0 24 24" aria-hidden className="size-6" fill="none">
              {tiroirOuvert ? (
                <path
                  d="M6 6l12 12M18 6L6 18"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              ) : (
                <path
                  d="M4 7h16M4 12h16M4 17h16"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* --- Panneau bureau --- */}
      {ouvert !== null ? (
        <div
          id={`${identifiant}-panneau`}
          onClick={fermer}
          className="absolute inset-x-0 top-16 hidden md:block"
        >
          {/* Le panneau flotte au lieu de courir d'un bord à l'autre : une
              bande pleine largeur se confond avec la barre et donne un menu
              sans contour. Ici, une dalle posée sur la page, avec son ombre. */}
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
            <div className="overflow-hidden rounded-b-[1.25rem] border border-t-0 border-bordure bg-fond-eleve shadow-(--ombre-flottante)">
              {ouvert === "louer" ? <PanneauLouer /> : null}
              {ouvert === "proprietaire" ? <PanneauProprietaire /> : null}
              {ouvert === "aide" ? <PanneauAide /> : null}
            </div>
          </div>
        </div>
      ) : null}

      {/* --- Tiroir mobile --- */}
      {tiroirOuvert ? (
        <div
          id={`${identifiant}-tiroir`}
          onClick={fermer}
          className="absolute inset-x-0 top-16 max-h-[calc(100dvh-4rem)] overflow-y-auto border-t border-bordure bg-fond-eleve px-4 pt-6 pb-10 text-texte md:hidden"
        >
          <SectionMobile
            titre={t("louer")}
            liens={LIENS_LOCATAIRE.map((lien) => ({
              cle: lien.cle,
              href: lien.href,
              libelle: t(`locataire.${lien.cle}`),
            }))}
          />
          <SectionMobile
            titre={t("categories")}
            liens={CATEGORIES_EN_AVANT.map((categorie) => ({
              cle: categorie.slug,
              href: {
                pathname: "/recherche" as const,
                query: { categorie: categorie.slug },
              },
              libelle: categorie.nom,
            }))}
          />
          <SectionMobile
            titre={t("mettreEnLocation")}
            liens={LIENS_PROPRIETAIRE.map((lien) => ({
              cle: lien.cle,
              href: lien.href,
              libelle: t(`proprietaire.${lien.cle}`),
            }))}
          />
          <SectionMobile
            titre={t("aide")}
            liens={LIENS_AIDE.map((lien) => ({
              cle: lien.cle,
              href: lien.href,
              libelle: t(`aideLiens.${lien.cle}`),
            }))}
          />
        </div>
      ) : null}
    </header>
  );
}

/* ------------------------------------------------------------------ */

function TitreColonne({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[0.6875rem] font-semibold tracking-[0.14em] text-texte-attenue uppercase">
      {children}
    </p>
  );
}

function PanneauLouer() {
  const t = useTranslations("menu");

  return (
    <div className="grid grid-cols-12">
      {/* Deux tiers blancs pour le catalogue, un tiers bleuté pour les outils :
          le contraste de fond sépare la navigation de la mise en avant, sans
          filet ni titre supplémentaire. */}
      <div className="col-span-8 p-8">
        <TitreColonne>{t("categories")}</TitreColonne>
        <ul className="mt-5 grid grid-cols-2 gap-x-4 gap-y-1">
          {CATEGORIES_EN_AVANT.map((categorie) => (
            <li key={categorie.slug}>
              <Link
                href={{
                  pathname: "/recherche",
                  query: { categorie: categorie.slug },
                }}
                className="group flex items-center gap-3 rounded-champ p-2 transition-colors hover:bg-fond-doux"
              >
                {/* La vignette porte la reconnaissance : on distingue une
                    benne d'un van bien plus vite qu'on ne lit leurs noms. */}
                <Illustration
                  src={categorie.photo}
                  alt=""
                  className="size-12 shrink-0 rounded-[0.5rem]"
                  tailles="48px"
                />
                <span className="min-w-0">
                  <span className="block truncate text-[0.9375rem] font-medium group-hover:text-accent">
                    {categorie.nom}
                  </span>
                  <span className="block truncate text-sm text-texte-attenue">
                    {categorie.usages}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>

        <div className="mt-6 border-t border-bordure pt-5">
          <TitreColonne>{t("villes")}</TitreColonne>
          <ul className="mt-4 flex flex-wrap gap-1.5">
            {VILLES_EN_AVANT.map((ville) => (
              <li key={ville.slug}>
                <Link
                  href={{
                    pathname: "/location-remorque/[ville]",
                    params: { ville: ville.slug },
                  }}
                  className="inline-block rounded-full border border-bordure px-3 py-1.5 text-sm transition-colors hover:border-accent hover:text-accent"
                >
                  {ville.nom}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="col-span-4 bg-fond-doux p-8">
        <TitreColonne>{t("avantDeReserver")}</TitreColonne>
        <ul className="mt-5 space-y-3">
          {OUTILS.map((outil) => (
            <li key={outil.cle}>
              <Link
                href={outil.href}
                className="block rounded-champ border border-bordure bg-fond-eleve px-4 py-3 transition-colors hover:border-accent"
              >
                <span className="block text-[0.9375rem] font-medium">
                  {t(`outils.${outil.cle}.titre`)}
                </span>
                <span className="mt-0.5 block text-sm text-texte-attenue">
                  {t(`outils.${outil.cle}.texte`)}
                </span>
              </Link>
            </li>
          ))}
        </ul>

        <Link
          href="/recherche"
          className="mt-6 inline-block text-sm font-medium text-accent underline-offset-4 hover:underline"
        >
          {t("toutesCategories")}
        </Link>
      </div>
    </div>
  );
}

function PanneauProprietaire() {
  const t = useTranslations("menu");

  return (
    <div className="grid grid-cols-12">
      <div className="col-span-7 p-8">
        <TitreColonne>{t("mettreEnLocation")}</TitreColonne>
        <ul className="mt-5 space-y-1">
          {LIENS_PROPRIETAIRE.map((lien) => (
            <li key={lien.cle}>
              <Link
                href={lien.href}
                className="block rounded-champ px-3 py-2.5 text-[0.9375rem] transition-colors hover:bg-fond-doux hover:text-accent"
              >
                {t(`proprietaire.${lien.cle}`)}
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <div className="col-span-5 bg-fond-doux p-8">
        <p className="text-[1.0625rem] font-semibold">{t("encart.titre")}</p>
        <p className="mt-2 text-sm text-texte-attenue">{t("encart.texte")}</p>
        <Bouton
          as={Link}
          href="/mettre-en-location"
          taille="petit"
          className="mt-5"
        >
          {t("encart.action")}
        </Bouton>
      </div>
    </div>
  );
}

function PanneauAide() {
  const t = useTranslations("menu");

  return (
    <div className="grid grid-cols-12">
      <div className="col-span-7 p-8">
        <TitreColonne>{t("aide")}</TitreColonne>
        <ul className="mt-5 space-y-1">
          {LIENS_AIDE.map((lien) => (
            <li key={lien.cle}>
              <Link
                href={lien.href}
                className="block rounded-champ px-3 py-2.5 text-[0.9375rem] transition-colors hover:bg-fond-doux hover:text-accent"
              >
                {t(`aideLiens.${lien.cle}`)}
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <div className="col-span-5 bg-fond-doux p-8">
        <p className="text-[1.0625rem] font-semibold">{t("assurance.titre")}</p>
        <p className="mt-2 text-sm text-texte-attenue">{t("assurance.texte")}</p>
        <Link
          href="/assurance"
          className="mt-4 inline-block text-sm font-medium text-accent underline-offset-4 hover:underline"
        >
          {t("assurance.action")}
        </Link>
      </div>
    </div>
  );
}

function SectionMobile({
  titre,
  liens,
}: {
  titre: string;
  /** Le libellé est résolu par l'appelant : la section ne connaît pas les
      espaces de noms, elle ne fait que mettre en page. */
  liens: Array<{
    cle: string;
    href: ComponentProps<typeof Link>["href"];
    libelle: string;
  }>;
}) {
  return (
    <section className="border-t border-bordure py-5 first:border-t-0 first:pt-0">
      <p className="text-[0.6875rem] font-semibold tracking-[0.14em] text-texte-attenue uppercase">
        {titre}
      </p>
      <ul className="mt-3">
        {liens.map((lien) => (
          <li key={lien.cle}>
            <Link
              href={lien.href}
              className="block py-2.5 text-base transition-colors hover:text-accent"
            >
              {lien.libelle}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
