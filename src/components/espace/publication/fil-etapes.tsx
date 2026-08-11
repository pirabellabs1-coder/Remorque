import { getTranslations } from "next-intl/server";

import { ETAPES, NOMBRE_ETAPES, rangDe, type Etape } from "@/domain/annonce/publication";
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
 * Les étapes déjà franchies sont cliquables, les suivantes ne le sont pas :
 * proposer d'aller renseigner le prix avant d'avoir dit de quel matériel il
 * s'agit ne mène qu'à un écran qui refuse.
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

  return (
    <nav aria-label={t("filEtapes")} className="border-b border-bordure pb-6">
      <p className="text-sm font-medium text-texte-attenue">
        {t("rang", { rang: rangDe(courante), total: NOMBRE_ETAPES })}
      </p>

      <ol className="mt-3 flex flex-wrap gap-x-2 gap-y-2">
        {ETAPES.map((etape) => {
          const rang = rangDe(etape);
          const active = etape === courante;
          // La catégorie ne se change pas après publication : elle commande
          // la page locale, les filtres de recherche et jusqu'aux champs
          // demandés. En changer reviendrait à publier un autre bien sous la
          // même adresse — mieux vaut retirer l'annonce et en déposer une.
          const figee = enEdition && etape === "categorie";
          const accessible =
            annonceId !== undefined && rang <= atteinte && !active && !figee;

          const apparence = cn(
            "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors",
            active
              ? "border-accent bg-accent text-accent-contraste"
              : accessible
                ? "border-bordure hover:border-accent"
                : "border-bordure text-texte-attenue",
          );

          const contenu = (
            <>
              <span
                className={cn(
                  "grid size-5 shrink-0 place-items-center rounded-full text-xs font-semibold",
                  active ? "bg-white/20" : "bg-fond-doux",
                )}
              >
                {rang}
              </span>
              {t(`etapes.${etape}`)}
            </>
          );

          return (
            <li key={etape}>
              {accessible ? (
                <Link
                  href={{
                    pathname: "/proprietaire/annonces/publier",
                    query: { etape: String(rang), annonce: annonceId },
                  }}
                  className={apparence}
                >
                  {contenu}
                </Link>
              ) : (
                <span aria-current={active ? "step" : undefined} className={apparence}>
                  {contenu}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
