import { notFound } from "next/navigation";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";

import { CarteAnnonce } from "@/components/annonce/carte-annonce";
import { Bouton } from "@/components/ui/bouton";
import { Illustration } from "@/components/ui/illustration";
import { TuileLien } from "@/components/ui/tuile-lien";
import { CATEGORIES } from "@/config/categories";
import { clientEnv } from "@/config/env-client";
import { getMarket, type Market } from "@/config/markets";
import { villesDuPays, type CodePays } from "@/config/villes";
import { getPathname, Link } from "@/i18n/navigation";
import { PRIX_AFFICHE } from "@/lib/cn";
import { rechercherAnnonces } from "@/server/annonces/catalogue";

type Props = {
  params: Promise<{ locale: string; categorie: string }>;
};

/** Villes proposées en maillage, sous les annonces. */
const VILLES_PROPOSEES = 12;

export function generateStaticParams() {
  return CATEGORIES.map((entree) => ({ categorie: entree.slug }));
}

export async function generateMetadata({ params }: Props) {
  const { locale, categorie: slug } = await params;
  const categorie = CATEGORIES.find((entree) => entree.slug === slug);
  if (!categorie) return {};

  const t = await getTranslations({ locale, namespace: "pageCategorie" });

  // `metadonneesPage` ne sert que les adresses sans paramètre : celle-ci en a
  // un, on construit donc son adresse canonique ici, comme le fait la fiche
  // d'annonce.
  const canonique = new URL(
    getPathname({
      locale: locale as Market,
      href: {
        pathname: "/categories/[categorie]",
        params: { categorie: slug },
      },
    }),
    clientEnv.NEXT_PUBLIC_SITE_URL,
  ).toString();

  return {
    title: t("metaTitre", { categorie: categorie.nom }),
    description: t("metaDescription", {
      categorie: categorie.nomEnPhrase,
      usages: categorie.usages.toLowerCase(),
    }),
    alternates: { canonical: canonique },
  };
}

/**
 * Page d'un type de matériel, tous marchés confondus dans le pays servi.
 *
 * Elle manquait : l'adresse était déclarée dans le routage depuis le début et
 * répondait « page introuvable ». C'est pourtant la moitié de la longue traîne
 * — « louer une remorque porte-voiture » se cherche autant que « louer une
 * remorque à Lyon », et sans doute plus tôt dans la réflexion : on sait ce
 * qu'on veut transporter avant de savoir où l'on va le chercher.
 *
 * Bâtie sur le modèle des pages de ville, dont elle est le pendant : même
 * première vue photographique, mêmes chiffres, même maillage. Ce qui change
 * est l'axe — le matériel plutôt que le lieu — et donc les liens, qui mènent
 * ici vers les villes.
 */
