import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";

import { EnTeteEspace } from "@/components/espace/coquille-espace";
import { ListeVide } from "@/components/espace/indicateurs";
import { Bouton } from "@/components/ui/bouton";
import { Illustration } from "@/components/ui/illustration";
import { Link } from "@/i18n/navigation";
import { PRIX_AFFICHE } from "@/lib/cn";
import { mesFavoris } from "@/server/espaces/locataire";

type Props = { params: Promise<{ locale: string }> };

export const metadata = { robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function PageFavoris({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("espaces.locataire.favoris");
  const format = await getFormatter();

  const favoris = mesFavoris();

  const montant = (centimes: number, devise: string) =>
    format.number(centimes / 100, { ...PRIX_AFFICHE, currency: devise });

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-8 sm:py-10">
      <EnTeteEspace titre={t("titre")} sousTitre={t("chapo")} />

      {favoris.length === 0 ? (
        <div className="mt-8">
          <ListeVide
            titre={t("vide.titre")}
            texte={t("vide.texte")}
            action={
              <Bouton as={Link} href="/recherche">
                {t("vide.action")}
              </Bouton>
            }
          />
        </div>
      ) : (
        <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {favoris.map((favori) => (
            <li key={favori.annonceId}>
              <article className="flex h-full flex-col overflow-hidden rounded-carte border border-bordure bg-fond-eleve shadow-(--ombre-carte)">
                <Link
                  href={{
                    pathname: "/remorque/[ville]/[slug]",
                    params: { ville: favori.villeSlug, slug: favori.slug },
                  }}
                  className="block"
                >
                  <Illustration
                    src={favori.photo}
                    alt=""
                    className="aspect-[4/3] w-full"
                    tailles="(min-width: 1024px) 320px, (min-width: 640px) 45vw, 100vw"
                  />
                </Link>

                <div className="flex flex-1 flex-col p-4">
                  <h2 className="font-semibold">
                    <Link
                      href={{
                        pathname: "/remorque/[ville]/[slug]",
                        params: { ville: favori.villeSlug, slug: favori.slug },
                      }}
                      className="hover:text-accent hover:underline"
                    >
                      {favori.titre}
                    </Link>
                  </h2>

                  <p className="mt-1 text-[0.9375rem] text-texte-attenue">
                    {favori.ville}
                  </p>

                  <p className="mt-2 text-sm text-texte-attenue">
                    {favori.note === null ? (
                      t("nonNotee")
                    ) : (
                      <>
                        <span aria-hidden>★ </span>
                        <span className="tabular-nums">
                          {format.number(favori.note, {
                            maximumFractionDigits: 1,
                          })}
                        </span>{" "}
                        · {t("avis", { nombre: favori.nombreAvis })}
                      </>
                    )}
                  </p>

                  <div className="mt-4 flex items-baseline gap-1.5">
                    <span className="text-lg font-bold tabular-nums">
                      {montant(favori.prixJour, favori.devise)}
                    </span>
                    <span className="text-sm text-texte-attenue">
                      {t("parJour")}
                    </span>
                  </div>

                  {/* La variation de prix depuis la mise en favori : c'est la
                      seule raison de revenir consulter cette liste, et donc la
                      seule chose que l'écran doit signaler de lui-même. */}
                  {favori.variationPrix !== 0 ? (
                    <p
                      className={
                        favori.variationPrix < 0
                          ? "mt-2 text-sm font-medium text-succes"
                          : "mt-2 text-sm font-medium text-attention"
                      }
                    >
                      {favori.variationPrix < 0
                        ? t("baisse", {
                            montant: montant(
                              Math.abs(favori.variationPrix),
                              favori.devise,
                            ),
                          })
                        : t("hausse", {
                            montant: montant(favori.variationPrix, favori.devise),
                          })}
                    </p>
                  ) : null}

                  <p className="mt-auto pt-4 text-xs text-texte-attenue">
                    {t("ajouteLe", {
                      date: format.dateTime(favori.ajouteLe, {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      }),
                    })}
                  </p>
                </div>
              </article>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
