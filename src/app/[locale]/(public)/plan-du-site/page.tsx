import { getTranslations, setRequestLocale } from "next-intl/server";

import { CATEGORIES } from "@/config/categories";
import { getMarket, type Market } from "@/config/markets";
import { villesDuPays, type CodePays } from "@/config/villes";
import { Link } from "@/i18n/navigation";
import { metadonneesPage } from "@/lib/metadonnees";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "planDuSite" });

  return metadonneesPage({
    locale: locale as Market,
    href: "/plan-du-site",
    titre: t("metaTitre"),
    description: t("metaDescription"),
  });
}

/**
 * Plan du site.
 *
 * Le fichier `sitemap.xml` s'adresse aux moteurs ; cette page s'adresse aux
 * humains — et aux moteurs par surcroît, puisqu'elle offre un chemin en un
 * clic vers chaque page de ville et de catégorie. Sur une place de marché
 * locale dont les pages locales portent l'essentiel du trafic, un maillage qui
 * n'existe que dans un fichier XML laisse ces pages à trois ou quatre clics de
 * l'accueil ; ici, elles sont à un.
 *
 * Elle ne liste que le marché servi : les villes belges n'ont rien à faire
 * dans le plan du site français, dont elles ne sont pas atteignables.
 */
export default async function PagePlanDuSite({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("planDuSite");
  const villes = villesDuPays(getMarket(locale as Market).country as CodePays);

  const rubriques = [
    {
      titre: t("louer"),
      liens: [
        { href: "/recherche" as const, libelle: t("liens.recherche") },
        { href: "/categories" as const, libelle: t("liens.categories") },
        { href: "/comment-ca-marche/louer" as const, libelle: t("liens.commentLouer") },
        { href: "/tarifs" as const, libelle: t("liens.tarifs") },
      ],
    },
    {
      titre: t("mettreEnLocation"),
      liens: [
        { href: "/mettre-en-location" as const, libelle: t("liens.mettreEnLocation") },
        {
          href: "/comment-ca-marche/mettre-en-location" as const,
          libelle: t("liens.commentMettre"),
        },
        { href: "/pro" as const, libelle: t("liens.pro") },
      ],
    },
    {
      titre: t("comprendre"),
      liens: [
        { href: "/comment-ca-marche" as const, libelle: t("liens.commentCaMarche") },
        { href: "/assurance" as const, libelle: t("liens.assurance") },
        {
          href: "/quel-permis-pour-quelle-remorque" as const,
          libelle: t("liens.permis"),
        },
        { href: "/calculateur-de-charge" as const, libelle: t("liens.charge") },
        { href: "/aide" as const, libelle: t("liens.aide") },
      ],
    },
    {
      titre: t("plateforme"),
      liens: [
        { href: "/a-propos" as const, libelle: t("liens.aPropos") },
        { href: "/contact" as const, libelle: t("liens.contact") },
        { href: "/connexion" as const, libelle: t("liens.connexion") },
        { href: "/inscription" as const, libelle: t("liens.inscription") },
      ],
    },
    {
      titre: t("legal"),
      liens: [
        { href: "/cgu" as const, libelle: t("liens.cgu") },
        { href: "/cgv" as const, libelle: t("liens.cgv") },
        { href: "/confidentialite" as const, libelle: t("liens.confidentialite") },
        { href: "/cookies" as const, libelle: t("liens.cookies") },
        { href: "/mentions-legales" as const, libelle: t("liens.mentionsLegales") },
        { href: "/mediation" as const, libelle: t("liens.mediation") },
      ],
    },
  ];

  const lien =
    "text-[0.9375rem] text-texte-attenue underline-offset-4 hover:text-accent hover:underline";

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        {t("titre")}
      </h1>
      <span aria-hidden className="mt-4 block h-1 w-12 rounded-full bg-accent" />
      <p className="mt-5 max-w-2xl text-[1.0625rem] text-texte-attenue">
        {t("chapo")}
      </p>

      <div className="mt-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
        {rubriques.map((rubrique) => (
          <section key={rubrique.titre}>
            <h2 className="text-[0.6875rem] font-semibold tracking-[0.14em] text-texte-attenue uppercase">
              {rubrique.titre}
            </h2>
            <ul className="mt-4 space-y-2">
              {rubrique.liens.map((entree) => (
                <li key={entree.href}>
                  <Link href={entree.href} className={lien}>
                    {entree.libelle}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <section className="mt-14 border-t border-bordure pt-10">
        <h2 className="text-xl font-semibold tracking-tight">
          {t("parType")}
        </h2>
        <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-2">
          {CATEGORIES.map((categorie) => (
            <li key={categorie.slug}>
              <Link
                href={{
                  pathname: "/categories/[categorie]",
                  params: { categorie: categorie.slug },
                }}
                className={lien}
              >
                {categorie.nom}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-12 border-t border-bordure pt-10">
        <h2 className="text-xl font-semibold tracking-tight">{t("parVille")}</h2>
        <p className="mt-2 text-sm text-texte-attenue">
          {t("parVilleAide", { nombre: villes.length })}
        </p>
        <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-2">
          {villes.map((ville) => (
            <li key={ville.slug}>
              <Link
                href={{
                  pathname: "/location-remorque/[ville]",
                  params: { ville: ville.slug },
                }}
                className={lien}
              >
                {ville.nom}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
