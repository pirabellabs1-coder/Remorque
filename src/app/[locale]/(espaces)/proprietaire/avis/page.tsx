import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";

import { EnTeteEspace } from "@/components/espace/coquille-espace";
import { Barres } from "@/components/espace/graphique";
import { ListeVide } from "@/components/espace/indicateurs";
import { Etoiles } from "@/components/espace/statut";
import { listerAvis } from "@/server/espaces/activite";

type Props = { params: Promise<{ locale: string }> };

export const metadata = { robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function PageAvis({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("espaces.loueur.avis");
  const format = await getFormatter();

  const avis = await listerAvis();
  const moyenne =
    avis.length > 0
      ? avis.reduce((somme, entree) => somme + entree.note, 0) / avis.length
      : null;

  // De cinq à une étoile, et non l'inverse : c'est l'ordre dans lequel on lit
  // une répartition de notes partout ailleurs.
  const repartition = [5, 4, 3, 2, 1].map((note) => ({
    etiquette: t("etoiles", { nombre: note }),
    valeur: avis.filter((entree) => entree.note === note).length,
  }));

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-8 sm:py-10">
      <EnTeteEspace
        titre={t("titre")}
        sousTitre={t("chapo", { nombre: avis.length })}
      />

      {avis.length === 0 ? (
        <div className="mt-8">
          <ListeVide titre={t("vide.titre")} texte={t("vide.texte")} />
        </div>
      ) : (
        <>
          <div className="mt-8 grid gap-6 rounded-carte border border-bordure bg-fond-eleve p-6 shadow-(--ombre-carte) sm:grid-cols-[auto_1fr] sm:gap-10">
            <div className="text-center sm:text-left">
              <p className="text-sm text-texte-attenue">{t("moyenne")}</p>
              <p className="mt-1 text-[3rem] leading-none font-bold tabular-nums">
                {format.number(moyenne ?? 0, { maximumFractionDigits: 1 })}
              </p>
              <div className="mt-3 flex justify-center sm:justify-start">
                <Etoiles note={moyenne ?? 0} />
              </div>
            </div>

            <div className="min-w-0">
              <p className="text-sm font-medium">{t("repartition")}</p>
              <div className="mt-4">
                <Barres points={repartition} />
              </div>
            </div>
          </div>

          <ul className="mt-8 space-y-4">
            {avis.map((entree) => (
              <li
                key={entree.id}
                className="rounded-carte border border-bordure bg-fond-eleve p-5 shadow-(--ombre-carte)"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">{entree.auteur}</p>
                    <p className="mt-0.5 text-sm text-texte-attenue">
                      {entree.annonceTitre} ·{" "}
                      {format.dateTime(entree.date, {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                  <Etoiles note={entree.note} />
                </div>

                <p className="mt-3 text-[0.9375rem]">{entree.texte}</p>

                {entree.reponse ? (
                  <div className="mt-4 rounded-champ border-l-2 border-accent bg-fond-doux px-4 py-3">
                    <p className="text-sm font-medium">{t("votreReponse")}</p>
                    <p className="mt-1 text-[0.9375rem] text-texte-attenue">
                      {entree.reponse}
                    </p>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
