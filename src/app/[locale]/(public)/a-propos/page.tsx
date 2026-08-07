import { getTranslations, setRequestLocale } from "next-intl/server";

import type { Market } from "@/config/markets";
import { Link } from "@/i18n/navigation";
import { metadonneesPage } from "@/lib/metadonnees";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "aPropos" });

  return metadonneesPage({
    locale: locale as Market,
    href: "/a-propos",
    titre: t("metaTitre"),
    description: t("metaDescription"),
  });
}

/**
 * Page « à propos ».
 *
 * Elle s'ouvre sur le constat, non sur l'entreprise. « Une remorque dort onze
 * mois sur douze » dit en une phrase pourquoi la plateforme existe ; « nous
 * sommes une équipe passionnée » ne dit rien et se trouve sur tous les sites.
 *
 * La section la plus utile est la dernière : ce que la plateforme **ne** fait
 * pas. Une place de marché qui laisse croire qu'elle possède le matériel se
 * retrouve tenue pour responsable de son état — et déçoit à la première panne.
 * Poser le périmètre est plus honnête, et plus solide.
 */
export default async function PageAPropos({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("aPropos");

  const CHIFFRES = ["usage", "trajet", "couverture"] as const;
  const PRINCIPES = ["p1", "p2", "p3", "p4"] as const;

  return (
    <main className="pb-24">
      <header className="border-b border-bordure bg-fond-doux">
        <div className="mx-auto w-full max-w-5xl px-4 py-16 sm:px-6 sm:py-24">
          <p className="text-sm font-medium tracking-widest text-accent uppercase">
            {t("surtitre")}
          </p>
          <h1 className="mt-4 max-w-3xl text-[2.25rem] leading-[1.05] font-bold tracking-[-0.035em] text-balance sm:text-[3.25rem]">
            {t("titre")}
          </h1>
          <p className="mt-6 max-w-2xl text-[1.125rem] leading-[1.6] text-texte-attenue">
            {t("chapo")}
          </p>
        </div>
      </header>

      <div className="mx-auto w-full max-w-5xl px-4 sm:px-6">
        {/* ---------- Chiffres ---------- */}
        <section className="mt-16">
          <h2 className="text-[0.6875rem] font-semibold tracking-[0.14em] text-texte-attenue uppercase">
            {t("chiffres.titre")}
          </h2>

          <div className="mt-6 grid gap-5 sm:grid-cols-3">
            {CHIFFRES.map((cle) => (
              <article
                key={cle}
                className="rounded-carte border border-bordure bg-fond-eleve p-6 shadow-(--ombre-carte)"
              >
                <p className="text-[2.5rem] leading-none font-bold tracking-[-0.04em] text-accent">
                  {t(`chiffres.${cle}.valeur`)}
                </p>
                <p className="mt-2 font-semibold">{t(`chiffres.${cle}.libelle`)}</p>
                <p className="mt-2.5 text-[0.9375rem] leading-[1.6] text-texte-attenue">
                  {t(`chiffres.${cle}.precision`)}
                </p>
              </article>
            ))}
          </div>
        </section>

        {/* ---------- Partis pris ---------- */}
        <section className="mt-20">
          <h2 className="text-[1.75rem] font-bold tracking-[-0.025em]">
            {t("principes.titre")}
          </h2>

          <div className="mt-8 grid gap-px overflow-hidden rounded-carte border border-bordure bg-bordure sm:grid-cols-2">
            {PRINCIPES.map((cle, rang) => (
              <article key={cle} className="bg-fond-eleve p-7">
                <span
                  aria-hidden
                  className="grid size-9 place-items-center rounded-full bg-accent/10 text-sm font-semibold text-accent tabular-nums"
                >
                  {rang + 1}
                </span>
                <h3 className="mt-4 text-[1.0625rem] font-semibold text-balance">
                  {t(`principes.${cle}.titre`)}
                </h3>
                <p className="mt-2.5 leading-[1.6] text-texte-attenue">
                  {t(`principes.${cle}.texte`)}
                </p>
              </article>
            ))}
          </div>
        </section>

        {/* ---------- Périmètre ---------- */}
        <section className="mt-20 rounded-carte border-l-4 border-l-accent bg-accent/5 px-7 py-8">
          <h2 className="text-[1.375rem] font-bold tracking-[-0.02em]">
            {t("perimetre.titre")}
          </h2>
          <p className="mt-4 max-w-2xl text-[1.0625rem] leading-[1.65]">
            {t("perimetre.texte")}
          </p>
        </section>

        {/* ---------- Contact ---------- */}
        <section className="mt-16 flex flex-wrap items-center justify-between gap-6 rounded-carte border border-bordure bg-fond-doux p-8">
          <div>
            <h2 className="text-[1.25rem] font-bold tracking-[-0.02em]">
              {t("contact.titre")}
            </h2>
            <p className="mt-2 text-[0.9375rem] text-texte-attenue">
              {t("contact.texte")}
            </p>
          </div>
          <Link
            href="/contact"
            className="inline-flex h-12 items-center rounded-champ bg-accent px-6 font-medium text-accent-contraste transition-opacity hover:opacity-90"
          >
            {t("contact.action")}
          </Link>
        </section>
      </div>
    </main>
  );
}
