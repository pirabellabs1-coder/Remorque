import { getFormatter, getTranslations } from "next-intl/server";

import { CarteAnnonce } from "@/components/annonce/carte-annonce";
import { FormulaireRecherche } from "@/components/recherche/formulaire-recherche";
import { Bouton } from "@/components/ui/bouton";
import { DonneesStructurees } from "@/components/ui/carte";
import { ESPACEMENT, TITRE, TitreSection } from "@/components/ui/typographie";
import { CATEGORIES, type DefinitionCategorie } from "@/config/categories";
import { clientEnv } from "@/config/env-client";
import { MARKETS, type Market } from "@/config/markets";
import { villesVoisines, type Ville } from "@/config/villes";
import { Link, getPathname } from "@/i18n/navigation";
import { cn, PRIX_AFFICHE } from "@/lib/cn";
import {
  annoncesDeLaVille,
  compterCategoriesDansLaVille,
  prixMinimumDansLaVille,
} from "@/server/annonces/catalogue";

/**
 * Corps d'une page locale — `/location-remorque/[ville]` et son croisement
 * avec une catégorie.
 *
 * Ces pages sont l'actif de référencement du projet : elles portent 60 à 80 %
 * du trafic attendu. Deux principes les gouvernent.
 *
 * **Tout chiffre affiché est compté sur le catalogue réel.** Nombre d'annonces,
 * prix d'appel, répartition par catégorie : rien n'est saisi à la main. Une
 * page locale qui annonce un volume qu'elle n'a pas est une allégation
 * trompeuse, et se retourne contre la plateforme au premier signalement.
 *
 * **Une page sans annonce reste utile.** C'est l'état normal des premiers
 * mois : les pages de ville mettent trois à six mois à se positionner et
 * doivent être en ligne avant l'ouverture. Elles captent alors la demande et
 * indiquent où recruter des propriétaires.
 */
