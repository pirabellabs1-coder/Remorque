import { getFormatter, getTranslations } from "next-intl/server";

import { Etoiles } from "@/components/espace/statut";
import type { AvisPublic } from "@/server/annonces/avis";

/**
 * Bloc d'avis, partagé par l'accueil et les pages de ville.
 *
 * Il était d'abord écrit dans l'accueil ; le reprendre par copie sur les pages
 * locales aurait créé deux blocs à corriger en parallèle, et l'un des deux
 * aurait fini par diverger — c'est toujours celui qu'on oublie qui reste en
 * production.
 *
 * Ce que le composant ne fait pas, volontairement : calculer une moyenne. Elle
 * lui est donnée, et elle porte sur *tous* les avis de la sélection, jamais
 * sur les trois montrés. Une moyenne calculée sur des avis choisis serait une
 * flatterie, et une fausse.
 */
export async function SectionAvis({
  avis,
  nombre,
  moyenne,
  titre,
  chapo,
}: {
  avis: AvisPublic[];
  nombre: number;
  moyenne: number | null;
  titre: string;
  chapo: string;
}) {
  if (avis.length === 0) return null;

  const t = await getTranslations("accueil.avis");
  const format = await getFormatter();

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <h2 className="text-2xl font-semibold tracking-tight">{titre}</h2>
          <p className="mt-3 text-texte-attenue">{chapo}</p>
        </div>

        {moyenne !== null ? (
          <p className="text-[0.9375rem] text-texte-attenue">
            {t("synthese", {
              moyenne: format.number(moyenne, { maximumFractionDigits: 1 }),
              nombre,
            })}
          </p>
        ) : null}
      </div>

      <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {avis.map((entree) => (
          <li
            key={entree.id}
            className="flex flex-col rounded-carte border border-bordure-carte bg-fond-eleve p-6 shadow-(--ombre-carte)"
          >
            <Etoiles note={entree.note} />
            <blockquote className="mt-4 flex-1 text-[0.9375rem] leading-relaxed">
              {entree.texte}
            </blockquote>
            <p className="mt-4 text-sm font-medium text-texte-attenue">
              {entree.auteur}
            </p>
          </li>
        ))}
      </ul>
    </>
  );
}
