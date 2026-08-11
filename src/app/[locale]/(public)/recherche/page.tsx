import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";

import { BoutonAutourDeMoi } from "@/components/annonce/bouton-autour-de-moi";
import { CarteAnnonce } from "@/components/annonce/carte-annonce";
import { Illustration } from "@/components/ui/illustration";
import {
  FiltresRecherche,
  TriResultats,
} from "@/components/recherche/filtres-recherche";
import { FormulaireRecherche } from "@/components/recherche/formulaire-recherche";
import { VoletCarte } from "@/components/recherche/volet-carte";
import { Bouton } from "@/components/ui/bouton";
import { CATEGORIES } from "@/config/categories";
import { trouverVille } from "@/config/villes";
import { clientEnv } from "@/config/env-client";
import type { Market } from "@/config/markets";
import { getPathname, Link } from "@/i18n/navigation";
import { metadonneesPage } from "@/lib/metadonnees";
import { cn, PRIX_AFFICHE } from "@/lib/cn";
import {
  PALIERS_CHARGE,
  PALIERS_PRIX,
  RAYON_PAR_DEFAUT,
  RAYONS,
  TRIS,
  estTri,
  positionValide,
  rechercherAnnonces,
} from "@/server/annonces/catalogue";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "recherche" });

  return metadonneesPage({
    locale: locale as Market,
    href: "/recherche",
    titre: t("metaTitre"),
    description: t("metaDescription"),
  });
}

function lire(valeur: string | string[] | undefined): string | undefined {
  return Array.isArray(valeur) ? valeur[0] : valeur;
}

