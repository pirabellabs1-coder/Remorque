import { getTranslations } from "next-intl/server";

import {
  ETAPES,
  NOMBRE_ETAPES,
  rangDe,
  type Etape,
} from "@/domain/annonce/publication";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";

/**
 * Fil des six étapes.
 *
 * Il dit trois choses à la fois : où l'on en est, combien il reste, et ce qui
 * est déjà acquis. Sans lui, un formulaire découpé en six écrans donne
 * l'impression d'un tunnel sans fin — c'est la première cause d'abandon d'une
 * mise en ligne.
 *
 * **Un rail plutôt qu'une rangée de pastilles.** Six pastilles alignées disent
 * qu'il y a six choses ; elles ne disent pas qu'elles se suivent. Le trait qui
 * les relie fait la différence entre une liste et un chemin — et un chemin,
 * on le termine. La portion déjà parcourue est peinte à l'accent : c'est la
 * seule chose qu'on lit vraiment en revenant sur un brouillon.
 *
 * **Les étapes franchies portent une coche, pas leur numéro.** Le numéro
 * répond à « laquelle », la coche à « est-ce fait » — et c'est la seconde
 * question qu'on se pose en parcourant le fil.
 *
 * Les étapes déjà franchies sont cliquables, les suivantes ne le sont pas :
 * proposer d'aller renseigner le prix avant d'avoir dit de quel matériel il
 * s'agit ne mène qu'à un écran qui refuse.
 *
 * Sur téléphone, le rail se replie en une jauge : six pastilles de quarante
 * pixels ne tiennent pas sur trois cent soixante, et les empiler ferait passer
 * le formulaire sous la ligne de flottaison.
 */
export async function FilEtapes({
  courante,
  atteinte,
  annonceId,
  enEdition = false,
}: {
  courante: Etape;
  /** Rang de l'étape la plus avancée déjà franchie. */
  atteinte: number;
  annonceId?: string;
  /** L'annonce est déjà en ligne : on corrige, on ne crée pas. */
  enEdition?: boolean;
}) {
  const t = await getTranslations("espaces.loueur.publication");

  const rangCourant = rangDe(courante);
  // La portion peinte s'arrête au centre de la pastille courante, non à sa
  // droite : un trait qui dépasse la position où l'on se trouve annonce un
  // travail qui n'est pas fait.
  const part =
    NOMBRE_ETAPES > 1
      ? ((rangCourant - 1) / (NOMBRE_ETAPES - 1)) * 100
      : 100;

  return (
    <nav aria-label={t("filEtapes")} className="border-b border-bordure pb-8">
      {/* ---------- Téléphone : une jauge ---------- */}
      <div className="sm:hidden">
        <div className="flex items-baseline justify-between">
          <p className="font-semibold">{t(`etapes.${courante}`)}</p>
          <p className="text-sm text-texte-attenue tabular-nums">
            {t("rang", { rang: rangCourant, total: NOMBRE_ETAPES })}
          </p>
        </div>
        <div
          className="mt-3 h-1.5 overflow-hidden rounded-full bg-fond-doux"
          role="progressbar"
          aria-valuenow={rangCourant}
          aria-valuemin={1}
          aria-valuemax={NOMBRE_ETAPES}
        >
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-500 ease-out"
            style={{ width: `${(rangCourant / NOMBRE_ETAPES) * 100}%` }}
          />
        </div>
      </div>

      {/* ---------- Ordinateur : le rail ---------- */}
      <div className="hidden sm:block">
        <p className="text-sm font-medium text-texte-attenue tabular-nums">
          {t("rang", { rang: rangCourant, total: NOMBRE_ETAPES })}
        </p>

        <div className="relative mt-5">
          {/* Le trait passe derrière les pastilles, à la hauteur de leur
              centre. `inset-x` le fait commencer et finir au centre des
              pastilles extrêmes plutôt qu'aux bords du conteneur, sans quoi il
              dépasserait de chaque côté. */}
          <div
            aria-hidden
            className="absolute top-4 right-0 left-0 mx-[calc(100%/12)] h-0.5 rounded-full bg-fond-doux"
          >
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-500 ease-out"
              style={{ width: `${part}%` }}
            />
          </div>

          <ol className="relative grid grid-cols-6">
            {ETAPES.map((etape) => {
              const rang = rangDe(etape);
              const active = etape === courante;
              const franchie = rang < rangCourant;

              // La catégorie ne se change pas après publication : elle commande
              // la page locale, les filtres de recherche et jusqu'aux champs
              // demandés. En changer reviendrait à publier un autre bien sous
              // la même adresse — mieux vaut retirer l'annonce et en déposer
              // une.
              const figee = enEdition && etape === "categorie";
              const accessible =
                annonceId !== undefined && rang <= atteinte && !active && !figee;

              const pastille = cn(
                "grid size-8 place-items-center rounded-full border-2 text-sm font-semibold transition-colors duration-300",
                active
                  ? "border-accent bg-accent text-accent-contraste"
                  : franchie
                    ? "border-accent bg-fond-eleve text-accent"
                    : "border-bordure bg-fond-eleve text-texte-attenue",
              );

              const libelle = cn(
                "mt-2 block px-1 text-center text-xs leading-tight transition-colors",
                active
                  ? "font-semibold text-texte"
                  : accessible
                    ? "text-texte-attenue group-hover:text-accent"
                    : "text-texte-attenue",
              );

              const contenu = (
                <>
                  <span className={pastille}>
                    {franchie ? (
                      <svg
                        viewBox="0 0 24 24"
                        aria-hidden
                        className="size-4"
                        fill="none"
                      >
                        <path
                          d="m5 13 4 4L19 7"
                          stroke="currentColor"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    ) : (
                      rang
                    )}
                  </span>
                  <span className={libelle}>{t(`etapes.${etape}`)}</span>
                </>
              );

              return (
                <li key={etape} className="flex justify-center">
                  {accessible ? (
                    <Link
                      href={{
                        pathname: "/proprietaire/annonces/publier",
                        query: { etape: String(rang), annonce: annonceId },
                      }}
                      className="group flex flex-col items-center"
                    >
                      {contenu}
                    </Link>
                  ) : (
                    <span
                      aria-current={active ? "step" : undefined}
                      className="flex flex-col items-center"
                    >
                      {contenu}
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </nav>
  );
}
