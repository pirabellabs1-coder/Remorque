import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";

import { EnTeteEspace } from "@/components/espace/coquille-espace";
import { ListeVide } from "@/components/espace/indicateurs";
import { Cellule, Pastille, Tableau } from "@/components/espace/tableau";
import { Link } from "@/i18n/navigation";
import { PRIX_AFFICHE } from "@/lib/cn";
import { listerSinistres, type Sinistre } from "@/server/espaces/administration";

type Props = { params: Promise<{ locale: string }> };

export const metadata = { robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const TONS: Record<Sinistre["statut"], "attente" | "actif" | "succes" | "danger"> = {
  declare: "attente",
  transmis: "actif",
  en_cours: "actif",
  indemnise: "succes",
  refuse: "danger",
};

export default async function PageAssurance({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("espaces.admin.assurance");
  const format = await getFormatter();

  const sinistres = (await listerSinistres());
  const devise = sinistres[0]?.devise ?? "EUR";

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8 sm:py-10">
      <EnTeteEspace titre={t("titre")} sousTitre={t("chapo")} />

      {sinistres.length === 0 ? (
        <div className="mt-8">
          <ListeVide titre={t("vide.titre")} texte={t("vide.texte")} />
        </div>
      ) : (
        <Tableau
          className="mt-8"
          colonnes={[
            { cle: "reference", entete: t("reference") },
            { cle: "reservation", entete: t("reservation"), secondaire: true },
            { cle: "nature", entete: t("nature") },
            { cle: "declare", entete: t("declareLe"), secondaire: true },
            { cle: "transmis", entete: t("transmisLe"), secondaire: true },
            { cle: "montant", entete: t("montant"), numerique: true },
            { cle: "statut", entete: t("statut") },
          ]}
        >
          {sinistres.map((sinistre) => (
            <tr key={sinistre.id}>
              <th
                scope="row"
                className="px-5 py-3.5 text-left font-mono text-sm font-normal whitespace-nowrap"
              >
                {/* La référence mène au dossier : c'est là que la plateforme
                    transmet, indemnise ou refuse. */}
                <Link
                  href={{
                    pathname: "/admin/sinistres/[sinistre]",
                    params: { sinistre: sinistre.id },
                  }}
                  className="underline-offset-4 transition-colors hover:text-accent hover:underline"
                >
                  {sinistre.reference}
                </Link>
              </th>
              <Cellule secondaire attenue className="font-mono text-sm">
                {sinistre.reservationReference}
              </Cellule>
              <Cellule>{t(`natures.${sinistre.nature}` as never)}</Cellule>
              <Cellule secondaire attenue>
                {format.dateTime(sinistre.declareLe, {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                })}
              </Cellule>
              <Cellule secondaire attenue>
                {sinistre.transmisLe
                  ? format.dateTime(sinistre.transmisLe, {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                    })
                  : t("nonTransmis")}
              </Cellule>
              <Cellule numerique>
                {format.number(sinistre.montantEstime / 100, {
                  ...PRIX_AFFICHE,
                  currency: devise,
                })}
              </Cellule>
              <Cellule>
                <Pastille ton={TONS[sinistre.statut]}>
                  {t(`statuts.${sinistre.statut}` as never)}
                </Pastille>
              </Cellule>
            </tr>
          ))}
        </Tableau>
      )}

      <section className="mt-8 rounded-carte border border-bordure bg-fond-doux p-6">
        <h2 className="text-[0.9375rem] font-semibold">{t("delaiTitre")}</h2>
        <p className="mt-2 max-w-2xl text-[0.9375rem] text-texte-attenue">
          {t("delaiTexte")}
        </p>
      </section>
    </div>
  );
}
