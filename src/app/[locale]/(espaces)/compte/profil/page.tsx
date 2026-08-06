import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";

import { EnTeteEspace } from "@/components/espace/coquille-espace";
import { Pastille } from "@/components/espace/tableau";
import { Bouton } from "@/components/ui/bouton";
import { Champ } from "@/components/ui/champ";
import { BAREME_FR, type CategoriePermis } from "@/domain/compatibilite/permis";
import { Link } from "@/i18n/navigation";
import { compteConnecte } from "@/server/authentification/session";

type Props = { params: Promise<{ locale: string }> };

export const metadata = { robots: { index: false, follow: false } };

/**
 * Profil du locataire.
 *
 * Le véhicule n'est pas une coquetterie de formulaire : c'est l'entrée du
 * moteur de compatibilité. Les champs reprennent exactement le vocabulaire de
 * `domain/compatibilite/permis.ts` — PTAC, masse tractable freinée et non
 * freinée — et non des approximations comme « poids remorquable ». Deux
 * raisons : ces valeurs se lisent telles quelles sur la carte grise, dont les
 * numéros de case sont rappelés ; et le jour où le formulaire alimentera le
 * domaine, il n'y aura aucune conversion à écrire, donc aucune à se tromper.
 *
 * La capacité affichée en bas est **dérivée**, jamais saisie. Elle croise les
 * deux limites — celle du permis et celle du constructeur — et retient la plus
 * basse. Laisser l'usager la saisir lui-même reviendrait à lui demander de
 * faire le calcul que la plateforme existe pour faire à sa place.
 */
