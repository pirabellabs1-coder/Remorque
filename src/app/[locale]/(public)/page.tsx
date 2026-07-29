import { getTranslations, setRequestLocale } from "next-intl/server";

import { FormulaireRecherche } from "@/components/recherche/formulaire-recherche";
import { Bouton } from "@/components/ui/bouton";
import { DonneesStructurees } from "@/components/ui/carte";
import { Illustration } from "@/components/ui/illustration";
import { CATEGORIES } from "@/config/categories";
import { clientEnv } from "@/config/env-client";
import type { Market } from "@/config/markets";
import { Link } from "@/i18n/navigation";
import { metadonneesPage } from "@/lib/metadonnees";

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
          Voile de lisibilité, en deux couches.
          Un simple dégradé horizontal ne suffit pas : sur un écran étroit,
          seule son extrémité opaque reste visible et la photographie
          disparaît entièrement. On superpose donc un voile uniforme, qui
          garantit le contraste du texte partout, et un dégradé latéral qui
          renforce le seul côté portant le titre (M21 — contrastes).
        */}
        <div aria-hidden className="absolute inset-0 bg-marque-950/55" />
        <div
          aria-hidden
          className="absolute inset-0 bg-linear-to-r from-marque-950/80 via-marque-950/40 to-transparent"
        />

        <div className="relative mx-auto w-full max-w-6xl px-4 pt-20 pb-40 sm:px-6 sm:pt-28 sm:pb-48">
          <p className="text-sm font-medium tracking-[0.2em] text-encre-texte-attenue uppercase">
            {t("hero.surtitre")}
          </p>
          <h1 className="mt-5 max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
            {t("titre")}
          </h1>
          <p className="mt-6 max-w-xl text-lg text-pretty text-encre-texte-attenue">
            {t("sousTitre")}
          </p>

          <div className="mt-10 flex flex-wrap gap-3">
            <Bouton as={Link} href="/recherche" taille="grand">
              {t("hero.actionLocataire")}
            </Bouton>
            <Bouton
              as={Link}
              href="/mettre-en-location"
              taille="grand"
              className="border border-encre-bordure bg-white/10 text-encre-texte hover:bg-white/20"
            >
              {t("hero.actionProprietaire")}
            </Bouton>
          </div>
        </div>
      </section>

      {/* Carte de recherche, à cheval sur la limite des deux sections. */}
      <div className="relative z-10 mx-auto -mt-28 w-full max-w-6xl px-4 sm:px-6">
        <div className="rounded-carte border border-bordure bg-fond-eleve p-4 shadow-[0_24px_60px_-24px_rgb(13_27_69/0.45)] sm:p-6">
          <h2 className="px-1 pb-3 text-sm font-semibold">
            {t("hero.titreRecherche")}
          </h2>
          <FormulaireRecherche variante="nu" />
        </div>

        <ul className="mt-6 grid gap-x-8 gap-y-3 text-sm text-texte-attenue sm:grid-cols-3">
          <li className="flex gap-2">
            <span aria-hidden className="text-accent">
              ●
            </span>
            {t("reassurance.assurance")}
          </li>
          <li className="flex gap-2">
            <span aria-hidden className="text-accent">
              ●
            </span>
            {t("reassurance.paiement")}
          </li>
          <li className="flex gap-2">
            <span aria-hidden className="text-accent">
              ●
            </span>
            {t("reassurance.proximite")}
          </li>
        </ul>
      </div>

      {/* ================= Catalogue ================= */}
      <section className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              {t("categories.titre")}
            </h2>
            <p className="mt-4 text-texte-attenue">{t("categories.chapo")}</p>
          </div>
          <Link
            href="/recherche"
            className="text-sm font-medium text-accent underline-offset-4 hover:underline"
          >
            {t("categories.action")}
          </Link>
        </div>

        {/* Dix catégories : deux colonnes sur mobile, cinq sur grand écran —
            deux rangées pleines dans les deux cas, jamais de ligne orpheline. */}
        <ul className="mt-10 grid grid-cols-2 gap-4 lg:grid-cols-5">
          {CATEGORIES.map((entree) => (
            <li key={entree.slug}>
              <Link
                href={{
                  pathname: "/recherche",
                  query: { categorie: entree.slug },
                }}
                className="group block overflow-hidden rounded-carte border border-bordure bg-fond-eleve transition-shadow hover:shadow-lg"
              >
                <Illustration
                  src={entree.photo}
                  alt={entree.alt}
                  className="aspect-3/2 w-full"
                  tailles="(min-width: 1024px) 20vw, 50vw"
                />
                <div className="p-4">
                  <p className="font-medium group-hover:text-accent">
                    {entree.nom}
                  </p>
                  <p className="mt-1 text-sm text-texte-attenue">
                    {entree.usages}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* ================= Parcours ================= */}
      <section className="bg-fond-doux">
        <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
          <div className="max-w-2xl">
            <p className="text-sm font-medium tracking-[0.2em] text-accent uppercase">
              {t("parcours.surtitre")}
            </p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
              {t("parcours.titre")}
            </h2>
            <p className="mt-4 text-texte-attenue">{t("parcours.chapo")}</p>
          </div>

          <ol className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {etapes.map((etape, index) => (
              <li key={etape.titre} className="relative">
                <div className="flex items-center gap-4">
                  <span
                    aria-hidden
                    className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-accent text-lg font-semibold text-accent-contraste"
                  >
                    {index + 1}
                  </span>
                  {/* Trait de liaison, masqué sur la dernière étape et sur les
                      petits écrans où les étapes s'empilent. */}
                  {index < etapes.length - 1 ? (
                    <span
                      aria-hidden
                      className="hidden h-px flex-1 bg-marque-200 lg:block"
                    />
                  ) : null}
                </div>
                <h3 className="mt-5 font-semibold">{etape.titre}</h3>
                <p className="mt-2 text-sm text-texte-attenue">{etape.texte}</p>
              </li>
            ))}
          </ol>

          <Bouton
            as={Link}
            href="/comment-ca-marche/louer"
            variante="secondaire"
            className="mt-12"
          >
            {t("parcours.action")}
          </Bouton>
        </div>
      </section>

      {/* ================= Confiance ================= */}
      <section className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center lg:gap-16">
          <Illustration
            src="/images/etat-des-lieux.webp"
            alt={t("confiance.illustration")}
            className="aspect-4/3 w-full rounded-carte"
            tailles="(min-width: 1024px) 50vw, 100vw"
          />

          <div>
            <p className="text-sm font-medium tracking-[0.2em] text-accent uppercase">
              {t("confiance.surtitre")}
            </p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
              {t("confiance.titre")}
            </h2>
            <p className="mt-4 text-texte-attenue">{t("confiance.chapo")}</p>

            <dl className="mt-10 space-y-8">
              {garanties.map((cle) => (
                <div key={cle} className="border-t border-bordure pt-6">
                  <dt className="font-semibold">
                    {t(`confiance.${cle}.titre`)}
                  </dt>
                  <dd className="mt-2 text-sm text-texte-attenue">
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

      {/* ================= Outils ================= */}
      <section className="bg-fond-doux">
        <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              {t("outils.titre")}
            </h2>
            <p className="mt-4 text-texte-attenue">{t("outils.chapo")}</p>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-2">
            <Link
              href="/quel-permis-pour-quelle-remorque"
              className="group rounded-carte border border-bordure bg-fond-eleve p-6 transition-colors hover:border-accent sm:p-8"
            >
              <h3 className="text-lg font-semibold group-hover:text-accent">
                {t("outils.permis.titre")}
              </h3>
              <p className="mt-3 text-sm text-texte-attenue">
                {t("outils.permis.texte")}
              </p>
              <span className="mt-6 inline-block text-sm font-medium text-accent">
                {t("outils.action")}
              </span>
            </Link>
            <Link
              href="/calculateur-de-charge"
              className="group rounded-carte border border-bordure bg-fond-eleve p-6 transition-colors hover:border-accent sm:p-8"
            >
              <h3 className="text-lg font-semibold group-hover:text-accent">
                {t("outils.charge.titre")}
              </h3>
              <p className="mt-3 text-sm text-texte-attenue">
                {t("outils.charge.texte")}
              </p>
              <span className="mt-6 inline-block text-sm font-medium text-accent">
                {t("outils.action")}
              </span>
            </Link>
          </div>
        </div>
      </section>

      {/* ================= Propriétaires ================= */}
      <section className="relative overflow-hidden bg-encre text-encre-texte">
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

        <div className="relative mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
          <div className="max-w-2xl">
            <p className="text-sm font-medium tracking-[0.2em] text-encre-texte-attenue uppercase">
              {t("proprietaires.surtitre")}
            </p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              {t("proprietaires.titre")}
            </h2>
            <p className="mt-5 text-encre-texte-attenue">
              {t("proprietaires.chapo")}
            </p>

            <div className="mt-10 flex flex-wrap gap-3">
              <Bouton as={Link} href="/mettre-en-location" taille="grand">
                {t("proprietaires.action")}
              </Bouton>
              <Bouton
                as={Link}
                href="/pro"
                taille="grand"
                className="border border-encre-bordure bg-white/10 text-encre-texte hover:bg-white/20"
              >
                {t("proprietaires.actionPro")}
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
