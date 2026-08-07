import { getTranslations, setRequestLocale } from "next-intl/server";

import type { Market } from "@/config/markets";
import { Link } from "@/i18n/navigation";
import { metadonneesPage } from "@/lib/metadonnees";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "aide" });

  return metadonneesPage({
    locale: locale as Market,
    href: "/aide",
    titre: t("metaTitre"),
    description: t("metaDescription"),
  });
}

/**
 * Centre d'aide.
 *
 * Les questions sont rangées par **moment du parcours** — avant de réserver,
 * la caution, pendant la location, mettre en location — et non par thème
 * administratif. Quelqu'un qui cherche de l'aide sait où il en est, rarement
 * sous quelle rubrique son problème a été classé.
 *
 * Les réponses sont ouvertes, sans accordéon. Un accordéon économise de la
 * hauteur au prix d'un clic par question, et interdit surtout la recherche
 * dans la page — le premier réflexe de qui cherche un mot précis.
 */
export default async function PageAide({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("aide");

  const SECTIONS = [
    { cle: "avant", questions: ["q1", "q2", "q3", "q4"] },
    { cle: "caution", questions: ["q1", "q2", "q3"] },
    { cle: "pendant", questions: ["q1", "q2", "q3"] },
    { cle: "proprietaire", questions: ["q1", "q2", "q3", "q4"] },
  ] as const;

  return (
    <main className="pb-24">
      <header className="border-b border-bordure bg-fond-doux">
        <div className="mx-auto w-full max-w-5xl px-4 py-14 sm:px-6 sm:py-20">
          <p className="text-sm font-medium tracking-widest text-accent uppercase">
            {t("surtitre")}
          </p>
          <h1 className="mt-4 max-w-2xl text-[2rem] leading-[1.1] font-bold tracking-[-0.03em] text-balance sm:text-[2.75rem]">
            {t("titre")}
          </h1>
          <p className="mt-5 max-w-2xl text-[1.0625rem] leading-[1.6] text-texte-attenue">
            {t("chapo")}
          </p>
        </div>
      </header>

      <div className="mx-auto w-full max-w-5xl px-4 sm:px-6">
        {/* Sommaire en pastilles : quatre sections se choisissent d'un regard,
            là où une liste verticale se lit. */}
        <nav aria-label={t("surtitre")} className="mt-10 flex flex-wrap gap-2">
          {SECTIONS.map((section) => (
            <a
              key={section.cle}
              href={`#${section.cle}`}
              className="rounded-full border border-bordure bg-fond-eleve px-4 py-2 text-sm font-medium transition-colors hover:border-accent hover:text-accent"
            >
              {t(`sections.${section.cle}.titre`)}
            </a>
          ))}
        </nav>

        <div className="mt-14 space-y-16">
          {SECTIONS.map((section) => (
            <section
              key={section.cle}
              id={section.cle}
              className="scroll-mt-24 lg:grid lg:grid-cols-[14rem_1fr] lg:gap-12"
            >
              <h2 className="text-[1.375rem] font-bold tracking-[-0.02em] text-balance lg:sticky lg:top-24 lg:self-start">
                {t(`sections.${section.cle}.titre`)}
              </h2>

              <dl className="mt-6 space-y-px overflow-hidden rounded-carte border border-bordure bg-bordure lg:mt-0">
                {section.questions.map((question) => (
                  <div key={question} className="bg-fond-eleve p-6">
                    <dt className="text-[1.0625rem] font-semibold text-balance">
                      {t(`sections.${section.cle}.${question}.q` as never)}
                    </dt>
                    <dd className="mt-2.5 leading-[1.65] text-texte-attenue">
                      {t(`sections.${section.cle}.${question}.r` as never)}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>

        <section className="mt-16 rounded-carte border border-bordure bg-fond-doux p-8 text-center">
          <h2 className="text-[1.25rem] font-bold tracking-[-0.02em]">
            {t("reste.titre")}
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-[0.9375rem] leading-[1.6] text-texte-attenue">
            {t("reste.texte")}
          </p>
          <Link
            href="/contact"
            className="mt-6 inline-flex h-12 items-center rounded-champ bg-accent px-6 font-medium text-accent-contraste transition-opacity hover:opacity-90"
          >
            {t("reste.action")}
          </Link>
        </section>
      </div>
    </main>
  );
}
