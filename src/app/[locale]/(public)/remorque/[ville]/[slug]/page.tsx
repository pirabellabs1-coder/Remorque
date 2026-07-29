import { notFound } from "next/navigation";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";

import { CarteReservation } from "@/components/annonce/carte-reservation";
import { DonneesStructurees } from "@/components/ui/carte";
import { Illustration } from "@/components/ui/illustration";
import { BAREME_PAR_DEFAUT } from "@/config/baremes";
import { CATEGORIES } from "@/config/categories";
import { clientEnv } from "@/config/env-client";
import type { Market } from "@/config/markets";
import { Link, getPathname } from "@/i18n/navigation";
import {
  listerAdressesAnnonces,
  trouverAnnonce,
} from "@/server/annonces/catalogue";

type Props = {
  params: Promise<{ locale: string; ville: string; slug: string }>;
};

export async function generateStaticParams() {
  return listerAdressesAnnonces();
}

export async function generateMetadata({ params }: Props) {
  const { locale, ville, slug } = await params;
  const annonce = await trouverAnnonce(ville, slug);
  if (!annonce) return {};

  const t = await getTranslations({ locale, namespace: "annonce" });
  const canonique = new URL(
    getPathname({
      locale: locale as Market,
      href: {
        pathname: "/remorque/[ville]/[slug]",
        params: { ville, slug },
      },
    }),
    clientEnv.NEXT_PUBLIC_SITE_URL,
  ).toString();

  return {
    title: t("metaTitre", { titre: annonce.titre, ville: annonce.ville }),
    description: t("metaDescription", {
      titre: annonce.titre,
      ville: annonce.ville,
      kg: annonce.chargeUtileKg,
    }),
    alternates: { canonical: canonique },
    openGraph: { images: [annonce.photo] },
  };
}

