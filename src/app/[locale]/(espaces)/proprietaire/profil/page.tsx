import { getTranslations, setRequestLocale } from "next-intl/server";

import { EnTeteEspace } from "@/components/espace/coquille-espace";
import { FormulaireEnregistre } from "@/components/espace/formulaire-enregistre";
import { Champ } from "@/components/ui/champ";
import { compteConnecte } from "@/server/authentification/session";
import { enregistrerIdentite } from "@/server/compte/actions";

type Props = { params: Promise<{ locale: string }> };

export const metadata = { robots: { index: false, follow: false } };

/**
 * Rien à mettre en cache ici.
 *
 * Le profil se modifie ici et se lit ailleurs — vérification comprise.
 * Une version figée ferait croire un dossier encore incomplet.
 */
export const dynamic = "force-dynamic";

export default async function PageProfilLoueur({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("espaces.loueur.profil");

  // Le compte réellement connecté : un profil prérempli avec le nom de
  // quelqu'un d'autre invite à l'enregistrer tel quel.
  const compte = await compteConnecte();

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-8 sm:py-10">
      <EnTeteEspace titre={t("titre")} sousTitre={t("chapo")} />

      <FormulaireEnregistre action={enregistrerIdentite} className="mt-8">
        <fieldset className="rounded-carte border border-bordure bg-fond-eleve p-6 shadow-(--ombre-carte)">
          <legend className="px-2 text-[0.9375rem] font-semibold">
            {t("identite")}
          </legend>

          <div className="mt-4 grid gap-5 sm:grid-cols-2">
            <Champ
              libelle={t("prenom")}
              name="prenom"
              autoComplete="given-name"
              defaultValue={compte?.prenom ?? ""}
            />
            <Champ
              libelle={t("nom")}
              name="nom"
              autoComplete="family-name"
              defaultValue={compte?.nom ?? ""}
            />
            <Champ
              libelle={t("courriel")}
              name="courriel"
              type="email"
              autoComplete="email"
            />
            <Champ
              libelle={t("telephone")}
              name="telephone"
              type="tel"
              autoComplete="tel"
            />
          </div>

          <label className="mt-5 flex items-start gap-3 text-[0.9375rem]">
            <input
              type="checkbox"
              name="professionnel"
              className="mt-1 size-4 accent-[var(--accent)]"
            />
            <span>
              {t("professionnel")}
              <span className="mt-0.5 block text-sm text-texte-attenue">
                {t("professionnelAide")}
              </span>
            </span>
          </label>
        </fieldset>

        <fieldset className="rounded-carte border border-bordure bg-fond-eleve p-6 shadow-(--ombre-carte)">
          <legend className="px-2 text-[0.9375rem] font-semibold">
            {t("paiement")}
          </legend>

          <div className="mt-4 grid gap-5 sm:grid-cols-2">
            <Champ
              libelle={t("titulaire")}
              name="titulaire"
              className="sm:col-span-2"
            />
            <Champ
              libelle={t("iban")}
              name="iban"
              aide={t("ibanAide")}
              placeholder="BE00 0000 0000 0000"
              className="sm:col-span-2"
            />
          </div>
        </fieldset>

        <fieldset className="rounded-carte border border-bordure bg-fond-doux p-6">
          <legend className="px-2 text-[0.9375rem] font-semibold">
            {t("verification")}
          </legend>
          <p className="mt-3 text-[0.9375rem] text-texte-attenue">
            {t("verificationTexte")}
          </p>
        </fieldset>

      </FormulaireEnregistre>
    </div>
  );
}