export default async function PageProfilLocataire({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("espaces.locataire.profil");
  const format = await getFormatter();

  // Le compte réellement connecté, non un exemple : c'est son identité que la
  // personne vient vérifier, et voir le nom de quelqu'un d'autre dans ses
  // propres réglages est le genre de détail qui fait douter de tout le reste.
  const compte = await compteConnecte();

  // Jeu d'essai, en attendant la base. Les valeurs sont celles d'un véhicule
  // familial courant, pour que la capacité calculée soit représentative.
  const permis: CategoriePermis = "B";
  const vehicule = {
    marque: "Peugeot",
    modele: "5008",
    immatriculation: "GF-482-KR",
    ptacKg: 2_180,
    tractableFreineKg: 1_500,
    tractableNonFreineKg: 750,
    faisceauBroches: 13,
  };

  const PLAFONDS: Record<CategoriePermis, number> = {
    B: BAREME_FR.plafondEnsembleB,
    B96: BAREME_FR.plafondEnsembleB96,
    BE: BAREME_FR.plafondEnsembleBE,
  };

  // Limite légale : ce que le permis autorise, une fois retiré le PTAC du
  // véhicule tracteur. Jamais négative.
  const limiteLegale = Math.max(0, PLAFONDS[permis] - vehicule.ptacKg);

  // Limite physique : ce que le constructeur autorise. Le BE est en outre
  // plafonné par le PTAC de remorque maximal du barème ; les autres catégories
  // n'ont pas de plafond propre, leur limite venant déjà de l'ensemble.
  const PLAFONDS_REMORQUE: Record<CategoriePermis, number> = {
    B: Number.POSITIVE_INFINITY,
    B96: Number.POSITIVE_INFINITY,
    BE: BAREME_FR.plafondRemorqueBE,
  };

  const limitePhysique = Math.min(
    vehicule.tractableFreineKg,
    PLAFONDS_REMORQUE[permis],
  );

  const capacite = Math.min(limiteLegale, limitePhysique);

  const kilos = (poids: number) => `${format.number(poids)} kg`;

  const champ =
    "mt-2 h-12 w-full rounded-champ border border-bordure bg-fond-eleve px-4 text-base text-texte";

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-8 sm:py-10">
      <EnTeteEspace titre={t("titre")} sousTitre={t("chapo")} />

      <form className="mt-8 space-y-8">
        {/* ---------- Identité ---------- */}
        <fieldset className="rounded-carte border border-bordure bg-fond-eleve p-6 shadow-(--ombre-carte)">
          <legend className="px-2 text-[0.9375rem] font-semibold">
            {t("identite")}
          </legend>

          <div className="mt-4 grid gap-5 sm:grid-cols-2">
            <Champ
              libelle={t("prenom")}
              name="prenom"
              defaultValue={compte?.prenom ?? ""}
            />
            <Champ
              libelle={t("nom")}
              name="nom"
              defaultValue={compte?.nom ?? ""}
            />
            <Champ
              libelle={t("courriel")}
              name="courriel"
              type="email"
              defaultValue={compte?.email ?? ""}
              className="sm:col-span-2"
            />
            <Champ
              libelle={t("telephone")}
              name="telephone"
              type="tel"
              defaultValue="+33 6 12 34 56 78"
              className="sm:col-span-2"
            />
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3 rounded-champ bg-fond-doux px-4 py-3">
            <Pastille ton="succes">{t("verifie")}</Pastille>
            <span className="text-sm text-texte-attenue">
              {t("verifieLe", {
                date: format.dateTime(new Date(2026, 2, 14), {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                }),
              })}
            </span>
          </div>
          <p className="mt-2 text-sm text-texte-attenue">{t("verifieTexte")}</p>
        </fieldset>

        {/* ---------- Permis ---------- */}
        <fieldset className="rounded-carte border border-bordure bg-fond-eleve p-6 shadow-(--ombre-carte)">
          <legend className="px-2 text-[0.9375rem] font-semibold">
            {t("permis")}
          </legend>
          <p className="mt-2 text-[0.9375rem] text-texte-attenue">
            {t("permisAide")}
          </p>

          <div className="mt-4 grid gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="permisCategorie" className="text-sm font-medium">
                {t("permisCategorie")}
              </label>
              <select
                id="permisCategorie"
                name="permisCategorie"
                defaultValue={permis}
                className={champ}
              >
                {(["B", "B96", "BE"] as CategoriePermis[]).map((categorie) => (
                  <option key={categorie} value={categorie}>
                    {t(`categories.${categorie}` as never)}
                  </option>
                ))}
              </select>
            </div>

            <Champ
              libelle={t("permisNumero")}
              name="permisNumero"
              defaultValue="18FR20419"
            />
            <Champ
              libelle={t("permisObtenu")}
              name="permisObtenu"
              type="date"
              defaultValue="2018-06-22"
            />
          </div>
        </fieldset>

        {/* ---------- Véhicule ---------- */}
        <fieldset className="rounded-carte border border-bordure bg-fond-eleve p-6 shadow-(--ombre-carte)">
          <legend className="px-2 text-[0.9375rem] font-semibold">
            {t("vehicule")}
          </legend>
          <p className="mt-2 text-[0.9375rem] text-texte-attenue">
            {t("vehiculeAide")}
          </p>

          <div className="mt-4 grid gap-5 sm:grid-cols-2">
            <Champ
              libelle={t("marque")}
              name="marque"
              defaultValue={vehicule.marque}
            />
            <Champ
              libelle={t("modele")}
              name="modele"
              defaultValue={vehicule.modele}
            />
            <Champ
              libelle={t("immatriculation")}
              name="immatriculation"
              defaultValue={vehicule.immatriculation}
              className="sm:col-span-2"
            />

            {/* Les numéros de case de la carte grise sont donnés en aide :
                c'est là que l'usager va lire la valeur, et sans le repère il
                saisit à peu près, ce qui fausse tout le calcul en aval. */}
            <Champ
              libelle={t("ptacVehicule")}
              aide={t("ptacVehiculeAide")}
              name="ptacVehicule"
              type="number"
              inputMode="numeric"
              defaultValue={vehicule.ptacKg}
            />
            <Champ
              libelle={t("tractableFreine")}
              aide={t("tractableFreineAide")}
              name="tractableFreine"
              type="number"
              inputMode="numeric"
              defaultValue={vehicule.tractableFreineKg}
            />
            <Champ
              libelle={t("tractableNonFreine")}
              aide={t("tractableNonFreineAide")}
              name="tractableNonFreine"
              type="number"
              inputMode="numeric"
              defaultValue={vehicule.tractableNonFreineKg}
            />

            <div>
              <label htmlFor="faisceau" className="text-sm font-medium">
                {t("faisceau")}
              </label>
              <select
                id="faisceau"
                name="faisceau"
                defaultValue={vehicule.faisceauBroches}
                className={champ}
              >
                <option value={7}>{t("faisceau7")}</option>
                <option value={13}>{t("faisceau13")}</option>
              </select>
            </div>
          </div>
        </fieldset>

        {/* ---------- Capacité dérivée ---------- */}
        <section className="rounded-carte border border-accent/30 bg-accent/5 p-6">
          <h2 className="text-[0.9375rem] font-semibold">{t("capacite")}</h2>

          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="rounded-champ bg-fond-eleve p-4">
              <dt className="text-sm text-texte-attenue">
                {t("capaciteLegale")}
              </dt>
              <dd className="mt-1 text-xl font-bold tabular-nums">
                {kilos(limiteLegale)}
              </dd>
              <p className="mt-1 text-xs text-texte-attenue">
                {t("capaciteLegaleTexte")}
              </p>
            </div>

            <div className="rounded-champ bg-fond-eleve p-4">
              <dt className="text-sm text-texte-attenue">
                {t("capacitePhysique")}
              </dt>
              <dd className="mt-1 text-xl font-bold tabular-nums">
                {kilos(limitePhysique)}
              </dd>
              <p className="mt-1 text-xs text-texte-attenue">
                {t("capacitePhysiqueTexte")}
              </p>
            </div>
          </dl>

          <p className="mt-5 text-[1.0625rem] font-semibold">
            {t("capaciteRetenue", { poids: format.number(capacite) })}
          </p>
          <p className="mt-1 text-[0.9375rem] text-texte-attenue">
            {t("capaciteRetenueTexte")}
          </p>

          <Link
            href="/calculateur-de-charge"
            className="mt-4 inline-block text-sm font-medium text-accent hover:underline"
          >
            {t("calculateur")}
          </Link>
        </section>

        <Bouton type="submit">{t("enregistrer")}</Bouton>
      </form>
    </div>
  );
}
