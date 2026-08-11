import { notFound } from "next/navigation";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";

import { BoutonFavori } from "@/components/annonce/bouton-favori";
import { CarteAnnonce } from "@/components/annonce/carte-annonce";
import { CarteReference } from "@/components/annonce/carte-reference";
import { CarteSituation } from "@/components/annonce/carte-situation";
import { CarteReservation } from "@/components/annonce/carte-reservation";
import {
  BlocFiche,
  ChiffresCles,
  ListeCaracteristiques,
  RepartitionNotes,
} from "@/components/annonce/sections-fiche";
import { Etoiles } from "@/components/espace/statut";
import { DonneesStructurees } from "@/components/ui/carte";
import { Illustration } from "@/components/ui/illustration";
import { BAREME_PAR_DEFAUT } from "@/config/baremes";
import { CATEGORIES } from "@/config/categories";
import { clientEnv } from "@/config/env-client";
import { ENABLED_MARKETS, type Market } from "@/config/markets";
import { referenceAnnonce } from "@/domain/annonce/reference";
import { BAREME_FR } from "@/domain/compatibilite/permis";
import { getPathname, Link } from "@/i18n/navigation";
import { avisDeLannonce } from "@/server/annonces/avis";
import { codeQrSvg } from "@/server/annonces/code-qr";
import {
  rechercherAnnonces,
  listerAdressesAnnonces,
  trouverAnnonce,
} from "@/server/annonces/catalogue";

type Props = {
  params: Promise<{ locale: string; ville: string; slug: string }>;
};

/**
 * Une fiche n'est pré-générée que sur le marché de son pays : ailleurs, elle
 * rend un 404, et la construire d'avance ne ferait que fabriquer des pages
 * mortes que les moteurs signaleraient comme introuvables.
 */
