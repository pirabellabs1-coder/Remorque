import { getTranslations, setRequestLocale } from "next-intl/server";

import { CarteAnnonce } from "@/components/annonce/carte-annonce";
import { FormulaireRecherche } from "@/components/recherche/formulaire-recherche";
import { Bouton } from "@/components/ui/bouton";
import { CATEGORIES } from "@/config/categories";
import type { Market } from "@/config/markets";
import { Link } from "@/i18n/navigation";
import { metadonneesPage } from "@/lib/metadonnees";
import { cn } from "@/lib/cn";
import { TRIS, estTri, rechercherAnnonces } from "@/server/annonces/catalogue";

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

function lire(valeur: string | string[] | undefined): string | undefined {
  return Array.isArray(valeur) ? valeur[0] : valeur;
}

export default async function PageRecherche({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const parametres = await searchParams;
  const t = await getTranslations("recherche");

  const ville = lire(parametres.ville);
  const slugCategorie = lire(parametres.categorie);
  const triDemande = lire(parametres.tri);
  const tri = estTri(triDemande) ? triDemande : "pertinence";

  const categorie = CATEGORIES.find((entree) => entree.slug === slugCategorie);
  const { annonces, total } = await rechercherAnnonces({
    ville,
    categorie: categorie?.slug,
    tri,
  });

  const titre = categorie
    ? ville
      ? t("titreCategorieVille", { categorie: categorie.nom, ville })
      : t("titreCategorie", { categorie: categorie.nom })
    : ville
      ? t("titreVille", { ville })
      : t("titre");

  /** Conserve les critères courants en changeant une seule clé. */
  const avec = (modifications: Record<string, string | undefined>) => {
    const requete: Record<string, string> = {};
    if (ville) requete.ville = ville;
    if (slugCategorie) requete.categorie = slugCategorie;
    if (tri !== "pertinence") requete.tri = tri;

    for (const [cle, valeur] of Object.entries(modifications)) {
      if (valeur === undefined) delete requete[cle];
      else requete[cle] = valeur;
    }
    return requete;
  };

  return (
    <main>
      {/* Barre de recherche persistante : on affine sans revenir en arrière. */}
      <div className="sticky top-16 z-30 border-b border-bordure bg-fond-eleve/95 backdrop-blur">
        <div className="mx-auto w-full max-w-7xl px-4 py-4 sm:px-6">
          <FormulaireRecherche variante="nu" />
        </div>
      </div>

      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
        {/* Filtres par catégorie, sous forme de pastilles défilables. */}
        <nav aria-label={t("filtres.categorie")} className="-mx-4 px-4 sm:mx-0 sm:px-0">
          <ul className="flex gap-2 overflow-x-auto pb-2">
            <li>
              <Link
                href={{
                  pathname: "/recherche",
                  query: avec({ categorie: undefined }),
                }}
                aria-current={!categorie ? "page" : undefined}
                className={cn(
                  "inline-flex whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm transition-colors",
                  !categorie
                    ? "border-accent bg-accent text-accent-contraste"
                    : "border-bordure hover:border-accent",
                )}
              >
                {t("filtres.tout")}
              </Link>
            </li>
            {CATEGORIES.map((entree) => {
              const actif = entree.slug === slugCategorie;
              return (
                <li key={entree.slug}>
                  <Link
                    href={{
                      pathname: "/recherche",
                      query: avec({ categorie: entree.slug }),
                    }}
                    aria-current={actif ? "page" : undefined}
                    className={cn(
                      "inline-flex whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm transition-colors",
                      actif
                        ? "border-accent bg-accent text-accent-contraste"
                        : "border-bordure hover:border-accent",
                    )}
                  >
                    {entree.nom}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="mt-6 flex flex-wrap items-baseline justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              {titre}
            </h1>
            <p className="mt-1 text-sm text-texte-attenue">
              {t("resultats", { nombre: total })}
            </p>
          </div>

          {total > 0 ? (
            <nav aria-label={t("tri.label")} className="flex flex-wrap gap-1">
              {TRIS.map((valeur) => (
                <Link
                  key={valeur}
                  href={{
                    pathname: "/recherche",
                    query: avec({
                      tri: valeur === "pertinence" ? undefined : valeur,
                    }),
                  }}
                  aria-current={valeur === tri ? "page" : undefined}
                  className={cn(
                    "rounded-champ px-3 py-1.5 text-sm transition-colors",
                    valeur === tri
                      ? "bg-fond-doux font-medium text-accent"
                      : "text-texte-attenue hover:text-texte",
                  )}
                >
                  {t(`tri.${valeur}`)}
                </Link>
              ))}
            </nav>
          ) : null}
        </div>

        {annonces.length > 0 ? (
          <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {annonces.map((annonce) => (
              <li key={annonce.id}>
                <CarteAnnonce annonce={annonce} />
              </li>
            ))}
          </ul>
        ) : (
          <section className="mt-8 rounded-carte border border-bordure bg-fond-doux p-8 sm:p-12">
            <h2 className="text-lg font-semibold">{t("vide.titre")}</h2>
            <p className="mt-2 max-w-xl text-texte-attenue">
              {ville ? t("vide.texteVille", { ville }) : t("vide.texte")}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Bouton as={Link} href="/mettre-en-location">
                {t("vide.actionProprietaire")}
              </Bouton>
              <Bouton
                as={Link}
                href="/recherche"
                variante="secondaire"
              >
                {t("vide.actionElargir")}
              </Bouton>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
