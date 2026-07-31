import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";

import { EnTeteEspace } from "@/components/espace/coquille-espace";
import { CarteIndicateur, ListeVide } from "@/components/espace/indicateurs";
import { Cellule, Pastille, Tableau } from "@/components/espace/tableau";
import { PRIX_AFFICHE } from "@/lib/cn";
import { listerLitiges, type Litige } from "@/server/espaces/administration";

type Props = { params: Promise<{ locale: string }> };

export const metadata = { robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const TONS: Record<Litige["statut"], "danger" | "attente" | "succes"> = {
  ouvert: "danger",
  en_instruction: "attente",
  resolu: "succes",
};

/**
 * Litiges.
 *
 * La colonne « fonds gelés » est la raison d'être de cet écran. Chaque litige
 * ouvert immobilise le versement au propriétaire et la caution du locataire —
 * règle 6 du cadrage. Le montant total est rappelé en tête : c'est de
 * l'argent qui n'avance plus, et sa durée d'immobilisation est le seul
 * indicateur qui compte pour arbitrer la charge de travail.
 */
export default async function PageLitiges({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("espaces.admin.litiges");
  const format = await getFormatter();

  const litiges = listerLitiges();
  const ouverts = litiges.filter((litige) => litige.statut !== "resolu");
  const totalGele = ouverts.reduce((somme, litige) => somme + litige.fondsGeles, 0);
  const devise = litiges[0]?.devise ?? "EUR";

  const montant = (centimes: number) =>
    format.number(centimes / 100, { ...PRIX_AFFICHE, currency: devise });

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8 sm:py-10">
      <EnTeteEspace titre={t("titre")} sousTitre={t("chapo")} />

      {litiges.length === 0 ? (
        <div className="mt-8">
          <ListeVide titre={t("vide.titre")} texte={t("vide.texte")} />
        </div>
      ) : (
        <>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <CarteIndicateur
              libelle={t("statuts.ouvert")}
              valeur={litiges.filter((l) => l.statut === "ouvert").length}
            />
            <CarteIndicateur
              libelle={t("statuts.en_instruction")}
              valeur={litiges.filter((l) => l.statut === "en_instruction").length}
            />
            <CarteIndicateur
              libelle={t("geles")}
              valeur={montant(totalGele)}
            />
          </div>

          <Tableau
            className="mt-8"
            colonnes={[
              { cle: "reference", entete: t("reference") },
              { cle: "reservation", entete: t("reservation"), secondaire: true },
              { cle: "motif", entete: t("motif") },
              { cle: "partie", entete: t("partie"), secondaire: true },
              { cle: "ouvert", entete: t("ouvertLe"), secondaire: true },
              { cle: "enJeu", entete: t("enJeu"), numerique: true },
              { cle: "geles", entete: t("geles"), numerique: true },
              { cle: "statut", entete: t("statut") },
            ]}
          >
            {litiges.map((litige) => (
              <tr key={litige.id}>
                <th
                  scope="row"
                  className="px-5 py-3.5 text-left font-mono text-sm font-normal whitespace-nowrap"
                >
                  {litige.reference}
                </th>
                <Cellule secondaire attenue className="font-mono text-sm">
                  {litige.reservationReference}
                </Cellule>
                <Cellule>{t(`motifs.${litige.motif}` as never)}</Cellule>
                <Cellule secondaire attenue>
                  {t(`parties.${litige.partie}` as never)}
                </Cellule>
                <Cellule secondaire attenue>
                  {format.dateTime(litige.ouvertLe, {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                  })}
                </Cellule>
                <Cellule numerique>{montant(litige.montantEnJeu)}</Cellule>
                <Cellule
                  numerique
                  className={litige.fondsGeles > 0 ? "font-medium text-danger" : "text-texte-attenue"}
                >
                  {litige.fondsGeles > 0 ? montant(litige.fondsGeles) : "—"}
                </Cellule>
                <Cellule>
                  <Pastille ton={TONS[litige.statut]}>
                    {t(`statuts.${litige.statut}` as never)}
                  </Pastille>
                </Cellule>
              </tr>
            ))}
          </Tableau>
        </>
      )}
    </div>
  );
}
