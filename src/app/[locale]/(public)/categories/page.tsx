import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";

import { Illustration } from "@/components/ui/illustration";
import { CATEGORIES } from "@/config/categories";
import { getMarket, type Market } from "@/config/markets";
import { villesDuPays, type CodePays } from "@/config/villes";
import { Link } from "@/i18n/navigation";
import { PRIX_AFFICHE } from "@/lib/cn";
import { metadonneesPage } from "@/lib/metadonnees";
import { compterAnnoncesParCategorie } from "@/server/annonces/catalogue";

type Props = { params: Promise<{ locale: string }> };

/** Villes proposées sous la grille, pour croiser les deux axes. */
const VILLES_PROPOSEES = 12;

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "pageCategories" });

  return metadonneesPage({
    locale: locale as Market,
    href: "/categories",
    titre: t("metaTitre"),
    description: t("metaDescription"),
  });
}

/**
 * Index des types de matériel.
 *
 * Elle manquait, alors que les dix pages de catégorie existent : elles
 * n'avaient donc aucun parent, ni dans la navigation ni pour les moteurs, qui
 * lisent la hiérarchie d'un site autant que ses pages.
 *
 * Chaque carte porte son décompte réel. Zéro s'affiche comme zéro : une
 * catégorie vide est une information utile — pour le visiteur qui cherche
 * ailleurs, et pour le propriétaire qui découvre une place à prendre.
 */
export default async function PageCategories({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("pageCategories");
  const format = await getFormatter();

  const decomptes = await compterAnnoncesParCategorie();
  const devise = getMarket(locale as Market).currency;

  const villes = villesDuPays(
    getMarket(locale as Market).country as CodePays,
  ).slice(0, VILLES_PROPOSEES);

  return (
    <main>
      <section className="border-b border-bordure bg-fond-doux">
        <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
          <nav aria-label={t("filAriane")}>
            <ol className="flex flex-wrap items-center gap-2 text-sm text-texte-attenue">
              <li>
                <Link href="/" className="hover:text-texte">
                  {t("accueil")}
                </Link>
              </li>
              <li aria-hidden>/</li>
              <li aria-current="page" className="text-texte">
                {t("courant")}
              </li>
            </ol>
          </nav>

          <h1 className="mt-6 max-w-3xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            {t("titre")}
          </h1>
          <span
            aria-hidden
            className="mt-4 block h-1 w-12 rounded-full bg-accent"
          />
          <p className="mt-5 max-w-2xl text-[1.0625rem] text-texte-attenue">
            {t("chapo")}
          </p>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {CATEGORIES.map((categorie) => {
            const compte = decomptes.get(categorie.slug);

            return (
              <li key={categorie.slug}>
                <Link
                  href={{
                    pathname: "/categories/[categorie]",
                    params: { categorie: categorie.slug },
                  }}
                  className="group block overflow-hidden rounded-carte border border-bordure bg-fond-eleve shadow-(--ombre-carte) transition-colors hover:border-accent"
                >
                  <Illustration
                    src={categorie.photo}
                    alt={categorie.alt}
                    className="aspect-16/10 w-full"
                    tailles="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 92vw"
                  />

                  <div className="p-5">
                    <h2 className="font-semibold group-hover:text-accent">
                      {categorie.nom}
                    </h2>
                    <p className="mt-1 text-sm text-texte-attenue">
                      {categorie.usages}
                    </p>

                    {/* Le décompte réel, zéro compris : une catégorie vide dit
                        au visiteur d'aller voir ailleurs, et au propriétaire
                        qu'il y a une place à prendre. */}
                    <p className="mt-4 text-sm font-medium">
                      {compte && compte.nombre > 0 ? (
                        <>
                          {t("disponibles", { nombre: compte.nombre })}
                          <span className="text-texte-attenue">
                            {" · "}
                            {t("apartir", {
                              prix: format.number(compte.prixMinimum / 100, {
                                ...PRIX_AFFICHE,
                                currency: devise,
                              }),
                            })}
                          </span>
                        </>
                      ) : (
                        <span className="text-texte-attenue">
                          {t("aucune")}
                        </span>
                      )}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Croisement des deux axes : c'est lui qui porte la longue traîne. */}
      <section className="bg-fond-doux">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <h2 className="text-2xl font-semibold tracking-tight">
            {t("parVille")}
          </h2>
          <ul className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {villes.map((ville) => (
              <li key={ville.slug}>
                <Link
                  href={{
                    pathname: "/location-remorque/[ville]",
                    params: { ville: ville.slug },
                  }}
                  className="block rounded-champ border border-bordure bg-fond-eleve px-4 py-3 text-[0.9375rem] transition-colors hover:border-accent hover:text-accent"
                >
                  {ville.nom}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}
