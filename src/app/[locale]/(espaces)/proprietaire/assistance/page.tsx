import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";

import { EnTeteEspace } from "@/components/espace/coquille-espace";
import { FormulaireDemande } from "@/components/espace/formulaire-demande";
import { Link } from "@/i18n/navigation";
import { mesDemandes, mesLocationsRattachables } from "@/server/support/depot";

type Props = { params: Promise<{ locale: string }> };

export const metadata = { robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * Les demandes d'assistance d'un loueur, et de quoi en ouvrir une.
 *
 * La même page que côté locataire, à l'adresse de l'autre espace. Un compte
 * qui n'a que le profil loueur ne franchit pas la garde de `/compte` : sans
 * cette porte-ci, celui dont la caution est retenue n'aurait aucun moyen
 * d'écrire — la page de contact publique restant sans formulaire par choix.
 */
export default async function PageAssistanceLoueur({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("espaces.support");
  const format = await getFormatter();

  const demandes = await mesDemandes();
  const locations = await mesLocationsRattachables();

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-8 sm:py-10">
      <EnTeteEspace titre={t("titre")} sousTitre={t("chapo")} />

      {demandes.length > 0 ? (
        <section className="mt-8">
          <h2 className="text-[0.9375rem] font-semibold">{t("mesDemandes")}</h2>
          <ul className="mt-3 space-y-2">
            {demandes.map((demande) => (
              <li key={demande.id}>
                <Link
                  href={{
                    pathname: "/proprietaire/assistance/[demande]",
                    params: { demande: demande.id },
                  }}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-carte border border-bordure bg-fond-eleve p-4 transition-colors hover:border-accent"
                >
                  <span>
                    <span className="font-medium">{demande.sujet}</span>
                    <span className="mt-0.5 block font-mono text-sm text-texte-attenue">
                      {demande.reference} ·{" "}
                      {format.dateTime(demande.ouvertLe, {
                        day: "numeric",
                        month: "long",
                      })}
                    </span>
                  </span>
                  <span
                    className={
                      demande.statut === "resolu"
                        ? "rounded-full bg-succes/15 px-3 py-1 text-sm font-medium text-succes"
                        : "rounded-full bg-attention/15 px-3 py-1 text-sm font-medium text-attention"
                    }
                  >
                    {t(`statuts.${demande.statut}` as never)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-10">
        <h2 className="text-[0.9375rem] font-semibold">{t("nouvelleDemande")}</h2>
        <p className="mt-1 text-sm text-texte-attenue">{t("nouvelleDemandeAide")}</p>
        <FormulaireDemande locations={locations} />
      </section>
    </div>
  );
}
