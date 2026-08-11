import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";

import { EnTeteEspace } from "@/components/espace/coquille-espace";
import { ListeVide } from "@/components/espace/indicateurs";
import { Bouton } from "@/components/ui/bouton";
import { Illustration } from "@/components/ui/illustration";
import { marchePourPays } from "@/config/markets";
import { NOMBRE_ETAPES } from "@/domain/annonce/publication";
import { Link } from "@/i18n/navigation";
import { PRIX_AFFICHE } from "@/lib/cn";
import { exigerProfil } from "@/server/authentification/garde";
import {
  annoncesPublieesDuProprietaire,
  brouillonsDuProprietaire,
} from "@/server/annonces/publication";

type Props = { params: Promise<{ locale: string }> };

export const metadata = { robots: { index: false, follow: false } };

/** Le parc change à chaque publication : rien à mettre en cache ici. */
export const dynamic = "force-dynamic";

export default async function PageAnnonces({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const compte = await exigerProfil(
    locale,
    "/proprietaire/annonces",
    "proprietaire",
  );

  const t = await getTranslations("espaces.loueur");
  const format = await getFormatter();

  const [annonces, brouillons] = await Promise.all([
    annoncesPublieesDuProprietaire(compte.id),
    brouillonsDuProprietaire(compte.id),
  ]);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-8 sm:py-10">
      <EnTeteEspace
        titre={t("annonces.titre")}
        sousTitre={t("annonces.chapo", { nombre: annonces.length })}
        actions={
          <Bouton as={Link} href="/proprietaire/annonces/publier" taille="grand">
            {t("annonces.publier")}
          </Bouton>
        }
      />

      {/* Les brouillons d'abord : ce sont eux qu'on revient terminer, et les
          reléguer en bas de page revient à les abandonner. */}
      {brouillons.length > 0 ? (
        <section className="mt-8">
          <h2 className="text-[1.0625rem] font-semibold">
            {t("annonces.brouillons")}
          </h2>

          <ul className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {brouillons.map((brouillon) => (
              <li
                key={brouillon.id}
                className="flex items-center gap-4 rounded-carte border border-dashed border-bordure bg-fond-eleve p-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{brouillon.titre}</p>
                  <p className="mt-0.5 text-sm text-texte-attenue">
                    {brouillon.ville} ·{" "}
                    {t("annonces.brouillonRang", {
                      rang: Math.min(brouillon.etapeAtteinte, NOMBRE_ETAPES),
                      total: NOMBRE_ETAPES,
                    })}
                  </p>
                </div>

                <Link
                  href={{
                    pathname: "/proprietaire/annonces/publier",
                    query: {
                      annonce: brouillon.id,
                      etape: String(
                        Math.min(brouillon.etapeAtteinte, NOMBRE_ETAPES),
                      ),
                    },
                  }}
                  className="shrink-0 rounded-champ border border-bordure px-3 py-2 text-sm font-medium transition-colors hover:border-accent hover:text-accent"
                >
                  {t("annonces.reprendre")}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-10">
        <h2 className="text-[1.0625rem] font-semibold">{t("annonces.parc")}</h2>

        {annonces.length === 0 ? (
          <div className="mt-4">
            <ListeVide
              titre={t("annonces.vide.titre")}
              texte={t("annonces.vide.texte")}
              action={
                <Bouton as={Link} href="/proprietaire/annonces/publier">
                  {t("annonces.publier")}
                </Bouton>
              }
            />
          </div>
        ) : (
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {annonces.map((annonce) => (
              <li
                key={annonce.id}
                className="flex items-center gap-4 rounded-carte border border-bordure bg-fond-eleve p-3 shadow-(--ombre-carte)"
              >
                <Illustration
                  src={annonce.photo ?? undefined}
                  alt=""
                  className="size-16 shrink-0 rounded-[0.5rem]"
                  tailles="64px"
                />

                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{annonce.titre}</p>
                  <p className="mt-0.5 text-sm text-texte-attenue">
                    {annonce.ville}
                    {annonce.ptacKg ? ` · ${annonce.ptacKg} kg` : ""}
                  </p>
                  {annonce.prixJour !== null ? (
                    <p className="mt-1 text-sm font-bold tabular-nums text-accent">
                      {format.number(annonce.prixJour / 100, {
                        ...PRIX_AFFICHE,
                        currency: annonce.devise,
                      })}
                      <span className="ml-1 font-normal text-texte-attenue">
                        {t("annonces.parJour")}
                      </span>
                    </p>
                  ) : null}
                </div>

                {/* Corriger passe par les mêmes six écrans, à l'étape du
                    matériel : la catégorie, elle, est figée une fois
                    l'annonce en ligne. */}
                <Link
                  href={{
                    pathname: "/proprietaire/annonces/publier",
                    query: { annonce: annonce.id, etape: "2" },
                  }}
                  className="shrink-0 rounded-champ border border-bordure px-3 py-2 text-sm font-medium transition-colors hover:border-accent hover:text-accent"
                >
                  {t("annonces.modifier")}
                </Link>

                <Link
                  href={{
                    pathname: "/remorque/[ville]/[slug]",
                    params: { ville: annonce.villeSlug, slug: annonce.slug },
                  }}
                  // Une annonce se consulte sur le marché de son pays. Sans
                  // cela, le lien vers une remorque belge, suivi depuis le
                  // site français, mène à une page introuvable — le catalogue
                  // étant cloisonné par pays.
                  locale={marchePourPays(annonce.pays)}
                  className="shrink-0 rounded-champ border border-bordure px-3 py-2 text-sm font-medium transition-colors hover:border-accent hover:text-accent"
                >
                  {t("annonces.voir")}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
