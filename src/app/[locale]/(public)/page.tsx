import { getTranslations, setRequestLocale } from "next-intl/server";

import { CarteAnnonce } from "@/components/annonce/carte-annonce";
import { FormulaireRecherche } from "@/components/recherche/formulaire-recherche";
import { Bouton } from "@/components/ui/bouton";
import { DonneesStructurees } from "@/components/ui/carte";
import { Illustration } from "@/components/ui/illustration";
import { TuileLien } from "@/components/ui/tuile-lien";
import {
  Chapo,
  ESPACEMENT,
  Surtitre,
  TITRE,
  TitreSection,
} from "@/components/ui/typographie";
import { CATEGORIES } from "@/config/categories";
import { clientEnv } from "@/config/env-client";
import type { Market } from "@/config/markets";
import { PAYS, villesDuPays } from "@/config/villes";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { metadonneesPage } from "@/lib/metadonnees";
import { annoncesEnVitrine } from "@/server/annonces/catalogue";

/**
 * Villes montrées par pays sur l'accueil. Les autres restent atteignables par
 * la recherche et par le maillage des villes voisines, sur chaque page locale.
 */
const VILLES_PAR_PAYS = 12;

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "accueil" });

  return metadonneesPage({
    locale: locale as Market,
    href: "/",
    titre: t("metaTitre"),
    description: t("metaDescription"),
  });
}

