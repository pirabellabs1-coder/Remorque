import { getTranslations, setRequestLocale } from "next-intl/server";

import { EnTeteEspace } from "@/components/espace/coquille-espace";
import { Cellule, Pastille, Tableau } from "@/components/espace/tableau";
import { CATEGORIES } from "@/config/categories";
import { VILLES } from "@/config/villes";
import { Link } from "@/i18n/navigation";
import { listerAnnonces } from "@/server/annonces/depot";

type Props = { params: Promise<{ locale: string }> };

export const metadata = { robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * Contenu éditorial.
 *
 * Les villes couvertes sont ici, et pas seulement dans un fichier de
 * configuration, parce que chaque ville publiée engendre une page locale
 * indexable — le premier levier de référencement de la plateforme, dont le
 * cadrage attend 60 à 80 % du trafic. Le nombre d'annonces par ville est
 * affiché à côté : une ville sans annonce produit une page vide, qui dessert
 * le référencement au lieu de le servir.
 */
export default async function PageContenu({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("espaces.admin.contenu");
  const tPays = await getTranslations("accueil.villes.pays");

  const annonces = listerAnnonces();

  const parVille = VILLES.map((ville) => ({
    ...ville,
    annonces: annonces.filter((annonce) => annonce.villeSlug === ville.slug).length,
  })).sort((a, b) => b.annonces - a.annonces);

  const parCategorie = CATEGORIES.map((categorie) => ({
    ...categorie,
    annonces: annonces.filter((annonce) => annonce.categorie === categorie.slug)
      .length,
  }));

  const PAGES = [
    { cle: "assurance", href: "/assurance" as const },
    { cle: "pro", href: "/pro" as const },
    { cle: "mettreEnLocation", href: "/mettre-en-location" as const },
    { cle: "permis", href: "/quel-permis-pour-quelle-remorque" as const },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8 sm:py-10">
      <EnTeteEspace titre={t("titre")} sousTitre={t("chapo")} />

      {/* ---------- Villes ---------- */}
      <section className="mt-8">
        <h2 className="text-[1.0625rem] font-semibold">{t("villes")}</h2>
        <p className="mt-1 max-w-2xl text-[0.9375rem] text-texte-attenue">
          {t("villesChapo")}
        </p>

        <Tableau
          className="mt-4"
          colonnes={[
            { cle: "ville", entete: t("ville") },
            { cle: "pays", entete: t("pays"), secondaire: true },
            { cle: "annonces", entete: t("annoncesVille"), numerique: true },
            { cle: "page", entete: t("adresse") },
          ]}
        >
          {parVille.map((ville) => (
            <tr key={ville.slug}>
              <th scope="row" className="px-5 py-3.5 text-left font-normal">
                {ville.nom}
              </th>
              <Cellule secondaire attenue>
                {tPays(ville.pays)}
              </Cellule>
              <Cellule
                numerique
                className={ville.annonces === 0 ? "text-danger" : undefined}
              >
                {ville.annonces}
              </Cellule>
              <Cellule>
                <Link
                  href={{
                    pathname: "/location-remorque/[ville]",
                    params: { ville: ville.slug },
                  }}
                  className="font-mono text-sm text-accent hover:underline"
                >
                  /location-remorque/{ville.slug}
                </Link>
              </Cellule>
            </tr>
          ))}
        </Tableau>
      </section>

      {/* ---------- Catégories ---------- */}
      <section className="mt-10">
        <h2 className="text-[1.0625rem] font-semibold">{t("categories")}</h2>
        <p className="mt-1 max-w-2xl text-[0.9375rem] text-texte-attenue">
          {t("categoriesChapo")}
        </p>

        <Tableau
          className="mt-4"
          colonnes={[
            { cle: "categorie", entete: t("categorie") },
            { cle: "annonces", entete: t("annoncesVille"), numerique: true },
            { cle: "adresse", entete: t("adresse") },
          ]}
        >
          {parCategorie.map((categorie) => (
            <tr key={categorie.slug}>
              <th scope="row" className="px-5 py-3.5 text-left font-normal">
                {categorie.nom}
              </th>
              <Cellule numerique>{categorie.annonces}</Cellule>
              <Cellule attenue className="font-mono text-sm">
                /{categorie.slug}
              </Cellule>
            </tr>
          ))}
        </Tableau>
      </section>

      {/* ---------- Pages éditoriales ---------- */}
      <section className="mt-10">
        <h2 className="text-[1.0625rem] font-semibold">{t("pages")}</h2>

        <Tableau
          className="mt-4"
          colonnes={[
            { cle: "page", entete: t("page") },
            { cle: "adresse", entete: t("adresse") },
            { cle: "etat", entete: t("etat") },
          ]}
        >
          {PAGES.map((page) => (
            <tr key={page.href}>
              <th scope="row" className="px-5 py-3.5 text-left font-normal">
                <Link href={page.href} className="text-accent hover:underline">
                  {page.href}
                </Link>
              </th>
              <Cellule attenue className="font-mono text-sm">
                {page.href}
              </Cellule>
              <Cellule>
                <Pastille ton="succes">{t("publiee")}</Pastille>
              </Cellule>
            </tr>
          ))}
        </Tableau>
      </section>
    </div>
  );
}