export default async function PageAnnonce({ params }: Props) {
  const { locale, ville, slug } = await params;
  setRequestLocale(locale);

  const annonce = await trouverAnnonce(ville, slug);
  if (!annonce) notFound();

  const t = await getTranslations("annonce");
  const format = await getFormatter();
  const categorie = CATEGORIES.find(
    (entree) => entree.slug === annonce.categorie,
  )!;

  const mm = (valeur: number) =>
    t("cm", { cm: format.number(valeur / 10, { maximumFractionDigits: 0 }) });

  /** Caractéristiques : des chiffres, pas des phrases. */
  const caracteristiques = [
    { cle: t("ptac"), valeur: t("kg", { kg: annonce.ptacKg }) },
    { cle: t("chargeUtile"), valeur: t("kg", { kg: annonce.chargeUtileKg }) },
    { cle: t("poidsVide"), valeur: t("kg", { kg: annonce.poidsVideKg }) },
    {
      cle: t("dimensions"),
      valeur: [
        mm(annonce.longueurUtileMm),
        mm(annonce.largeurUtileMm),
        annonce.hauteurUtileMm ? mm(annonce.hauteurUtileMm) : null,
      ]
        .filter(Boolean)
        .join(" × "),
    },
    {
      cle: t("freinage"),
      valeur: annonce.freinee ? t("freinee") : t("nonFreinee"),
    },
    { cle: t("attelage"), valeur: annonce.typeAttelage },
    {
      cle: t("faisceau"),
      valeur: t("broches", { nombre: annonce.faisceauBroches }),
    },
  ];

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <nav aria-label={t("filAriane")} className="text-sm text-texte-attenue">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link href="/recherche" className="hover:text-texte">
              {t("filArianeRacine")}
            </Link>
          </li>
          <li aria-hidden>›</li>
          <li>
            <Link
              href={{
                pathname: "/recherche",
                query: { categorie: categorie.slug },
              }}
              className="hover:text-texte"
            >
              {categorie.nom}
            </Link>
          </li>
          <li aria-hidden>›</li>
          <li aria-current="page" className="text-texte">
            {annonce.ville}
          </li>
        </ol>
      </nav>

      <header className="mt-4">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {annonce.titre}
        </h1>
        <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-texte-attenue">
          {annonce.note !== null ? (
            <span>
              <span aria-hidden>★ </span>
              <span className="font-medium text-texte">
                {format.number(annonce.note, { maximumFractionDigits: 1 })}
              </span>{" "}
              ({annonce.nombreAvis})
            </span>
          ) : null}
          <span>
            {annonce.quartier}, {annonce.ville}
          </span>
          {annonce.reservationInstantanee ? (
            <span className="text-accent">{t("instantanee")}</span>
          ) : null}
        </p>
      </header>

      <Illustration
        src={annonce.photo}
        alt={annonce.photoAlt}
        priorite
        className="mt-5 aspect-16/9 w-full rounded-carte"
        tailles="(min-width: 1024px) 66vw, 100vw"
      />

      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_23rem] lg:items-start">
        <div>
          <p className="text-pretty">{annonce.description}</p>

          <section className="mt-8">
            <h2 className="text-lg font-semibold">{t("caracteristiques")}</h2>
            <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
              {caracteristiques.map((entree) => (
                <div key={entree.cle}>
                  <dt className="text-sm text-texte-attenue">{entree.cle}</dt>
                  <dd className="mt-0.5 font-medium">{entree.valeur}</dd>
                </div>
              ))}
            </dl>

            <p className="mt-6 text-sm">
              <Link
                href="/quel-permis-pour-quelle-remorque"
                className="text-accent underline-offset-4 hover:underline"
              >
                {t("verifierPermis")}
              </Link>
            </p>
          </section>

          <section className="mt-8">
            <h2 className="text-lg font-semibold">{t("equipements")}</h2>
            <ul className="mt-4 flex flex-wrap gap-2">
              {annonce.equipements.map((equipement) => (
                <li
                  key={equipement}
                  className="rounded-full border border-bordure px-3 py-1 text-sm"
                >
                  {equipement}
                </li>
              ))}
            </ul>
          </section>

          <section className="mt-8 border-t border-bordure pt-6">
            <h2 className="text-lg font-semibold">{t("proprietaire")}</h2>
            <p className="mt-3">
              <span className="font-medium">{annonce.proprietaire.prenom}</span>
              {annonce.proprietaire.professionnel ? (
                <span className="ml-2 rounded-full bg-fond-doux px-2 py-0.5 text-xs font-medium text-accent">
                  {t("professionnel")}
                </span>
              ) : null}
            </p>
            <p className="mt-1 text-sm text-texte-attenue">
              {t("depuis", { annee: annonce.proprietaire.depuis })} ·{" "}
              {t("tauxReponse", { taux: annonce.proprietaire.tauxReponse })}
            </p>
          </section>

          <section className="mt-8 border-t border-bordure pt-6">
            <h2 className="text-lg font-semibold">{t("retrait")}</h2>
            <p className="mt-3 text-sm text-texte-attenue">
              {t("adresseMasquee", { quartier: annonce.quartier })}
            </p>
          </section>
        </div>

        {/* Le barème descend depuis le serveur : il viendra de la table `pays`
            dès qu'elle sera branchée, sans toucher au composant. */}
        <CarteReservation annonce={annonce} bareme={BAREME_PAR_DEFAUT} />
      </div>

      <DonneesStructurees
        donnees={{
          "@context": "https://schema.org",
          "@type": "Product",
          name: annonce.titre,
          image: new URL(
            annonce.photo,
            clientEnv.NEXT_PUBLIC_SITE_URL,
          ).toString(),
          description: annonce.description,
          category: categorie.nom,
          offers: {
            "@type": "Offer",
            price: (annonce.prixJour / 100).toFixed(2),
            priceCurrency: annonce.devise,
            availability: "https://schema.org/InStock",
          },
          ...(annonce.note !== null
            ? {
                aggregateRating: {
                  "@type": "AggregateRating",
                  ratingValue: annonce.note,
                  reviewCount: annonce.nombreAvis,
                },
              }
            : {}),
        }}
      />
    </main>
  );
}
