import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";

import { Etoiles } from "@/components/espace/statut";
import { DonneesStructurees } from "@/components/ui/carte";
import {
  PageEditoriale,
  SectionEditoriale,
} from "@/components/ui/mise-en-page";
import { clientEnv } from "@/config/env-client";
import type { Market } from "@/config/markets";
import { Link } from "@/i18n/navigation";
import { metadonneesPage } from "@/lib/metadonnees";
import { avisDuMarche } from "@/server/annonces/avis";

type Props = { params: Promise<{ locale: string }> };

/**
 * Les avis changent à chaque location close : rien à figer au déploiement.
 * Une page d'avis vieille de trois semaines vaut moins qu'une page absente,
 * parce qu'elle affirme un chiffre faux.
 */
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "pageAvis" });

  return metadonneesPage({
    locale: locale as Market,
    href: "/avis",
    titre: t("metaTitre"),
    description: t("metaDescription"),
  });
}

/**
 * Les avis de la plateforme, tous marchés du pays confondus.
 *
 * **Aucune sélection.** L'accueil montre trois avis choisis parmi les plus
 * convaincants — c'est légitime pour une accroche, qui dispose de trois
 * emplacements et ne prétend pas à l'exhaustivité. Une page intitulée « Avis »
 * qui trierait de la même façon mentirait : elle présenterait un choix en le
 * faisant passer pour un ensemble. L'ordre est donc chronologique, et les
 * mauvaises notes figurent au même titre que les bonnes.
 *
 * **La répartition est montrée en entier**, y compris les notes que personne
 * n'a jamais données. Un histogramme réduit à ses barres non vides se lit
 * comme un sans-faute, ce qui est exactement l'effet qu'on ne veut pas.
 *
 * **Un avis mène à son annonce.** Un témoignage qui convainc doit conduire au
 * matériel dont il parle ; sans ce lien, le lecteur convaincu n'a nulle part
 * où aller, et la page ne sert qu'à se faire plaisir.
 */
export default async function PageAvis({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("pageAvis");
  const format = await getFormatter();

  const { avis, nombre, moyenne, repartition } = await avisDuMarche();

  const note = (valeur: number) =>
    format.number(valeur, { maximumFractionDigits: 1 });

  return (
    <PageEditoriale
      surtitre={t("surtitre")}
      titre={t("titre")}
      chapo={t("chapo")}
    >
      {/* Le balisage n'est émis que s'il y a de quoi le remplir : déclarer une
          note agrégée sans avis serait une affirmation fausse adressée aux
          moteurs, et c'est le genre de chose qui se sanctionne. */}
      {moyenne !== null && nombre > 0 ? (
        <DonneesStructurees
          donnees={{
            "@context": "https://schema.org",
            "@type": "Organization",
            name: "FlexiTrailer",
            url: clientEnv.NEXT_PUBLIC_SITE_URL,
            aggregateRating: {
              "@type": "AggregateRating",
              ratingValue: Number(moyenne.toFixed(2)),
              reviewCount: nombre,
              bestRating: 5,
              worstRating: 1,
            },
          }}
        />
      ) : null}

      {nombre === 0 ? (
        <SectionEditoriale titre={t("vide.titre")} chapo={t("vide.texte")}>
          <p className="text-[0.9375rem]">
            <Link
              href="/recherche"
              className="font-medium text-accent underline underline-offset-4"
            >
              {t("vide.action")}
            </Link>
          </p>
        </SectionEditoriale>
      ) : (
        <>
          <SectionEditoriale>
            <div className="grid gap-8 rounded-carte border border-bordure-carte bg-fond-eleve p-6 sm:grid-cols-[auto_minmax(0,1fr)] sm:gap-12 sm:p-8">
              <div className="text-center sm:text-left">
                <p className="text-5xl font-bold tabular-nums">
                  {note(moyenne ?? 0)}
                </p>
                <div className="mt-2 flex justify-center sm:justify-start">
                  <Etoiles note={moyenne ?? 0} />
                </div>
                <p className="mt-2 text-sm text-texte-attenue">
                  {t("surCinq", { nombre })}
                </p>
              </div>

              <ul className="space-y-2">
                {repartition.map((ligne) => {
                  const part = nombre > 0 ? (ligne.nombre / nombre) * 100 : 0;

                  return (
                    <li key={ligne.note} className="flex items-center gap-3">
                      <span className="w-16 shrink-0 text-sm text-texte-attenue tabular-nums">
                        {t("etoiles", { note: ligne.note })}
                      </span>
                      <span className="h-2 flex-1 overflow-hidden rounded-full bg-fond-doux">
                        <span
                          className="block h-full rounded-full bg-attention"
                          style={{ width: `${part}%` }}
                        />
                      </span>
                      <span className="w-10 shrink-0 text-right text-sm text-texte-attenue tabular-nums">
                        {ligne.nombre}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>

            <p className="mt-4 text-sm text-texte-attenue">{t("regle")}</p>
          </SectionEditoriale>

          <SectionEditoriale titre={t("tous")}>
            <ul className="grid gap-5 sm:grid-cols-2">
              {avis.map((entree) => (
                <li
                  key={entree.id}
                  className="flex flex-col rounded-carte border border-bordure-carte bg-fond-eleve p-6 shadow-(--ombre-carte)"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <Etoiles note={entree.note} />
                    <time
                      dateTime={entree.date.toISOString()}
                      className="text-sm text-texte-attenue"
                    >
                      {format.dateTime(entree.date, { dateStyle: "long" })}
                    </time>
                  </div>

                  <blockquote className="mt-4 flex-1 text-[0.9375rem] leading-relaxed">
                    {entree.texte}
                  </blockquote>

                  {/* La réponse du propriétaire, quand il y en a une : elle dit
                      autant que l'avis lui-même — un loueur qui répond à une
                      critique en apprend plus au lecteur qu'une note de cinq. */}
                  {entree.reponse ? (
                    <p className="mt-4 border-l-2 border-bordure pl-4 text-sm text-texte-attenue">
                      {t("reponse")} {entree.reponse}
                    </p>
                  ) : null}

                  <div className="mt-5 flex flex-wrap items-baseline justify-between gap-2 border-t border-bordure pt-4">
                    <span className="text-sm font-medium">{entree.auteur}</span>
                    <Link
                      href={{
                        pathname: "/remorque/[ville]/[slug]",
                        params: {
                          ville: entree.annonce.villeSlug,
                          slug: entree.annonce.slug,
                        },
                      }}
                      className="text-sm text-accent underline underline-offset-4"
                    >
                      {entree.annonce.titre} · {entree.annonce.ville}
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          </SectionEditoriale>
        </>
      )}
    </PageEditoriale>
  );
}