export default async function PageRecherche({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const parametres = await searchParams;
  const t = await getTranslations("recherche");
  const format = await getFormatter();

  const ville = lire(parametres.ville);

  // Le nom propre de la ville, pas la saisie brute. Le titre affichait
  // « Remorques à louer à paris » — ce que le visiteur avait tapé, minuscule
  // comprise. On cherche la ville au catalogue et l'on retombe sur la saisie
  // seulement si elle n'y figure pas.
  const villeConnue = ville
    ? trouverVille(
        ville
          .normalize("NFD")
          .replace(/[̀-ͯ]/g, "")
          .toLowerCase()
          .trim()
          .replace(/\s+/g, "-"),
      )
    : undefined;
  const villeAffichee = villeConnue?.nom ?? ville ?? "";
  const slugCategorie = lire(parametres.categorie);
  const triDemande = lire(parametres.tri);
  const tri = estTri(triDemande) ? triDemande : "pertinence";

  // Position du visiteur, si elle est présente et vraisemblable. Elle arrive
  // par l'adresse et n'est donc pas digne de confiance : on la valide comme
  // n'importe quelle saisie.
  const position = positionValide(lire(parametres.lon), lire(parametres.lat));
  const rayonDemande = Number(lire(parametres.rayon));
  const rayonKm = (RAYONS as readonly number[]).includes(rayonDemande)
    ? rayonDemande
    : RAYON_PAR_DEFAUT;

  // Les filtres arrivent par l'adresse : on ne retient que des valeurs
  // proposées, jamais ce que le navigateur a bien voulu écrire. Un palier
  // inventé est ignoré plutôt que refusé — la recherche doit répondre.
  const prixDemande = Number(lire(parametres.prixMax));
  const prixMax = (PALIERS_PRIX as readonly number[]).includes(prixDemande)
    ? prixDemande
    : undefined;

  const chargeDemandee = Number(lire(parametres.chargeMin));
  const chargeMin = (PALIERS_CHARGE as readonly number[]).includes(chargeDemandee)
    ? chargeDemandee
    : undefined;

  const freineeSeulement = lire(parametres.freinee) === "oui";
  const instantaneeSeulement = lire(parametres.instantanee) === "oui";

  const categorie = CATEGORIES.find((entree) => entree.slug === slugCategorie);
  const { annonces, total } = await rechercherAnnonces({
    ville,
    categorie: categorie?.slug,
    prixMax,
    chargeMin,
    freineeSeulement,
    instantaneeSeulement,
    // Une position réelle ordonne par distance : c'est ce qu'on demande en
    // cliquant « autour de moi ».
    tri: position && triDemande === undefined ? "distance" : tri,
    longitude: position?.longitude,
    latitude: position?.latitude,
    rayonKm: position ? rayonKm : undefined,
  });

  // Les mêmes annonces que la liste, sous la forme qu'attend la carte. Rien à
  // synchroniser entre les deux volets : ils descendent du même rendu.
  const pointsCarte = annonces.map((annonce) => ({
    id: annonce.id,
    titre: annonce.titre,
    ville: annonce.ville,
    prix: format.number(annonce.prixJour / 100, {
      ...PRIX_AFFICHE,
      currency: annonce.devise,
    }),
    photo: annonce.photo,
    longitude: annonce.situation.longitude,
    latitude: annonce.situation.latitude,
    href: getPathname({
      locale: locale as Market,
      href: {
        pathname: "/remorque/[ville]/[slug]",
        params: { ville: annonce.villeSlug, slug: annonce.slug },
      },
    }),
  }));

  const filtresActifs = [
    categorie,
    prixMax,
    chargeMin,
    freineeSeulement || undefined,
    instantaneeSeulement || undefined,
    ville || undefined,
  ].filter(Boolean).length;

  const titre = categorie
    ? ville
      ? t("titreCategorieVille", { categorie: categorie.nom, ville: villeAffichee })
      : t("titreCategorie", { categorie: categorie.nom })
    : ville
      ? t("titreVille", { ville: villeAffichee })
      : t("titre");

  /** Conserve les critères courants en changeant une seule clé. */
  const avec = (modifications: Record<string, string | undefined>) => {
    const requete: Record<string, string> = {};
    if (ville) requete.ville = ville;
    if (slugCategorie) requete.categorie = slugCategorie;
    if (tri !== "pertinence") requete.tri = tri;
    if (prixMax) requete.prixMax = String(prixMax);
    if (chargeMin) requete.chargeMin = String(chargeMin);
    if (freineeSeulement) requete.freinee = "oui";
    if (instantaneeSeulement) requete.instantanee = "oui";
    // La position suit les changements de filtre : la perdre en cliquant sur
    // une catégorie obligerait à la redemander, et donc à réautoriser.
    if (position) {
      requete.lon = String(position.longitude);
      requete.lat = String(position.latitude);
      requete.rayon = String(rayonKm);
    }

    for (const [cle, valeur] of Object.entries(modifications)) {
      if (valeur === undefined) delete requete[cle];
      else requete[cle] = valeur;
    }
    return requete;
  };

  return (
    <main>
      {/* ---------- Hero ----------
          Une bande à part, et non une barre collante pleine largeur : le champ
          y était étiré sur toute la fenêtre, ce qui n'aide personne à saisir
          un nom de ville, et occupait le premier écran sans rien annoncer. Le
          titre situe, la carte de recherche reste à la mesure de ce qu'on y
          tape. */}
      <section className="relative overflow-hidden bg-encre text-encre-texte">
        <div className="absolute inset-0">
          <Illustration
            src="/images/hero.webp"
            alt=""
            priorite
            className="h-full w-full"
            tailles="100vw"
          />
        </div>
        {/* Deux voiles superposés plutôt qu'un seul plus dense : l'un pose le
            contraste sur toute la surface, l'autre l'appuie du côté du texte
            et laisse la photographie respirer à droite, là où l'œil ne lit
            pas. Sans eux, le titre blanc se perd dans le ciel de l'image. */}
        <div aria-hidden className="absolute inset-0 bg-marque-950/70" />
        <div
          aria-hidden
          className="absolute inset-0 bg-linear-to-r from-marque-950/95 via-marque-950/70 to-marque-950/30"
        />

        <div className="relative mx-auto w-full max-w-[100rem] px-4 py-12 sm:px-6 sm:py-16">
          <h1 className="max-w-3xl text-2xl font-semibold tracking-tight text-balance sm:text-4xl">
            {titre}
          </h1>
          <span
            aria-hidden
            className="mt-4 block h-1 w-12 rounded-full bg-accent"
          />
          <p className="mt-4 max-w-2xl text-[1.0625rem] text-encre-texte-attenue">
            {total > 0
              ? t("accroche", { nombre: total })
              : t("resultats", { nombre: total })}
          </p>

          {/* Le champ rappelle la recherche en cours : le visiteur affine, il
              ne repart pas de zéro. */}
          <div className="mt-8 max-w-2xl">
            <FormulaireRecherche variante="carte" valeurInitiale={ville ?? ""} />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <BoutonAutourDeMoi rayonKm={RAYON_PAR_DEFAUT} surFondSombre />

            {/* Le rayon ne s'affiche qu'une fois la position connue : proposer
                « dans 25 km » de nulle part n'a pas de sens. */}
            {position ? (
              <ul className="flex flex-wrap gap-2">
                {RAYONS.map((valeur) => (
                  <li key={valeur}>
                    <Link
                      href={{
                        pathname: "/recherche",
                        query: avec({ rayon: String(valeur) }),
                      }}
                      aria-current={valeur === rayonKm ? "page" : undefined}
                      className={cn(
                        "inline-flex rounded-full border px-3 py-1 text-sm transition-colors",
                        valeur === rayonKm
                          ? "border-accent bg-accent text-accent-contraste"
                          : "border-encre-bordure bg-white/10 text-encre-texte backdrop-blur-sm hover:border-accent",
                      )}
                    >
                      {t("rayon", { km: valeur })}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      </section>

      <div className="mx-auto w-full max-w-[100rem] px-4 py-8 sm:px-6">
        {/* ---------- Filtres et tri, en barre ---------- */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm text-texte-attenue">
            {t("resultats", { nombre: total })}
          </p>
          {total > 0 ? (
            <TriResultats parametres={avec({})} valeur={tri} tris={TRIS} />
          ) : null}
        </div>

        <div className="mt-4">
          <FiltresRecherche
            parametres={avec({})}
            actifs={{
              categorie: categorie?.slug ?? "",
              prixMax,
              chargeMin,
              freinee: freineeSeulement,
              instantanee: instantaneeSeulement,
            }}
            paliersPrix={PALIERS_PRIX}
            paliersCharge={PALIERS_CHARGE}
            monnaie="€"
          />
        </div>

        <div className="mt-8">
        <VoletCarte points={pointsCarte} styleUrl={clientEnv.NEXT_PUBLIC_MAP_STYLE_URL}>
        {annonces.length > 0 ? (
          <>
            <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-2">
              {annonces.map((annonce) => (
                <li key={annonce.id}>
                  <CarteAnnonce annonce={annonce} />
                </li>
              ))}
            </ul>

            {/* Sortie du filtrage. Une liste courte laisse croire que le
                catalogue est vide, alors que ce sont les critères qui le
                réduisent : il faut pouvoir en sortir d'un geste, sans aller
                remettre cinq listes sur « Peu importe ». */}
            {filtresActifs > 0 ? (
              <div className="mt-10 border-t border-bordure pt-8 text-center">
                <p className="text-[0.9375rem] text-texte-attenue">
                  {t("toutVoir.texte", { nombre: total })}
                </p>
                <Bouton as={Link} href="/recherche" className="mt-4">
                  {t("toutVoir.action")}
                </Bouton>
              </div>
            ) : null}
          </>
        ) : (
          <section className="mt-8 rounded-carte border border-bordure bg-fond-doux p-8 sm:p-12">
            <h2 className="text-lg font-semibold">{t("vide.titre")}</h2>
            <p className="mt-2 max-w-xl text-texte-attenue">
              {ville ? t("vide.texteVille", { ville: villeAffichee }) : t("vide.texte")}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Bouton as={Link} href="/mettre-en-location">
                {t("vide.actionProprietaire")}
              </Bouton>
              <Bouton
                as={Link}
                href="/recherche"
                variante="secondaire"
              >
                {t("vide.actionElargir")}
              </Bouton>
            </div>
          </section>
        )}
        </VoletCarte>
        </div>
      </div>
    </main>
  );
}
