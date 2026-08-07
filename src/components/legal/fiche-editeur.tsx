import { getTranslations } from "next-intl/server";

import { adressePostale, ENTREPRISE } from "@/config/entreprise";

/**
 * Fiche d'identité de l'éditeur et de l'hébergeur.
 *
 * Ces informations sont des **faits**, pas de la prose : elles se consultent en
 * diagonale pour vérifier un numéro, jamais en continu. Elles méritent donc un
 * tableau plutôt qu'un paragraphe, où l'on trouve la ligne cherchée sans lire
 * les autres.
 *
 * Les champs vides sont affichés comme tels, avec la mention « à renseigner ».
 * Les masquer donnerait une fiche d'apparence complète, ce qui est exactement
 * ce qu'il ne faut pas : c'est en la lisant qu'on doit s'apercevoir qu'il
 * manque quelque chose.
 */

function Ligne({ libelle, valeur }: { libelle: string; valeur: string }) {
  return (
    <div className="px-5 py-3.5 sm:flex sm:gap-6">
      <dt className="text-sm text-texte-attenue sm:w-52 sm:shrink-0">{libelle}</dt>
      <dd
        className={
          valeur ? "mt-0.5 font-medium sm:mt-0" : "mt-0.5 text-attention sm:mt-0"
        }
      >
        {valeur || "à renseigner"}
      </dd>
    </div>
  );
}

export async function FicheEditeur() {
  const t = await getTranslations("legal.fiche");

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-[1.0625rem] font-semibold">{t("editeur")}</h2>
        <dl className="mt-4 divide-y divide-bordure overflow-hidden rounded-carte border border-bordure bg-fond-eleve">
          <Ligne libelle={t("raisonSociale")} valeur={ENTREPRISE.raisonSociale} />
          <Ligne libelle={t("formeJuridique")} valeur={ENTREPRISE.formeJuridique} />
          <Ligne libelle={t("capital")} valeur={ENTREPRISE.capitalSocial} />
          <Ligne libelle={t("siren")} valeur={ENTREPRISE.siren} />
          <Ligne libelle={t("rcs")} valeur={ENTREPRISE.rcs} />
          <Ligne libelle={t("tva")} valeur={ENTREPRISE.tvaIntracommunautaire} />
          <Ligne
            libelle={t("siege")}
            valeur={ENTREPRISE.adresse ? adressePostale() : ""}
          />
          <Ligne libelle={t("courriel")} valeur={ENTREPRISE.courriel} />
          <Ligne libelle={t("telephone")} valeur={ENTREPRISE.telephone} />
          <Ligne
            libelle={t("directeur")}
            valeur={ENTREPRISE.directeurPublication}
          />
        </dl>
      </section>

      <section>
        <h2 className="text-[1.0625rem] font-semibold">{t("hebergeur")}</h2>
        <dl className="mt-4 divide-y divide-bordure overflow-hidden rounded-carte border border-bordure bg-fond-eleve">
          <Ligne libelle={t("nom")} valeur={ENTREPRISE.hebergeur.nom} />
          <Ligne
            libelle={t("siege")}
            valeur={`${ENTREPRISE.hebergeur.adresse}, ${ENTREPRISE.hebergeur.pays}`}
          />
          <Ligne libelle={t("site")} valeur={ENTREPRISE.hebergeur.site} />
        </dl>
      </section>

      <section>
        <h2 className="text-[1.0625rem] font-semibold">{t("assureur")}</h2>
        <dl className="mt-4 divide-y divide-bordure overflow-hidden rounded-carte border border-bordure bg-fond-eleve">
          <Ligne libelle={t("nom")} valeur={ENTREPRISE.assureur.nom} />
          <Ligne libelle={t("police")} valeur={ENTREPRISE.assureur.police} />
        </dl>
      </section>
    </div>
  );
}
