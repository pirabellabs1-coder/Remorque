import { getTranslations, setRequestLocale } from "next-intl/server";

import { Etapes } from "@/components/marketing/etapes";
import { FormulaireRecherche } from "@/components/recherche/formulaire-recherche";
import { Bouton } from "@/components/ui/bouton";
import { Carte, DonneesStructurees } from "@/components/ui/carte";
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

  return (
    <main>
      {/* --- Recherche ---------------------------------------------------- */}
      <section className="border-b border-bordure bg-fond-eleve">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <h1 className="max-w-3xl text-balance text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
            {t("titre")}
          </h1>
          <p className="mt-6 max-w-2xl text-pretty text-lg text-texte-attenue">
            {t("sousTitre")}
          </p>

          <div className="mt-10">
            <FormulaireRecherche />
          </div>

          <ul className="mt-8 flex flex-wrap gap-x-8 gap-y-3 text-sm text-texte-attenue">
            <li>{t("reassurance.assurance")}</li>
            <li>{t("reassurance.paiement")}</li>
            <li>{t("reassurance.proximite")}</li>
          </ul>
        </div>
      </section>

      {/* --- Catalogue ---------------------------------------------------- */}
      <section className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
        <h2 className="text-3xl font-semibold tracking-tight">
          {t("categories.titre")}
        </h2>
        <p className="mt-3 max-w-2xl text-texte-attenue">
          {t("categories.chapo")}
        </p>

        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CATEGORIES.map((entree) => (
            <li key={entree.slug}>
              <Link
                href={{
                  pathname: "/recherche",
                  query: { categorie: entree.slug },
                }}
                className="flex h-full flex-col rounded-carte border border-bordure bg-fond-eleve p-5 transition-colors hover:border-accent"
              >
                <span className="font-medium">{entree.nom}</span>
                <span className="mt-1.5 text-sm text-texte-attenue">
                  {entree.usages}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* --- Parcours ----------------------------------------------------- */}
      <section className="border-y border-bordure bg-fond-eleve">
        <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
          <h2 className="text-3xl font-semibold tracking-tight">
            {t("parcours.titre")}
          </h2>
          <p className="mt-3 max-w-2xl text-texte-attenue">
            {t("parcours.chapo")}
          </p>

          <div className="mt-10">
            <Etapes etapes={etapes} />
          </div>

          <Bouton
            as={Link}
            href="/comment-ca-marche/louer"
            variante="secondaire"
            className="mt-8"
          >
            {t("parcours.action")}
          </Bouton>
        </div>
      </section>

      {/* --- Confiance ---------------------------------------------------- */}
      <section className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
        <h2 className="text-3xl font-semibold tracking-tight">
          {t("confiance.titre")}
        </h2>
        <p className="mt-3 max-w-2xl text-texte-attenue">
          {t("confiance.chapo")}
        </p>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          <Carte>
            <h3 className="font-semibold">{t("confiance.assurance.titre")}</h3>
            <p className="mt-2 text-sm text-texte-attenue">
              {t("confiance.assurance.texte")}
            </p>
          </Carte>
          <Carte>
            <h3 className="font-semibold">{t("confiance.caution.titre")}</h3>
            <p className="mt-2 text-sm text-texte-attenue">
              {t("confiance.caution.texte")}
            </p>
          </Carte>
          <Carte>
            <h3 className="font-semibold">
              {t("confiance.etatDesLieux.titre")}
            </h3>
            <p className="mt-2 text-sm text-texte-attenue">
              {t("confiance.etatDesLieux.texte")}
            </p>
          </Carte>
        </div>
      </section>

      {/* --- Outils ------------------------------------------------------- */}
      <section className="border-y border-bordure bg-fond-eleve">
        <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
          <h2 className="text-3xl font-semibold tracking-tight">
            {t("outils.titre")}
          </h2>
          <p className="mt-3 max-w-2xl text-texte-attenue">
            {t("outils.chapo")}
          </p>

          <div className="mt-10 grid gap-4 md:grid-cols-2">
            <Link
              href="/quel-permis-pour-quelle-remorque"
              className="rounded-carte border border-bordure p-6 transition-colors hover:border-accent"
            >
              <h3 className="font-semibold">{t("outils.permis.titre")}</h3>
              <p className="mt-2 text-sm text-texte-attenue">
                {t("outils.permis.texte")}
              </p>
            </Link>
            <Link
              href="/calculateur-de-charge"
              className="rounded-carte border border-bordure p-6 transition-colors hover:border-accent"
            >
              <h3 className="font-semibold">{t("outils.charge.titre")}</h3>
              <p className="mt-2 text-sm text-texte-attenue">
                {t("outils.charge.texte")}
              </p>
            </Link>
          </div>
        </div>
      </section>

      {/* --- Propriétaires ------------------------------------------------ */}
      <section className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
        <div className="rounded-carte border border-bordure bg-fond-eleve p-8 sm:p-12">
          <h2 className="max-w-2xl text-balance text-3xl font-semibold tracking-tight">
            {t("proprietaires.titre")}
          </h2>
          <p className="mt-4 max-w-2xl text-texte-attenue">
            {t("proprietaires.chapo")}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Bouton as={Link} href="/mettre-en-location" taille="grand">
              {t("proprietaires.action")}
            </Bouton>
            <Bouton
              as={Link}
              href="/comment-ca-marche/mettre-en-location"
              variante="secondaire"
              taille="grand"
            >
              {t("proprietaires.actionSecondaire")}
            </Bouton>
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
