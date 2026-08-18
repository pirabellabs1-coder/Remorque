import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";

import {
  PageEditoriale,
  SectionEditoriale,
} from "@/components/ui/mise-en-page";
import type { Market } from "@/config/markets";
import { articlesRecents } from "@/contenu/articles";
import { Link } from "@/i18n/navigation";
import { metadonneesPage } from "@/lib/metadonnees";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "pageBlog" });

  return metadonneesPage({
    locale: locale as Market,
    href: "/blog",
    titre: t("metaTitre"),
    description: t("metaDescription"),
  });
}

/**
 * Le journal.
 *
 * **Peu d'articles, et c'est délibéré.** La tentation d'une page de journal est
 * de la remplir : dix titres font sérieux, et neuf ne disent rien. Un article
 * de plateforme qui avance des chiffres invérifiés dessert plus qu'il ne sert —
 * il sera cité, opposé, et il faudra le défendre.
 *
 * Ce qui est publié ici part de règles que le code applique déjà et que les
 * tests couvrent. C'est une contrainte d'écriture forte, et c'est ce qui rend
 * ces pages utiles plutôt que décoratives.
 *
 * Les guides pratiques — quel permis, calculateur de charge, comment ça marche
 * — restent à leur place, hors du journal : ce sont des outils qu'on consulte,
 * pas des textes qu'on lit une fois. Le lien est fait en bas de page pour
 * qu'on ne les cherche pas ici.
 */
export default async function PageBlog({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("pageBlog");
  const format = await getFormatter();

  const articles = articlesRecents();

  return (
    <PageEditoriale
      surtitre={t("surtitre")}
      titre={t("titre")}
      chapo={t("chapo")}
    >
      {articles.length === 0 ? (
        <SectionEditoriale titre={t("vide.titre")} chapo={t("vide.texte")}>
          <p className="text-[0.9375rem] text-texte-attenue">
            {t("outils.chapo")}
          </p>
        </SectionEditoriale>
      ) : (
        <SectionEditoriale>
          <ul className="space-y-5">
            {articles.map((article) => (
              <li key={article.slug}>
                <Link
                  href={{
                    pathname: "/blog/[slug]",
                    params: { slug: article.slug },
                  }}
                  className="group block rounded-carte border border-bordure-carte bg-fond-eleve p-6 shadow-(--ombre-carte) transition-[border-color,box-shadow] duration-200 hover:border-accent hover:shadow-(--ombre-carte-active)"
                >
                  <p className="text-sm text-texte-attenue">
                    {format.dateTime(new Date(article.publieLe), {
                      dateStyle: "long",
                    })}
                    {" · "}
                    {t("minutes", { minutes: article.minutes })}
                  </p>

                  <h2 className="mt-2 text-[1.25rem] font-semibold text-balance transition-colors group-hover:text-accent">
                    {article.titre}
                  </h2>

                  <p className="mt-3 text-[0.9375rem] text-pretty text-texte-attenue">
                    {article.chapo}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </SectionEditoriale>
      )}

      {/* Les outils ne sont pas des articles : on les consulte, on ne les lit
          pas. Les citer ici évite qu'on les cherche dans le journal. */}
      <SectionEditoriale titre={t("outils.titre")} chapo={t("outils.chapo")}>
        <ul className="flex flex-wrap gap-3">
          {[
            { href: "/quel-permis-pour-quelle-remorque" as const, cle: "permis" },
            { href: "/calculateur-de-charge" as const, cle: "charge" },
            { href: "/comment-ca-marche" as const, cle: "fonctionnement" },
            { href: "/aide" as const, cle: "aide" },
          ].map((outil) => (
            <li key={outil.cle}>
              <Link
                href={outil.href}
                className="inline-flex rounded-champ border border-bordure px-4 py-2.5 text-sm font-medium transition-colors hover:border-accent hover:text-accent"
              >
                {t(`outils.${outil.cle}` as never)}
              </Link>
            </li>
          ))}
        </ul>
      </SectionEditoriale>
    </PageEditoriale>
  );
}
