import { getTranslations, setRequestLocale } from "next-intl/server";

import { BasculeMaintenance } from "@/components/espace/bascule-maintenance";
import { EnTeteEspace } from "@/components/espace/coquille-espace";
import { FormulaireEnregistre } from "@/components/espace/formulaire-enregistre";
import { Champ } from "@/components/ui/champ";
import {
  enregistrerParametres,
  lireParametres,
} from "@/server/administration/parametres";

type Props = { params: Promise<{ locale: string }> };

export const metadata = { robots: { index: false, follow: false } };

export default async function PageParametresAdmin({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("espaces.admin.parametres");

  // Les valeurs réellement enregistrées : un formulaire prérempli de valeurs
  // codées en dur ferait croire à des réglages qui ne s'appliquent nulle part.
  const reglages = await lireParametres();

  const champ =
    "mt-2 h-12 w-full rounded-champ border border-bordure bg-fond-eleve px-4 text-base text-texte";

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-8 sm:py-10">
      <EnTeteEspace titre={t("titre")} sousTitre={t("chapo")} />

      <FormulaireEnregistre action={enregistrerParametres} className="mt-8">
        <fieldset className="rounded-carte border border-bordure bg-fond-eleve p-6 shadow-(--ombre-carte)">
          <legend className="px-2 text-[0.9375rem] font-semibold">
            {t("general")}
          </legend>

          <div className="mt-4 grid gap-5 sm:grid-cols-2">
            <Champ
              libelle={t("nomPlateforme")}
              name="nomPlateforme"
              defaultValue={reglages.nomPlateforme ?? "FlexiTrailer"}
              className="sm:col-span-2"
            />
            <Champ
              libelle={t("courrielContact")}
              name="courrielContact"
              type="email"
              defaultValue={reglages.courrielContact ?? ""}
              className="sm:col-span-2"
            />

            <div>
              <label htmlFor="delaiReponse" className="text-sm font-medium">
                {t("delaiReponse")}
              </label>
              <select
                id="delaiReponse"
                name="delaiReponse"
                defaultValue={reglages.delaiReponse ?? "24"}
                className={champ}
              >
                <option value="12">{t("heures", { nombre: 12 })}</option>
                <option value="24">{t("heures", { nombre: 24 })}</option>
                <option value="48">{t("heures", { nombre: 48 })}</option>
              </select>
            </div>

            <div>
              <label htmlFor="delaiAvis" className="text-sm font-medium">
                {t("delaiAvis")}
              </label>
              <select
                id="delaiAvis"
                name="delaiAvis"
                defaultValue={reglages.delaiAvis ?? "14"}
                className={champ}
              >
                <option value="7">{t("jours", { nombre: 7 })}</option>
                <option value="14">{t("jours", { nombre: 14 })}</option>
                <option value="30">{t("jours", { nombre: 30 })}</option>
              </select>
            </div>
          </div>
        </fieldset>

        <fieldset className="rounded-carte border border-bordure bg-fond-eleve p-6 shadow-(--ombre-carte)">
          <legend className="px-2 text-[0.9375rem] font-semibold">
            {t("moderation")}
          </legend>

          <label className="mt-4 flex items-start gap-3 text-[0.9375rem]">
            <input
              type="checkbox"
              name="moderationApriori"
              defaultChecked={reglages.moderationApriori !== "false"}
              className="mt-1 size-4 accent-[var(--accent)]"
            />
            <span>
              {t("moderationApriori")}
              <span className="mt-0.5 block text-sm text-texte-attenue">
                {t("moderationAprioriAide")}
              </span>
            </span>
          </label>

          <label className="mt-5 flex items-start gap-3 text-[0.9375rem]">
            <input
              type="checkbox"
              name="verificationObligatoire"
              defaultChecked={reglages.verificationObligatoire !== "false"}
              className="mt-1 size-4 accent-[var(--accent)]"
            />
            <span>{t("verificationObligatoire")}</span>
          </label>
        </fieldset>

      </FormulaireEnregistre>

      {/* Le mode maintenance coupe l'accès public : il a sa place à part, en
          bas, et signale clairement ce qu'il fait. */}
      <section className="mt-12 rounded-carte border border-danger/30 bg-danger/5 p-6">
        <h2 className="text-[0.9375rem] font-semibold text-danger">
          {t("maintenance")}
        </h2>
        <p className="mt-2 max-w-xl text-[0.9375rem] text-texte-attenue">
          {t("maintenanceTexte")}
        </p>
        <BasculeMaintenance actif={reglages.maintenance === "true"} />
      </section>
    </div>
  );
}
