import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";

import { EnTeteEspace } from "@/components/espace/coquille-espace";
import { ListeVide } from "@/components/espace/indicateurs";
import { Cellule, Tableau } from "@/components/espace/tableau";
import { listerAudit } from "@/server/espaces/administration";

type Props = { params: Promise<{ locale: string }> };

export const metadata = { robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * Journal d'audit — règle 5 du cadrage.
 *
 * Écriture seule : aucune entrée ne peut être modifiée ni supprimée, y compris
 * par un super-administrateur. C'est la condition pour qu'il ait une valeur
 * probante ; un journal que l'on peut nettoyer ne prouve rien. L'écran ne
 * propose donc volontairement aucune action — ni édition, ni suppression, ni
 * purge.
 *
 * L'état avant et après est affiché quand il existe : « commission modifiée »
 * sans les deux valeurs n'apprend rien à qui relit le journal six mois plus
 * tard pour comprendre un écart de facturation.
 */
export default async function PageJournalAudit({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("espaces.admin.journalAudit");
  const format = await getFormatter();

  const entrees = listerAudit();

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8 sm:py-10">
      <EnTeteEspace titre={t("titre")} sousTitre={t("chapo")} />

      {entrees.length === 0 ? (
        <div className="mt-8">
          <ListeVide titre={t("vide.titre")} texte={t("vide.texte")} />
        </div>
      ) : (
        <Tableau
          className="mt-8"
          colonnes={[
            { cle: "horodatage", entete: t("horodatage") },
            { cle: "auteur", entete: t("auteur"), secondaire: true },
            { cle: "action", entete: t("action") },
            { cle: "cible", entete: t("cible"), secondaire: true },
            { cle: "motif", entete: t("motif"), secondaire: true },
            { cle: "changement", entete: `${t("avant")} → ${t("apres")}` },
          ]}
        >
          {entrees.map((entree) => (
            <tr key={entree.id}>
              <th
                scope="row"
                className="px-5 py-3.5 text-left text-sm font-normal whitespace-nowrap tabular-nums"
              >
                {format.dateTime(entree.horodatage, {
                  day: "2-digit",
                  month: "2-digit",
                  year: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </th>
              <Cellule secondaire attenue className="font-mono text-sm">
                {entree.auteur}
              </Cellule>
              <Cellule>{entree.action}</Cellule>
              <Cellule secondaire attenue className="font-mono text-sm">
                {entree.cible}
              </Cellule>
              <Cellule secondaire attenue className="max-w-72">
                {entree.motif}
              </Cellule>
              <Cellule>
                {entree.avant || entree.apres ? (
                  <span className="whitespace-nowrap">
                    <span className="text-texte-attenue line-through">
                      {entree.avant ?? "—"}
                    </span>{" "}
                    <span aria-hidden>→</span>{" "}
                    <span className="font-medium">{entree.apres ?? "—"}</span>
                  </span>
                ) : (
                  <span className="text-texte-attenue">
                    {t("sansChangement")}
                  </span>
                )}
              </Cellule>
            </tr>
          ))}
        </Tableau>
      )}
    </div>
  );
}
