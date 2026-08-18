import { notFound } from "next/navigation";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";

import { DonneesStructurees } from "@/components/ui/carte";
import { PageEditoriale } from "@/components/ui/mise-en-page";
import { clientEnv } from "@/config/env-client";
import type { Market } from "@/config/markets";
import { ARTICLES, articleParSlug } from "@/contenu/articles";
import { getPathname, Link } from "@/i18n/navigation";

type Props = { params: Promise<{ locale: string; slug: string }> };

/** Les articles sont connus à la compilation : autant les pré-rendre tous. */
export function generateStaticParams() {
  return ARTICLES.map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({ params }: Props) {
  const { locale, slug } = await params;
  const article = articleParSlug(slug);
  if (!article) return {};

  // `metadonneesPage` ne sert que les adresses sans paramètre : celle-ci en a
  // un, on construit donc son adresse canonique ici.
  const canonique = new URL(
    getPathname({
      locale: locale as Market,
      href: { pathname: "/blog/[slug]", params: { slug } },
    }),
    clientEnv.NEXT_PUBLIC_SITE_URL,
  ).toString();

  return {
    title: article.titre,
    description: article.chapo,
    alternates: { canonical: canonique },
    openGraph: {
      type: "article",
      title: article.titre,
      description: article.chapo,
      publishedTime: article.publieLe,
    },
  };
}

/**
 * Un article.
 *
 * Le corps est rendu depuis des blocs typés, jamais depuis du HTML : un
 * article ne peut donc pas injecter de balise, ce qui ôte la question de
 * l'échappement plutôt que de la traiter. C'est aussi ce qui garantit que la
 * mise en forme reste celle du site — un article collé depuis un traitement de
 * texte n'apporte pas ses propres polices.
 */
export default async function PageArticle({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const article = articleParSlug(slug);
  if (!article) notFound();

  const t = await getTranslations("pageBlog");
  const format = await getFormatter();

  return (
    <PageEditoriale
      surtitre={`${format.dateTime(new Date(article.publieLe), {
        dateStyle: "long",
      })} · ${t("minutes", { minutes: article.minutes })}`}
      titre={article.titre}
      chapo={article.chapo}
      densite="texte"
    >
      <DonneesStructurees
        donnees={{
          "@context": "https://schema.org",
          "@type": "Article",
          headline: article.titre,
          description: article.chapo,
          datePublished: article.publieLe,
          publisher: {
            "@type": "Organization",
            name: "FlexiTrailer",
            url: clientEnv.NEXT_PUBLIC_SITE_URL,
          },
        }}
      />

      <div className="space-y-6">
        {article.corps.map((bloc, rang) => {
          if (bloc.type === "intertitre") {
            return (
              <h2
                key={rang}
                className="mt-12 text-[1.25rem] font-semibold text-balance first:mt-0"
              >
                {bloc.texte}
              </h2>
            );
          }

          if (bloc.type === "liste") {
            return (
              <ul key={rang} className="space-y-3">
                {bloc.entrees.map((entree) => (
                  <li
                    key={entree}
                    className="border-l-2 border-bordure pl-4 text-[1.0625rem] leading-relaxed"
                  >
                    {entree}
                  </li>
                ))}
              </ul>
            );
          }

          return (
            <p key={rang} className="text-[1.0625rem] leading-relaxed text-pretty">
              {bloc.texte}
            </p>
          );
        })}
      </div>

      <p className="mt-14 border-t border-bordure pt-6">
        <Link
          href="/blog"
          className="font-medium text-accent underline underline-offset-4"
        >
          {t("retour")}
        </Link>
      </p>
    </PageEditoriale>
  );
}