export default async function PageCategorie({ params }: Props) {
  const { locale, categorie: slug } = await params;
  setRequestLocale(locale);

  const categorie = CATEGORIES.find((entree) => entree.slug === slug);
  if (!categorie) notFound();

  const t = await getTranslations("pageCategorie");
  const format = await getFormatter();

  const { annonces, total } = await rechercherAnnonces({
    categorie: categorie.slug,
    tri: "prix",
  });

  const villes = villesDuPays(
    getMarket(locale as Market).country as CodePays,
  ).slice(0, VILLES_PROPOSEES);

  const prixMinimum = annonces.length > 0 ? annonces[0].prixJour : null;
  const devise = annonces[0]?.devise ?? getMarket(locale as Market).currency;

  const prix = (centimes: number) =>
    format.number(centimes / 100, { ...PRIX_AFFICHE, currency: devise });

  return (
    <main>
      {/* ---------- Première vue ---------- */}
      <section className="relative overflow-hidden bg-encre text-encre-texte">
        <div className="absolute inset-0">
          <Illustration
            src={categorie.photo}
            alt=""
            priorite
            className="h-full w-full"
            tailles="100vw"
          />
        </div>
        <div aria-hidden className="absolute inset-0 bg-marque-950/70" />
        <div
          aria-hidden
          className="absolute inset-0 bg-linear-to-r from-marque-950/95 via-marque-950/70 to-marque-950/30"
        />

        <div className="relative mx-auto w-full max-w-6xl px-4 pt-8 pb-12 sm:px-6 sm:pt-10 sm:pb-16">
          <nav aria-label={t("filAriane")}>
            <ol className="flex flex-wrap items-center gap-2 text-sm text-encre-texte-attenue">
              <li>
                <Link href="/" className="hover:text-encre-texte">
                  {t("accueil")}
                </Link>
              </li>
              <li aria-hidden>/</li>
              <li aria-current="page" className="text-encre-texte">
                {categorie.nom}
              </li>
            </ol>
          </nav>

          <h1 className="mt-6 max-w-3xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            {t("titre", { categorie: categorie.nom })}
          </h1>
          <span
            aria-hidden
            className="mt-4 block h-1 w-12 rounded-full bg-accent"
          />

          <p className="mt-5 max-w-2xl text-[1.125rem] leading-snug font-semibold sm:text-[1.25rem]">
            {t("accroche", { usages: categorie.usages.toLowerCase() })}
          </p>

          <p className="mt-3 max-w-2xl text-[1.0625rem] text-encre-texte-attenue">
            {total > 0
              ? t("resume", {
                  nombre: total,
                  categorie: categorie.nomEnPhrase,
                  prix: prixMinimum ? prix(prixMinimum) : "",
                })
              : t("resumeVide", { categorie: categorie.nomEnPhrase })}
          </p>

          {total > 0 ? (
            <dl className="mt-7 flex flex-wrap gap-x-10 gap-y-4">
              <div>
                <dt className="text-sm text-encre-texte-attenue">
                  {t("chiffres.disponibles")}
                </dt>
                <dd className="mt-0.5 text-2xl font-semibold tabular-nums">
                  {total}
                </dd>
              </div>
              {prixMinimum ? (
                <div>
                  <dt className="text-sm text-encre-texte-attenue">
                    {t("chiffres.apartir")}
                  </dt>
                  <dd className="mt-0.5 text-2xl font-semibold tabular-nums">
                    {prix(prixMinimum)}
                  </dd>
                </div>
              ) : null}
            </dl>
          ) : null}

          <div className="mt-8">
            <Bouton
              as={Link}
              href={{
                pathname: "/recherche",
                query: { categorie: categorie.slug },
              }}
              taille="grand"
            >
              {t("action")}
            </Bouton>
          </div>
        </div>
      </section>

      {/* ---------- Annonces ---------- */}
      <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        {annonces.length > 0 ? (
          <>
            <h2 className="text-2xl font-semibold tracking-tight">
              {t("annonces", { categorie: categorie.nom })}
            </h2>
            <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {annonces.slice(0, 9).map((annonce) => (
                <li key={annonce.id}>
                  <CarteAnnonce annonce={annonce} />
                </li>
              ))}
            </ul>

            {total > 9 ? (
              <div className="mt-10 text-center">
                <Bouton
                  as={Link}
                  href={{
                    pathname: "/recherche",
                    query: { categorie: categorie.slug },
                  }}
                  variante="secondaire"
                >
                  {t("toutVoir", { nombre: total })}
                </Bouton>
              </div>
            ) : null}
          </>
        ) : (
          <div className="rounded-carte border border-bordure bg-fond-eleve p-8 shadow-(--ombre-carte) sm:p-12">
            <h2 className="text-xl font-semibold">
              {t("vide.titre", { categorie: categorie.nomEnPhrase })}
            </h2>
            <p className="mt-3 max-w-2xl text-texte-attenue">
              {t("vide.texte")}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Bouton as={Link} href="/mettre-en-location">
                {t("vide.actionProprietaire")}
              </Bouton>
              <Bouton as={Link} href="/recherche" variante="secondaire">
                {t("vide.actionRecherche")}
              </Bouton>
            </div>
          </div>
        )}
      </section>

      {/* ---------- Ce que l'on transporte ---------- */}
      <section className="bg-fond-doux">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <h2 className="text-2xl font-semibold tracking-tight">
            {t("usages.titre", { categorie: categorie.nomEnPhrase })}
          </h2>
          <p className="mt-4 max-w-2xl text-texte-attenue">
            {t("usages.texte", { usages: categorie.usages.toLowerCase() })}
          </p>

          <ul className="mt-8 flex flex-wrap gap-2">
            {categorie.usages.split(",").map((usage) => (
              <li
                key={usage}
                className="rounded-full border border-bordure bg-fond-eleve px-4 py-2 text-[0.9375rem]"
              >
                {usage.trim()}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ---------- Maillage vers les villes ----------
          C'est l'axe croisé : « porte-voiture à Lyon » se cherche davantage
          que l'un ou l'autre pris seul. */}
      <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <h2 className="text-2xl font-semibold tracking-tight">
          {t("villes", { categorie: categorie.nomEnPhrase })}
        </h2>
        <ul className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {villes.map((ville) => (
            <li key={ville.slug}>
              <TuileLien
                href={{
                  pathname: "/location-remorque/[ville]/[type]",
                  params: { ville: ville.slug, type: categorie.slug },
                }}
              >
                {ville.nom}
              </TuileLien>
            </li>
          ))}
        </ul>
      </section>

      {/* ---------- Autres types ---------- */}
      <section className="bg-fond-doux">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <h2 className="text-2xl font-semibold tracking-tight">
            {t("autres")}
          </h2>
          <ul className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {CATEGORIES.filter((autre) => autre.slug !== categorie.slug).map(
              (autre) => (
                <li key={autre.slug}>
                  <TuileLien
                    href={{
                      pathname: "/categories/[categorie]",
                      params: { categorie: autre.slug },
                    }}
                  >
                    {autre.nom}
                  </TuileLien>
                </li>
              ),
            )}
          </ul>
        </div>
      </section>
    </main>
  );
}
