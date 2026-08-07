import { getTranslations, setRequestLocale } from "next-intl/server";

import { ENTREPRISE } from "@/config/entreprise";
import type { Market } from "@/config/markets";
import { Link } from "@/i18n/navigation";
import { metadonneesPage } from "@/lib/metadonnees";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "contact" });

  return metadonneesPage({
    locale: locale as Market,
    href: "/contact",
    titre: t("metaTitre"),
    description: t("metaDescription"),
  });
}

/**
 * Page de contact.
 *
 * Elle ne propose pas de formulaire, et c'est délibéré. Un formulaire de
 * contact perd le fil : la personne n'a pas de trace de ce qu'elle a envoyé, ne
 * peut rien joindre, et se retrouve à réexpliquer si la réponse tarde. Une
 * adresse électronique laisse la conversation dans sa boîte, avec ses pièces
 * jointes et son historique.
 *
 * L'organisation suit l'urgence et non l'organigramme : une location en cours
 * d'abord, le compte ensuite, la réclamation formelle en dernier. Chaque canal
 * annonce son délai, parce que ne pas savoir combien de temps attendre est ce
 * qui fait relancer — et donc ce qui allonge le délai pour tout le monde.
 */
export default async function PageContact({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("contact");
  const courriel = ENTREPRISE.courriel || "contact@example.invalid";

  const CANAUX = [
    {
      cle: "location",
      href: "/compte/reservations" as const,
      accent: true,
    },
    { cle: "compte", href: `mailto:${courriel}`, accent: false },
    { cle: "reclamation", href: `mailto:${courriel}`, accent: false },
  ];

  const AUTRES = ["presse", "partenariats", "securite", "donnees"] as const;

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
        {/* ---------- Urgence ---------- */}
        <section className="mt-12 rounded-carte border-l-4 border-l-danger bg-danger/5 px-6 py-5">
          <h2 className="font-semibold text-danger">{t("urgence.titre")}</h2>
          <p className="mt-2 max-w-2xl text-[1.0625rem] leading-[1.6]">
            {t("urgence.texte")}
          </p>
        </section>

        {/* ---------- Canaux ---------- */}
        <section className="mt-14">
          <h2 className="text-[1.375rem] font-bold tracking-[-0.02em]">
            {t("canaux.titre")}
          </h2>

          <div className="mt-6 grid gap-5 lg:grid-cols-3">
            {CANAUX.map((canal) => (
              <article
                key={canal.cle}
                className={
                  canal.accent
                    ? "flex flex-col rounded-carte border-2 border-accent bg-fond-eleve p-6 shadow-(--ombre-carte)"
                    : "flex flex-col rounded-carte border border-bordure bg-fond-eleve p-6 shadow-(--ombre-carte)"
                }
              >
                <h3 className="text-[1.0625rem] font-semibold">
                  {t(`canaux.${canal.cle}.titre` as never)}
                </h3>
                <p className="mt-2 flex-1 text-[0.9375rem] leading-[1.6] text-texte-attenue">
                  {t(`canaux.${canal.cle}.texte` as never)}
                </p>

                {/* Le délai annoncé sur chaque canal : ne pas savoir combien de
                    temps attendre est ce qui fait relancer, et donc ce qui
                    allonge le délai pour tout le monde. */}
                <p className="mt-4 inline-flex items-center gap-2 text-sm text-texte-attenue">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    aria-hidden
                    className="size-4 shrink-0"
                  >
                    <path d="M12 7v5l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                  </svg>
                  {t(`canaux.${canal.cle}.delai` as never)}
                </p>

                {canal.href.startsWith("mailto:") ? (
                  <a
                    href={canal.href}
                    className="mt-5 inline-flex items-center gap-1.5 font-medium text-accent hover:underline"
                  >
                    {t(`canaux.${canal.cle}.action` as never)}
                    <span aria-hidden>→</span>
                  </a>
                ) : (
                  <Link
                    href={canal.href as "/compte/reservations"}
                    className="mt-5 inline-flex items-center gap-1.5 font-medium text-accent hover:underline"
                  >
                    {t(`canaux.${canal.cle}.action` as never)}
                    <span aria-hidden>→</span>
                  </Link>
                )}
              </article>
            ))}
          </div>
        </section>

        {/* ---------- Autres demandes ---------- */}
        <section className="mt-14">
          <h2 className="text-[1.375rem] font-bold tracking-[-0.02em]">
            {t("autres.titre")}
          </h2>

          <dl className="mt-6 grid gap-px overflow-hidden rounded-carte border border-bordure bg-bordure sm:grid-cols-2">
            {AUTRES.map((cle) => (
              <div key={cle} className="bg-fond-eleve p-6">
                <dt className="font-semibold">{t(`autres.${cle}.titre`)}</dt>
                <dd className="mt-1.5 text-[0.9375rem] leading-[1.6] text-texte-attenue">
                  {t(`autres.${cle}.texte`)}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        {/* ---------- Courrier ---------- */}
        <section className="mt-14 rounded-carte border border-bordure bg-fond-doux p-6 sm:p-8">
          <h2 className="text-[1.0625rem] font-semibold">{t("postal.titre")}</h2>
          <p className="mt-2 max-w-2xl text-[0.9375rem] leading-[1.6] text-texte-attenue">
            {t("postal.texte")}
          </p>
          <Link
            href="/mentions-legales"
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
          >
            {t("postal.lien")}
            <span aria-hidden>→</span>
          </Link>
        </section>
      </div>
    </main>
  );
}