export async function generateStaticParams() {
  const parMarche = await Promise.all(
    ENABLED_MARKETS.map(async (locale) =>
      (await listerAdressesAnnonces(locale)).map((adresse) => ({
        locale,
        ...adresse,
      })),
    ),
  );

  return parMarche.flat();
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

/**
 * Fiche d'une annonce.
 *
 * La page était plate : des titres séparés par de simples filets, une
 * description en paragraphe nu, des caractéristiques en grille sans contour.
 * Rien ne délimitait une information de la suivante, et l'œil glissait sans
 * accrocher.
 *
 * Elle est reconstruite sur deux niveaux, et deux seulement. Un bandeau de
 * chiffres clés juste sous la photographie — PTAC, charge utile, dimensions,
 * permis — parce que ce sont les quatre nombres qui décident de la location et
 * qu'ils étaient noyés au milieu de sept lignes de spécifications. Puis des
 * blocs encadrés pour ce qui se consulte : description, caractéristiques,
 * équipements, avis, loueur, conditions.
 *
 * Les avis apparaissent pour la première fois. C'était le manque le plus
 * coûteux de la page : on y demandait à un inconnu de confier plusieurs
 * centaines d'euros de caution sans lui donner le seul élément qui fonde la
 * confiance sur une place de marché.
 */
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

  const tSituation = await getTranslations("annonce.situation");

  const notes = await avisDeLannonce(annonce.id, 4);

  // L'adresse canonique de la fiche : c'est elle qu'encode le code QR, et elle
  // seule — ni identifiant technique, ni paramètre de suivi. Un code QR collé
  // sur une remorque survit à bien des versions du site.
  const adressePublique = new URL(
    getPathname({
      locale: locale as Market,
      href: {
        pathname: "/remorque/[ville]/[slug]",
        params: { ville, slug },
      },
    }),
    clientEnv.NEXT_PUBLIC_SITE_URL,
  ).toString();

  const qrSvg = await codeQrSvg(adressePublique);

  // Annonces voisines, la fiche courante exclue. Trois suffisent : au-delà, ce
  // n'est plus une suggestion mais une seconde page de résultats.
  //
  // La recherche porte sur un rayon autour du bien, et non sur sa seule
  // commune. Chercher dans la commune paraissait plus simple et ne montrait
  // rien : une ville qui ne compte qu'une annonce — le cas de presque toutes
  // aujourd'hui — n'a par définition aucune voisine, et la section
  // disparaissait au lieu de proposer la remorque de la ville d'à côté, à
  // vingt minutes de route.
  const voisines = (
    await rechercherAnnonces({
      longitude: annonce.situation.longitude,
      latitude: annonce.situation.latitude,
      rayonKm: 60,
      tri: "distance",
    })
  ).annonces
    .filter((autre) => autre.id !== annonce.id)
    .slice(0, 3);

  const mm = (valeur: number) =>
    t("cm", { cm: format.number(valeur / 10, { maximumFractionDigits: 0 }) });

  const dimensions = [
    mm(annonce.longueurUtileMm),
    mm(annonce.largeurUtileMm),
    annonce.hauteurUtileMm ? mm(annonce.hauteurUtileMm) : null,
  ]
    .filter(Boolean)
    .join(" × ");

  /**
   * Permis requis, dérivé du barème du domaine et jamais écrit en dur.
   *
   * Le calcul suppose un véhicule tracteur courant, ce que la précision dit
   * explicitement : annoncer « permis B » sans réserve à quelqu'un qui tracte
   * avec un utilitaire lourd serait une affirmation fausse, et coûteuse.
   */
  const permis =
    annonce.ptacKg > BAREME_FR.plafondRemorqueBE
      ? null
      : annonce.ptacKg <= BAREME_FR.seuilRemorqueFreineeKg
        ? t("permisB")
        : annonce.ptacKg <= 1_500
          ? t("permisB96")
          : t("permisBE");

  const chiffres = [
    { libelle: t("ptac"), valeur: t("kg", { kg: annonce.ptacKg }) },
    { libelle: t("chargeUtile"), valeur: t("kg", { kg: annonce.chargeUtileKg }) },
    {
      libelle: t("dimensions"),
      valeur: `${mm(annonce.longueurUtileMm)} × ${mm(annonce.largeurUtileMm)}`,
    },
    {
      libelle: t("permisRequis"),
      valeur: permis ?? "—",
      precision: t("permisAide"),
    },
  ];

  const caracteristiques = [
    { cle: t("ptac"), valeur: t("kg", { kg: annonce.ptacKg }) },
    { cle: t("chargeUtile"), valeur: t("kg", { kg: annonce.chargeUtileKg }) },
    { cle: t("poidsVide"), valeur: t("kg", { kg: annonce.poidsVideKg }) },
    { cle: t("dimensions"), valeur: dimensions },
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

  const ANNULATIONS = {
    souple: t("annulationSouple"),
    moderee: t("annulationModeree"),
    stricte: t("annulationStricte"),
  } as const;

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

      <header className="mt-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
            {annonce.titre}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-texte-attenue">
          {annonce.note !== null ? (
            <span className="flex items-center gap-1.5">
              <Etoiles note={Math.round(annonce.note)} />
              <span className="font-medium tabular-nums text-texte">
                {format.number(annonce.note, { maximumFractionDigits: 1 })}
              </span>
              <span>({annonce.nombreAvis})</span>
            </span>
          ) : null}
          <span>
            {annonce.quartier}, {annonce.ville}
          </span>
          {annonce.reservationInstantanee ? (
            <span className="rounded-full border border-accent/30 bg-accent/10 px-2.5 py-0.5 text-xs font-medium text-accent">
              {t("instantanee")}
            </span>
          ) : null}
          </div>
        </div>

        <BoutonFavori annonceId={annonce.id} />
      </header>

      <Illustration
        src={annonce.photo}
        alt={annonce.photoAlt}
        priorite
        className="mt-5 aspect-16/9 w-full rounded-carte border border-bordure"
        tailles="(min-width: 1024px) 66vw, 100vw"
      />

      {/* Les quatre nombres qui décident de la location, à l'endroit où l'œil
          arrive après l'image. */}
      <div className="mt-5">
        <ChiffresCles entrees={chiffres} />
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_23rem] lg:items-start">
        <div className="space-y-6">
          <BlocFiche titre={t("description")}>
            <p className="leading-relaxed whitespace-pre-line text-pretty">
              {annonce.description}
            </p>
          </BlocFiche>

          <BlocFiche
            titre={t("caracteristiques")}
            action={
              <Link
                href="/quel-permis-pour-quelle-remorque"
                className="text-sm font-medium text-accent hover:underline"
              >
                {t("verifierPermis")}
              </Link>
            }
          >
            <ListeCaracteristiques entrees={caracteristiques} />
          </BlocFiche>

          {annonce.equipements.length > 0 ? (
            <BlocFiche titre={t("equipements")}>
              <ul className="flex flex-wrap gap-2">
                {annonce.equipements.map((equipement) => (
                  <li
                    key={equipement}
                    className="rounded-full border border-bordure bg-fond-doux px-3 py-1.5 text-sm"
                  >
                    {equipement}
                  </li>
                ))}
              </ul>
            </BlocFiche>
          ) : null}

          {/* ---------- Avis ---------- */}
          <BlocFiche
            titre={t("avis")}
            aparte={
              notes.moyenne !== null
                ? `${format.number(notes.moyenne, { maximumFractionDigits: 1 })} · ${t("avisNombre", { nombre: notes.nombre })}`
                : undefined
            }
          >
            {notes.nombre === 0 ? (
              <div className="py-2">
                <p className="font-medium">{t("avisAucun")}</p>
                <p className="mt-1 text-[0.9375rem] text-texte-attenue">
                  {t("avisAucunTexte")}
                </p>
              </div>
            ) : (
              <>
                <RepartitionNotes
                  repartition={notes.repartition}
                  total={notes.nombre}
                  libelle={(note) => t("etoiles", { nombre: note })}
                />

                <ul className="mt-6 space-y-5 border-t border-bordure pt-5">
                  {notes.avis.map((avis) => (
                    <li key={avis.id}>
                      <article>
                        <div className="flex items-center gap-3">
                          <span
                            aria-hidden
                            className="grid size-9 shrink-0 place-items-center rounded-full bg-fond-doux text-sm font-medium"
                          >
                            {avis.auteur.charAt(0)}
                          </span>
                          <div className="min-w-0">
                            <p className="text-[0.9375rem] font-medium">
                              {avis.auteur}
                            </p>
                            <p className="flex items-center gap-2 text-xs text-texte-attenue">
                              <Etoiles note={avis.note} />
                              <time dateTime={avis.date.toISOString()}>
                                {format.dateTime(avis.date, {
                                  month: "long",
                                  year: "numeric",
                                })}
                              </time>
                            </p>
                          </div>
                        </div>

                        <p className="mt-2.5 text-[0.9375rem] text-pretty">
                          {avis.texte}
                        </p>

                        {/* La réponse du loueur en retrait : c'est une
                            réplique, pas un avis de même rang. */}
                        {avis.reponse ? (
                          <div className="mt-3 border-l-2 border-bordure pl-4">
                            <p className="text-xs font-medium text-texte-attenue">
                              {t("reponseProprietaire")}
                            </p>
                            <p className="mt-1 text-[0.9375rem]">
                              {avis.reponse}
                            </p>
                          </div>
                        ) : null}
                      </article>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </BlocFiche>

          {/* ---------- Loueur ---------- */}
          <BlocFiche titre={t("proprietaire")}>
            <div className="flex items-start gap-4">
              <span
                aria-hidden
                className="grid size-12 shrink-0 place-items-center rounded-full bg-fond-doux text-lg font-semibold"
              >
                {annonce.proprietaire.prenom.charAt(0)}
              </span>

              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">
                    {annonce.proprietaire.prenom}
                  </span>
                  {annonce.proprietaire.professionnel ? (
                    <span className="rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
                      {t("professionnel")}
                    </span>
                  ) : null}
                </p>
                <p className="mt-1 text-[0.9375rem] text-texte-attenue">
                  {t("loueurDepuis", { annee: annonce.proprietaire.depuis })}
                </p>
                <p className="text-[0.9375rem] text-texte-attenue">
                  {t("tauxReponse", { taux: annonce.proprietaire.tauxReponse })}
                </p>
              </div>
            </div>
          </BlocFiche>

          {/* ---------- Retrait, annulation, assurance ---------- */}
          <BlocFiche titre={t("retrait")}>
            <p className="text-[0.9375rem]">
              {t("adresseMasquee", { quartier: annonce.quartier })}
            </p>
            <p className="mt-1.5 text-sm text-texte-attenue">
              {t("retraitAide")}
            </p>

            <div className="mt-5 border-t border-bordure pt-4">
              <h3 className="text-[0.9375rem] font-medium">{t("annulation")}</h3>
              <p className="mt-1 text-[0.9375rem] text-texte-attenue">
                {ANNULATIONS[annonce.politiqueAnnulation]}
              </p>
            </div>

            <div className="mt-4 border-t border-bordure pt-4">
              <h3 className="text-[0.9375rem] font-medium">{t("assurance")}</h3>
              <p className="mt-1 text-[0.9375rem] text-texte-attenue">
                {t("assuranceTexte")}
              </p>
              <Link
                href="/assurance"
                className="mt-2 inline-block text-sm font-medium text-accent hover:underline"
              >
                {t("enSavoirPlus")}
              </Link>
            </div>
          </BlocFiche>
        </div>

        {/* Le barème descend depuis le serveur : il viendra de la table `pays`
            dès qu'elle sera branchée, sans toucher au composant. */}
        {/* Les deux cartes voyagent ensemble et s'épinglent ensemble. La
            carte de réservation portait le `sticky` à elle seule : elle
            restait accrochée pendant que la carte de référence défilait
            dessous, et les deux se chevauchaient. C'est le bloc entier qui
            doit tenir, pas l'une de ses cartes. */}
        <div className="space-y-4 lg:sticky lg:top-24">
          <CarteReservation annonce={annonce} bareme={BAREME_PAR_DEFAUT} />

          {/* Deux façons de désigner ce bien hors de l'écran : une référence
              qu'on dicte au téléphone et qu'on recopie sur un constat, un code
              QR qu'on colle sur le timon. */}
          <CarteReference
            reference={referenceAnnonce(annonce.id)}
            adresse={adressePublique}
            qrSvg={qrSvg}
          />
        </div>
      </div>

      {/* ---------- Où se trouve le matériel ---------- */}
      <section className="mt-12 border-t border-bordure pt-8">
        <h2 className="text-xl font-semibold tracking-tight">
          {tSituation("titre")}
        </h2>
        <div className="mt-5">
          <CarteSituation
            longitude={annonce.situation.longitude}
            latitude={annonce.situation.latitude}
            rayonM={annonce.situation.rayonM}
            quartier={annonce.quartier}
            ville={annonce.ville}
            styleUrl={clientEnv.NEXT_PUBLIC_MAP_STYLE_URL}
          />
        </div>
      </section>

      {/* ---------- À proximité ---------- */}
      {voisines.length > 0 ? (
        <section className="mt-12 border-t border-bordure pt-8">
          <h2 className="text-xl font-semibold tracking-tight">
            {t("similaires")}
          </h2>
          <p className="mt-1 text-[0.9375rem] text-texte-attenue">
            {t("similairesChapo", { ville: annonce.ville })}
          </p>

          <ul className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {voisines.map((voisine) => (
              <li key={voisine.id}>
                <CarteAnnonce annonce={voisine} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

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