export default async function PageAccueil({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("accueil");
  const tParcours = await getTranslations("parcoursLocataire");
  const base = clientEnv.NEXT_PUBLIC_SITE_URL;

  // Deux rangées de quatre : une seule rangée donnait un aperçu trop
  // maigre pour juger de l'offre.
  const vitrine = await annoncesEnVitrine(8);

  const etapes = [1, 2, 3, 4].map((numero) => ({
    titre: tParcours(`etapes.e${numero}.titre`),
    texte: tParcours(`etapes.e${numero}.texte`),
  }));

  const garanties = ["assurance", "caution", "etatDesLieux"] as const;

  return (
    <main>
      {/* ================= Première vue ================= */}
      <section className="relative bg-encre text-encre-texte">
        <div className="absolute inset-0">
          <Illustration
            src="/images/hero.webp"
            alt={t("hero.illustration")}
            priorite
            className="h-full w-full"
            tailles="100vw"
          />
        </div>
        {/*
          Voile en deux couches. Un simple dégradé horizontal ne convient pas :
          sur écran étroit, seule son extrémité opaque reste visible et la
          photographie disparaît entièrement (M21 — contrastes).
        */}
        <div aria-hidden className="absolute inset-0 bg-marque-950/55" />
        <div
          aria-hidden
          className="absolute inset-0 bg-linear-to-r from-marque-950/85 via-marque-950/40 to-transparent"
        />

        <div className="relative mx-auto w-full max-w-6xl px-4 pt-16 pb-16 sm:px-6 sm:pt-24 sm:pb-24">
          <Surtitre clair>{t("hero.surtitre")}</Surtitre>
          <h1 className={cn(TITRE.page, "mt-5 max-w-3xl text-balance")}>
            {t("titre")}
          </h1>
          <p className="mt-5 max-w-lg text-[1.0625rem] leading-[1.6] text-pretty text-encre-texte-attenue sm:text-[1.1875rem]">
            {t("sousTitre")}
          </p>

          {/* Le formulaire est dans la première vue, pas en carte flottante
              en dessous : sur mobile, c'est le seul élément transactionnel de
              la page et il doit rester au-dessus de la ligne de flottaison. */}
          <div className="mt-10 max-w-2xl">
            <FormulaireRecherche />
          </div>

          {/* Un seul appel à l'action mis en avant. Deux boutons de poids égal
              divisent l'attention du public transactionnel, seul à convertir
              dans la session ; le chemin propriétaire reste présent en lien. */}
          <p className="mt-6">
            <Link
              href="/mettre-en-location"
              className="text-sm font-medium text-encre-texte underline decoration-encre-texte/40 underline-offset-4 hover:decoration-encre-texte"
            >
              {t("hero.actionProprietaire")}
            </Link>
          </p>
        </div>
      </section>

      {/* ================= Réassurance ================= */}
      <section className={cn("border-b border-bordure bg-fond-eleve", ESPACEMENT.serree)}>
        <ul className="mx-auto grid w-full max-w-6xl gap-6 px-4 sm:grid-cols-3 sm:px-6">
          {(["assurance", "paiement", "proximite"] as const).map((cle) => (
            <li key={cle} className="flex items-start gap-3">
              <span
                aria-hidden
                className="mt-1.5 size-2 shrink-0 rounded-full bg-accent"
              />
              <span className="text-[0.9375rem]">{t(`reassurance.${cle}`)}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* ================= Annonces ================= */}
      {vitrine.length > 0 ? (
        <section className={cn("mx-auto w-full max-w-6xl px-4 sm:px-6", ESPACEMENT.standard)}>
          <div className="flex flex-wrap items-end justify-between gap-6">
            <TitreSection>{t("vitrine.titre")}</TitreSection>
            <Link
              href="/recherche"
              className="pb-5 text-sm font-medium text-accent underline-offset-4 hover:underline"
            >
              {t("vitrine.action")}
            </Link>
          </div>

          {/* Deux colonnes dès le mobile : le défilement horizontal cachait
              la moitié des annonces derrière un geste que rien n'annonçait. */}
          <ul className="mt-10 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {vitrine.map((annonce) => (
              <li key={annonce.id}>
                <CarteAnnonce annonce={annonce} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* ================= Catalogue ================= */}
      <section className="bg-fond-doux">
        <div className={cn("mx-auto w-full max-w-6xl px-4 sm:px-6", ESPACEMENT.standard)}>
          <div className="flex flex-wrap items-end justify-between gap-6">
            <TitreSection>{t("categories.titre")}</TitreSection>
            <Link
              href="/recherche"
              className="pb-5 text-sm font-medium text-accent underline-offset-4 hover:underline"
            >
              {t("categories.action")}
            </Link>
          </div>

          {/* Deux tuiles larges puis huit standard : dix tuiles de poids
              identique produisent une tapisserie, pas une hiérarchie. */}
          <ul className="mt-10 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {CATEGORIES.map((entree, index) => {
              const large = index < 2;
              return (
                <li
                  key={entree.slug}
                  className={large ? "col-span-2" : undefined}
                >
                  <Link
                    href={{
                      pathname: "/recherche",
                      query: { categorie: entree.slug },
                    }}
                    className="group relative block overflow-hidden rounded-carte shadow-(--ombre-carte) transition-[box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-(--ombre-carte-active)"
                  >
                    <Illustration
                      src={entree.photo}
                      alt={entree.alt}
                      className={cn(
                        "w-full",
                        large ? "aspect-3/2 lg:aspect-2/1" : "aspect-3/2",
                      )}
                      tailles={
                        large
                          ? "(min-width: 1024px) 50vw, 100vw"
                          : "(min-width: 1024px) 25vw, 50vw"
                      }
                    />
                    {/* Libellé posé sur la photo : la légende sous l'image
                        doublait la hauteur de chaque tuile pour trois mots. */}
                    <div
                      aria-hidden
                      className="absolute inset-x-0 bottom-0 bg-linear-to-t from-marque-950/85 to-transparent p-4 pt-10"
                    >
                      <p
                        className={cn(
                          "font-semibold text-white",
                          large ? "text-lg" : "text-[0.9375rem]",
                        )}
                      >
                        {entree.nom}
                      </p>
                    </div>
                    <span className="sr-only">{entree.nom}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* ================= Villes =================
          Le maillage vers les pages locales, qui portent 60 à 80 % du trafic
          attendu. Sans lien depuis l'accueil, elles restent orphelines.

          Une grille de tuiles par pays, et non une liste à puces : à cette
          densité, l'œil balaie une grille bien plus vite qu'une colonne, et
          chaque cellule encadrée se lit comme une destination. */}
      <section className="bg-fond-doux">
        <div
          className={cn("mx-auto w-full max-w-6xl px-4 sm:px-6", ESPACEMENT.standard)}
        >
          <div className="max-w-2xl">
            <TitreSection>{t("villes.titre")}</TitreSection>
            <p className="mt-5 text-texte-attenue">{t("villes.mention")}</p>
          </div>

          <div className="mt-12 space-y-10">
            {PAYS.map((pays) => (
              <section key={pays}>
                <div className="flex items-center gap-4">
                  <h3 className="text-[0.6875rem] font-semibold tracking-[0.14em] text-texte-attenue uppercase">
                    {t(`villes.pays.${pays}`)}
                  </h3>
                  <span aria-hidden className="h-px flex-1 bg-bordure" />
                </div>

                <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {villesDuPays(pays)
                    .slice(0, VILLES_PAR_PAYS)
                    .map((ville) => (
                      <li key={ville.slug}>
                        <TuileLien
                          href={{
                            pathname: "/location-remorque/[ville]",
                            params: { ville: ville.slug },
                          }}
                        >
                          {ville.nom}
                        </TuileLien>
                      </li>
                    ))}
                </ul>
              </section>
            ))}
          </div>
        </div>
      </section>

      {/* ================= Confiance =================
          Placée avant le parcours : la question « et si ça casse ? » précède
          « comment ça marche ? ». */}
      <section className={cn("mx-auto w-full max-w-6xl px-4 sm:px-6", ESPACEMENT.standard)}>
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center lg:gap-16">
          {/* Socle décalé : donne une assise à la photographie sans cadre. */}
          <div className="relative before:absolute before:-inset-3 before:-z-10 before:rounded-[1.5rem] before:bg-fond-marque">
            <Illustration
              src="/images/etat-des-lieux.webp"
              alt={t("confiance.illustration")}
              className="aspect-4/3 w-full rounded-carte"
              tailles="(min-width: 1024px) 50vw, 100vw"
            />
          </div>

          <div>
            <Surtitre>{t("confiance.surtitre")}</Surtitre>
            <TitreSection className="mt-3">{t("confiance.titre")}</TitreSection>

            <dl className="mt-8 space-y-7">
              {garanties.map((cle) => (
                <div key={cle} className="border-t border-bordure pt-5">
                  <dt className={TITRE.carte}>{t(`confiance.${cle}.titre`)}</dt>
                  <dd className="mt-2 text-[0.9375rem] leading-[1.6] text-texte-attenue">
                    {t(`confiance.${cle}.texte`)}
                  </dd>
                </div>
              ))}
            </dl>

            <Link
              href="/assurance"
              className="mt-8 inline-block text-sm font-medium text-accent underline-offset-4 hover:underline"
            >
              {t("confiance.action")}
            </Link>
          </div>
        </div>
      </section>

      {/* ================= Parcours ================= */}
      <section className="bg-fond-doux">
        <div className={cn("mx-auto w-full max-w-6xl px-4 sm:px-6", ESPACEMENT.standard)}>
          <Surtitre>{t("parcours.surtitre")}</Surtitre>
          <TitreSection className="mt-3">{t("parcours.titre")}</TitreSection>

          <ol className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {etapes.map((etape, index) => (
              <li key={etape.titre}>
                <div className="flex items-center gap-4">
                  <span
                    aria-hidden
                    className="inline-flex size-12 shrink-0 items-center justify-center rounded-full border-2 border-accent bg-fond-eleve text-[1.0625rem] font-bold tabular-nums text-accent"
                  >
                    {index + 1}
                  </span>
                  {index < etapes.length - 1 ? (
                    <span
                      aria-hidden
                      className="hidden h-px flex-1 bg-marque-200 lg:block"
                    />
                  ) : null}
                </div>
                <h3 className={cn(TITRE.carte, "mt-5")}>{etape.titre}</h3>
                <p className="mt-2 text-[0.9375rem] leading-[1.6] text-texte-attenue">
                  {etape.texte}
                </p>
              </li>
            ))}
          </ol>

          <Bouton
            as={Link}
            href="/comment-ca-marche/louer"
            variante="secondaire"
            className="mt-10"
          >
            {t("parcours.action")}
          </Bouton>
        </div>
      </section>

      {/* ================= Outils ================= */}
      <section className={cn("mx-auto w-full max-w-6xl px-4 sm:px-6", ESPACEMENT.standard)}>
        <TitreSection>{t("outils.titre")}</TitreSection>
        <Chapo>{t("outils.chapo")}</Chapo>

        <div className="mt-10 grid gap-4 md:grid-cols-2">
          {(
            [
              { cle: "permis", href: "/quel-permis-pour-quelle-remorque" },
              { cle: "charge", href: "/calculateur-de-charge" },
            ] as const
          ).map((outil) => (
            <Link
              key={outil.cle}
              href={outil.href}
              className="group rounded-carte border border-bordure bg-fond-eleve p-6 shadow-(--ombre-carte) transition-[box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-(--ombre-carte-active) sm:p-8"
            >
              <h3 className={cn(TITRE.carte, "group-hover:text-accent")}>
                {t(`outils.${outil.cle}.titre`)}
              </h3>
              <p className="mt-3 text-[0.9375rem] leading-[1.6] text-texte-attenue">
                {t(`outils.${outil.cle}.texte`)}
              </p>
              <span className="mt-6 inline-block text-sm font-medium text-accent">
                {t("outils.action")}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* ================= Propriétaires =================
          Dalle encartée plutôt que bandeau à bords vifs : le bloc se détache
          du flux au lieu de le trancher. */}
      <section className="pb-16 sm:pb-24">
        <div className="relative mx-4 overflow-hidden rounded-[1.75rem] bg-encre text-encre-texte sm:mx-6">
          <div className="absolute inset-0">
            <Illustration
              src="/images/proprietaires.webp"
              alt={t("proprietaires.illustration")}
              className="h-full w-full"
              tailles="100vw"
            />
          </div>
          <div aria-hidden className="absolute inset-0 bg-marque-950/60" />
          <div
            aria-hidden
            className="absolute inset-0 bg-linear-to-r from-marque-950/85 via-marque-950/45 to-transparent"
          />

          <div
            className={cn(
              "relative mx-auto w-full max-w-6xl px-6 sm:px-10",
              ESPACEMENT.majeure,
            )}
          >
            <div className="max-w-xl">
              <Surtitre clair>{t("proprietaires.surtitre")}</Surtitre>
              <TitreSection clair className="mt-3">
                {t("proprietaires.titre")}
              </TitreSection>
              <Chapo clair>{t("proprietaires.chapo")}</Chapo>

              <Bouton
                as={Link}
                href="/mettre-en-location"
                taille="grand"
                className="mt-8"
              >
                {t("proprietaires.action")}
              </Bouton>
            </div>
          </div>
        </div>
      </section>

      <DonneesStructurees
        donnees={{
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: t("nomSite"),
          url: base,
          inLanguage: locale,
          potentialAction: {
            "@type": "SearchAction",
            target: {
              "@type": "EntryPoint",
              urlTemplate: `${base}/recherche?ville={search_term_string}`,
            },
            "query-input": "required name=search_term_string",
          },
        }}
      />
    </main>
  );
}
