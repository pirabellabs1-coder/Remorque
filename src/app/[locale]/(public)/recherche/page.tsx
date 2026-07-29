import { getTranslations, setRequestLocale } from "next-intl/server";

import { FormulaireRecherche } from "@/components/recherche/formulaire-recherche";
import { Bouton } from "@/components/ui/bouton";
import { CATEGORIES } from "@/config/categories";
import type { Market } from "@/config/markets";
import { Link } from "@/i18n/navigation";
import { metadonneesPage } from "@/lib/metadonnees";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "recherche" });

  return metadonneesPage({
    locale: locale as Market,
    href: "/recherche",
    titre: t("metaTitre"),
    description: t("metaDescription"),
  });
}

function lire(
  valeur: string | string[] | undefined,
): string | undefined {
  return Array.isArray(valeur) ? valeur[0] : valeur;
}

export default async function PageRecherche({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const criteres = await searchParams;
  const t = await getTranslations("recherche");

  const ville = lire(criteres.ville);
  const slugCategorie = lire(criteres.categorie);
  const categorie = CATEGORIES.find((entree) => entree.slug === slugCategorie);

  /**
   * Le catalogue n'est pas encore branché : la requête géolocalisée arrive
   * avec la base (phase 2). Un résultat vide n'est pas pour autant un état
   * provisoire — c'est l'état réel des premiers jours d'exploitation, que la
   * section 14 du cadrage traite comme le principal risque du projet. Cet
   * écran doit donc rester utile même sans une seule annonce : il propose
   * d'élargir, d'être alerté, ou de devenir soi-même propriétaire.
   */
  const annonces: never[] = [];

  const titre = categorie
    ? ville
      ? t("titreCategorieVille", { categorie: categorie.nom, ville })
      : t("titreCategorie", { categorie: categorie.nom })
    : ville
      ? t("titreVille", { ville })
      : t("titre");

  return (
    <main>
      <div className="border-b border-bordure bg-fond-eleve">
        <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
          <FormulaireRecherche />
        </div>
      </div>

      <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
        <h1 className="text-3xl font-semibold tracking-tight">{titre}</h1>
        <p className="mt-2 text-texte-attenue">
          {t("resultats", { nombre: annonces.length })}
        </p>

        {annonces.length === 0 ? (
          <section className="mt-10 rounded-carte border border-bordure bg-fond-eleve p-8 sm:p-12">
            <h2 className="text-xl font-semibold">{t("vide.titre")}</h2>
            <p className="mt-3 max-w-2xl text-texte-attenue">
              {ville ? t("vide.texteVille", { ville }) : t("vide.texte")}
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Bouton as={Link} href="/mettre-en-location">
                {t("vide.actionProprietaire")}
              </Bouton>
              <Bouton as={Link} href="/recherche" variante="secondaire">
                {t("vide.actionElargir")}
              </Bouton>
            </div>

            <div className="mt-10 border-t border-bordure pt-8">
              <h3 className="text-sm font-medium text-texte-attenue">
                {t("vide.autresCategories")}
              </h3>
              <ul className="mt-4 flex flex-wrap gap-2">
                {CATEGORIES.filter(
                  (entree) => entree.slug !== slugCategorie,
                ).map((entree) => (
                  <li key={entree.slug}>
                    <Link
                      href={{
                        pathname: "/recherche",
                        query: { categorie: entree.slug },
                      }}
                      className="inline-flex rounded-full border border-bordure px-3 py-1.5 text-sm transition-colors hover:border-accent"
                    >
                      {entree.nom}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
