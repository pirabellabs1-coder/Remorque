import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";

import { EnTeteEspace } from "@/components/espace/coquille-espace";
import { ListeVide } from "@/components/espace/indicateurs";
import { Etoiles } from "@/components/espace/statut";
import { Bouton } from "@/components/ui/bouton";
import { Link } from "@/i18n/navigation";
import { avisAecrire, mesAvis } from "@/server/espaces/locataire";

type Props = { params: Promise<{ locale: string }> };

export const metadata = { robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function PageAvisLocataire({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("espaces.locataire.avis");
  const format = await getFormatter();

  const aEcrire = await avisAecrire();
  const publies = await mesAvis();

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-8 sm:py-10">
      <EnTeteEspace titre={t("titre")} sousTitre={t("chapo")} />

      {/* ---------- À écrire ---------- */}
      {aEcrire.length > 0 ? (
        <section className="mt-8">
          <h2 className="text-[1.0625rem] font-semibold">{t("aEcrire")}</h2>
          <p className="mt-1 text-[0.9375rem] text-texte-attenue">
            {t("aEcrireChapo")}
          </p>

          <ul className="mt-4 space-y-3">
            {aEcrire.map((entree) => (
              <li
                key={entree.reservationId}
                className="flex flex-wrap items-center justify-between gap-4 rounded-carte border border-bordure bg-fond-eleve p-4 shadow-(--ombre-carte)"
              >
                <div className="min-w-0">
                  <p className="font-medium">{entree.annonceTitre}</p>
                  <p className="mt-0.5 text-sm text-texte-attenue">
                    {t("chez", { prenom: entree.proprietaire })} ·{" "}
                    {format.dateTime(entree.finLe, {
                      day: "numeric",
                      month: "long",
                    })}
                  </p>
                  {/* Le délai restant en jours, non en date de fermeture :
                      « il vous reste 4 jours » se comprend d'un coup d'œil,
                      « avant le 12/08 » demande un calcul. */}
                  <p className="mt-1 text-sm font-medium text-attention">
                    {t("joursRestants", { nombre: entree.joursRestants })}
                  </p>
                </div>

                <Bouton
                  as={Link}
                  href={{
                    pathname: "/compte/avis/[reservation]",
                    params: { reservation: entree.reservationId },
                  }}
                  taille="petit"
                  variante="secondaire"
                >
                  {t("ecrire")}
                </Bouton>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* ---------- Publiés ---------- */}
      <section className="mt-10">
        <h2 className="text-[1.0625rem] font-semibold">{t("publies")}</h2>

        {publies.length === 0 ? (
          <div className="mt-4">
            <ListeVide titre={t("vide.titre")} texte={t("vide.texte")} />
          </div>
        ) : (
          <ul className="mt-4 space-y-4">
            {publies.map((avis) => (
              <li key={avis.id}>
                <article className="rounded-carte border border-bordure bg-fond-eleve p-5 shadow-(--ombre-carte)">
                  <div className="flex flex-wrap items-baseline justify-between gap-3">
                    <h3 className="font-medium">
                      <Link
                        href={{
                          pathname: "/remorque/[ville]/[slug]",
                          params: { ville: avis.villeSlug, slug: avis.slug },
                        }}
                        className="hover:text-accent hover:underline"
                      >
                        {avis.annonceTitre}
                      </Link>
                    </h3>
                    <time
                      dateTime={avis.date.toISOString()}
                      className="text-sm text-texte-attenue"
                    >
                      {format.dateTime(avis.date, {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </time>
                  </div>

                  <div className="mt-2 flex items-center gap-2">
                    <Etoiles note={avis.note} />
                    <span className="sr-only">{t("note", { note: avis.note })}</span>
                    <span className="text-sm text-texte-attenue">
                      {t("chez", { prenom: avis.proprietaire })}
                    </span>
                  </div>

                  <p className="mt-3 text-[0.9375rem]">{avis.texte}</p>

                  {/* La réponse du loueur en retrait : c'est une réplique, pas
                      un avis de même rang. */}
                  {avis.reponse ? (
                    <div className="mt-4 border-l-2 border-bordure pl-4">
                      <p className="text-sm font-medium text-texte-attenue">
                        {t("reponse")}
                      </p>
                      <p className="mt-1 text-[0.9375rem]">{avis.reponse}</p>
                    </div>
                  ) : null}
                </article>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
