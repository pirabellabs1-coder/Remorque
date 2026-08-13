import { getTranslations, setRequestLocale } from "next-intl/server";

import { EnTeteEspace } from "@/components/espace/coquille-espace";
import { FormulaireEnregistre } from "@/components/espace/formulaire-enregistre";
import { enregistrerPreferences } from "@/server/compte/actions";

type Props = { params: Promise<{ locale: string }> };

export const metadata = { robots: { index: false, follow: false } };

const NOTIFICATIONS = [
  "notifDemande",
  "notifMessage",
  "notifVersement",
  "notifAvis",
] as const;

/**
 * Rien à mettre en cache ici.
 *
 * Les réglages changent depuis cet écran même : les servir en cache
 * montrerait à l'auteur d'une modification l'état d'avant la sienne.
 */
export const dynamic = "force-dynamic";

export default async function PageParametresLoueur({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("espaces.loueur.parametres");

  const champ =
    "mt-2 h-12 w-full rounded-champ border border-bordure bg-fond-eleve px-4 text-base text-texte";

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-8 sm:py-10">
      <EnTeteEspace titre={t("titre")} sousTitre={t("chapo")} />

      <FormulaireEnregistre action={enregistrerPreferences} className="mt-8">
        {/* ---------- Notifications ---------- */}
        <fieldset className="overflow-hidden rounded-carte border border-bordure bg-fond-eleve shadow-(--ombre-carte)">
          <legend className="sr-only">{t("notifications")}</legend>

          <div className="border-b border-bordure px-6 py-4">
            <p className="text-[0.9375rem] font-semibold">
              {t("notifications")}
            </p>
          </div>

          <table className="w-full text-left text-[0.9375rem]">
            <thead className="border-b border-bordure text-sm text-texte-attenue">
              <tr>
                <th scope="col" className="px-6 py-3 font-medium">
                  <span className="sr-only">{t("notifications")}</span>
                </th>
                <th scope="col" className="w-24 px-3 py-3 text-center font-medium">
                  {t("courriel")}
                </th>
                <th scope="col" className="w-24 px-3 py-3 text-center font-medium">
                  {t("sms")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-bordure">
              {NOTIFICATIONS.map((clef) => (
                <tr key={clef}>
                  <th scope="row" className="px-6 py-4 font-normal">
                    {t(clef)}
                  </th>
                  {/* Chaque case porte son propre libellé masqué : sans lui, un
                      lecteur d'écran annonce quatre cases identiques. */}
                  <td className="px-3 py-4 text-center">
                    <label>
                      <span className="sr-only">
                        {t(clef)} — {t("courriel")}
                      </span>
                      <input
                        type="checkbox"
                        name={`${clef}-courriel`}
                        defaultChecked
                        className="size-4 accent-[var(--accent)]"
                      />
                    </label>
                  </td>
                  <td className="px-3 py-4 text-center">
                    <label>
                      <span className="sr-only">
                        {t(clef)} — {t("sms")}
                      </span>
                      <input
                        type="checkbox"
                        name={`${clef}-sms`}
                        defaultChecked={clef === "notifDemande"}
                        className="size-4 accent-[var(--accent)]"
                      />
                    </label>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </fieldset>

        {/* ---------- Conditions ---------- */}
        <fieldset className="rounded-carte border border-bordure bg-fond-eleve p-6 shadow-(--ombre-carte)">
          <legend className="px-2 text-[0.9375rem] font-semibold">
            {t("conditions")}
          </legend>

          <div className="mt-4 grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="preavis" className="text-sm font-medium">
                {t("preavis")}
              </label>
              <select id="preavis" name="preavis" defaultValue="24" className={champ}>
                <option value="0">Aucun</option>
                <option value="12">12 heures</option>
                <option value="24">24 heures</option>
                <option value="48">48 heures</option>
              </select>
            </div>

            <div>
              <label htmlFor="dureeMax" className="text-sm font-medium">
                {t("dureeMax")}
              </label>
              <select id="dureeMax" name="dureeMax" defaultValue="7" className={champ}>
                <option value="3">3 jours</option>
                <option value="7">7 jours</option>
                <option value="14">14 jours</option>
                <option value="30">30 jours</option>
              </select>
            </div>
          </div>
        </fieldset>

      </FormulaireEnregistre>

      {/* ---------- Zone dangereuse ---------- */}
      <section className="mt-12 rounded-carte border border-danger/30 bg-danger/5 p-6">
        <h2 className="text-[0.9375rem] font-semibold text-danger">
          {t("danger")}
        </h2>
        <p className="mt-2 max-w-xl text-[0.9375rem] text-texte-attenue">
          {t("dangerTexte")}
        </p>
        <button
          type="button"
          className="mt-4 rounded-champ border border-danger px-4 py-2.5 text-sm font-medium text-danger transition-colors hover:bg-danger hover:text-white"
        >
          {t("fermer")}
        </button>
      </section>
    </div>
  );
}