export async function ContenuLocal({
  locale,
  ville,
  categorie,
}: {
  locale: Market;
  ville: Ville;
  categorie?: DefinitionCategorie;
}) {
  const t = await getTranslations("pageLocale");
  const format = await getFormatter();
  const devise = MARKETS[locale].currency;
  const base = clientEnv.NEXT_PUBLIC_SITE_URL;

  const annonces = await annoncesDeLaVille(ville.slug, categorie?.slug);
  const parCategorie = await compterCategoriesDansLaVille(ville.slug);
  const prixMinimum = await prixMinimumDansLaVille(ville.slug, categorie?.slug);
  const voisines = villesVoisines(ville);

  const titre = categorie
    ? t("titreCategorie", {
        categorie: categorie.nomEnPhrase,
        ville: ville.nom,
      })
    : t("titre", { ville: ville.nom });

  const prix = (centimes: number) =>
    format.number(centimes / 100, { ...PRIX_AFFICHE, currency: devise });

  const adresse = (chemin: string) => new URL(chemin, base).toString();

  const questions = [
    { question: t("faq.q1", { ville: ville.nom }), reponse: t("faq.r1") },
    { question: t("faq.q2"), reponse: t("faq.r2") },
    { question: t("faq.q3", { ville: ville.nom }), reponse: t("faq.r3") },
  ];

  return (
    <main>
      {/* ================= En-tête locale ================= */}
      <section className="border-b border-bordure bg-fond-eleve">
        <div className="mx-auto w-full max-w-6xl px-4 pt-10 pb-12 sm:px-6">
          <nav aria-label={t("filAriane")}>
            <ol className="flex flex-wrap items-center gap-2 text-sm text-texte-attenue">
              <li>
                <Link href="/" className="hover:text-texte">
                  {t("accueil")}
                </Link>
              </li>
              <li aria-hidden>/</li>
              {categorie ? (
                <>
                  <li>
                    <Link
                      href={{
                        pathname: "/location-remorque/[ville]",
                        params: { ville: ville.slug },
                      }}
                      className="hover:text-texte"
                    >
                      {ville.nom}
                    </Link>
                  </li>
                  <li aria-hidden>/</li>
                  <li aria-current="page" className="text-texte">
                    {categorie.nom}
                  </li>
                </>
              ) : (
                <li aria-current="page" className="text-texte">
                  {ville.nom}
                </li>
              )}
            </ol>
          </nav>

          <h1 className={cn(TITRE.section, "mt-5 text-balance")}>{titre}</h1>

          {/* Aucun chiffre n'est affiché s'il n'existe pas. */}
          <p className="mt-4 text-[1.0625rem] text-texte-attenue">
            {annonces.length > 0
              ? t("resume", {
                  nombre: annonces.length,
                  ville: ville.nom,
                  prix: prixMinimum ? prix(prixMinimum) : "",
                })
              : t("resumeVide", { ville: ville.nom })}
          </p>

          <div className="mt-8 max-w-2xl">
            <FormulaireRecherche variante="carte" valeurInitiale={ville.nom} />
          </div>
        </div>
      </section>

      {/* ================= Annonces ================= */}
      <section
        className={cn("mx-auto w-full max-w-6xl px-4 sm:px-6", ESPACEMENT.standard)}
      >
        {annonces.length > 0 ? (
          <>
            <TitreSection>
              {categorie
                ? t("annoncesCategorie", {
                    categorie: categorie.nom,
                    ville: ville.nom,
                  })
                : t("annonces", { ville: ville.nom })}
            </TitreSection>
            <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {annonces.map((annonce) => (
                <li key={annonce.id}>
                  <CarteAnnonce annonce={annonce} />
                </li>
              ))}
            </ul>
          </>
        ) : (
          <div className="rounded-carte border border-bordure bg-fond-eleve p-8 shadow-(--ombre-carte) sm:p-12">
            <h2 className={TITRE.carte}>{t("vide.titre", { ville: ville.nom })}</h2>
            <p className="mt-3 max-w-2xl text-texte-attenue">
              {t("vide.texte", { ville: ville.nom })}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Bouton as={Link} href="/mettre-en-location">
                {t("vide.actionProprietaire")}
              </Bouton>
              <Bouton as={Link} href="/recherche" variante="secondaire">
                {t("vide.actionRecherche")}
              </Bouton>
            </div>
          </div>
        )}
      </section>

      {/* ================= Croisement ville × catégorie =================
          C'est la longue traîne : « remorque benne à Lyon » se cherche
          davantage que « location de remorque ». */}
      <section className="bg-fond-doux">
        <div
          className={cn("mx-auto w-full max-w-6xl px-4 sm:px-6", ESPACEMENT.standard)}
        >
          <TitreSection>{t("categories", { ville: ville.nom })}</TitreSection>

          <ul className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {CATEGORIES.map((entree) => {
              const nombre = parCategorie.get(entree.slug) ?? 0;
              const active = categorie?.slug === entree.slug;

              return (
                <li key={entree.slug}>
                  <Link
                    href={{
                      pathname: "/location-remorque/[ville]/[type]",
                      params: { ville: ville.slug, type: entree.slug },
                    }}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center justify-between gap-4 rounded-champ border bg-fond-eleve px-4 py-3 transition-colors",
                      active
                        ? "border-accent"
                        : "border-bordure hover:border-accent",
                    )}
                  >
                    <span className="text-[0.9375rem] font-medium">
                      {t("categorieDansVille", {
                        categorie: entree.nom,
                        ville: ville.nom,
                      })}
                    </span>
                    {/* Le compte n'apparaît que s'il y a quelque chose à
                        compter : « 0 annonce » décourage sans informer. */}
                    {nombre > 0 ? (
                      <span className="shrink-0 text-sm tabular-nums text-texte-attenue">
                        {nombre}
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* ================= Maillage interne ================= */}
      <section
        className={cn("mx-auto w-full max-w-6xl px-4 sm:px-6", ESPACEMENT.standard)}
      >
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <TitreSection>{t("voisines", { ville: ville.nom })}</TitreSection>
            <ul className="mt-8 flex flex-wrap gap-2">
              {voisines.map((voisine) => (
                <li key={voisine.slug}>
                  <Link
                    href={{
                      pathname: "/location-remorque/[ville]",
                      params: { ville: voisine.slug },
                    }}
                    className="inline-flex items-baseline gap-2 rounded-full border border-bordure bg-fond-eleve px-3 py-1.5 text-sm transition-colors hover:border-accent"
                  >
                    {voisine.nom}
                    <span className="text-xs tabular-nums text-texte-attenue">
                      {t("distance", { km: voisine.distanceKm })}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <TitreSection>{t("avantDeLouer")}</TitreSection>
            <ul className="mt-8 space-y-3">
              <li>
                <Link
                  href="/quel-permis-pour-quelle-remorque"
                  className="block rounded-champ border border-bordure bg-fond-eleve px-4 py-3 text-[0.9375rem] transition-colors hover:border-accent"
                >
                  {t("lienPermis")}
                </Link>
              </li>
              <li>
                <Link
                  href="/calculateur-de-charge"
                  className="block rounded-champ border border-bordure bg-fond-eleve px-4 py-3 text-[0.9375rem] transition-colors hover:border-accent"
                >
                  {t("lienCharge")}
                </Link>
              </li>
              <li>
                <Link
                  href="/assurance"
                  className="block rounded-champ border border-bordure bg-fond-eleve px-4 py-3 text-[0.9375rem] transition-colors hover:border-accent"
                >
                  {t("lienAssurance")}
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* ================= Questions fréquentes ================= */}
      <section className="bg-fond-doux">
        <div
          className={cn("mx-auto w-full max-w-3xl px-4 sm:px-6", ESPACEMENT.standard)}
        >
          <TitreSection>{t("faq.titre")}</TitreSection>
          <dl className="mt-10 space-y-6">
            {questions.map((entree) => (
              <div key={entree.question} className="border-t border-bordure pt-6">
                <dt className={TITRE.carte}>{entree.question}</dt>
                <dd className="mt-2 text-[0.9375rem] leading-[1.6] text-texte-attenue">
                  {entree.reponse}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <DonneesStructurees
        donnees={[
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              {
                "@type": "ListItem",
                position: 1,
                name: t("accueil"),
                item: adresse(getPathname({ locale, href: "/" })),
              },
              {
                "@type": "ListItem",
                position: 2,
                name: ville.nom,
                item: adresse(
                  getPathname({
                    locale,
                    href: {
                      pathname: "/location-remorque/[ville]",
                      params: { ville: ville.slug },
                    },
                  }),
                ),
              },
              ...(categorie
                ? [
                    {
                      "@type": "ListItem",
                      position: 3,
                      name: categorie.nom,
                      item: adresse(
                        getPathname({
                          locale,
                          href: {
                            pathname: "/location-remorque/[ville]/[type]",
                            params: { ville: ville.slug, type: categorie.slug },
                          },
                        }),
                      ),
                    },
                  ]
                : []),
            ],
          },
          {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: questions.map((entree) => ({
              "@type": "Question",
              name: entree.question,
              acceptedAnswer: { "@type": "Answer", text: entree.reponse },
            })),
          },
        ]}
      />
    </main>
  );
}
