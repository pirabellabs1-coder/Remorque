import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";

import { EnTeteEspace } from "@/components/espace/coquille-espace";
import { BanniereEnAttente } from "@/components/espace/indicateurs";
import { Cellule, Pastille, Tableau } from "@/components/espace/tableau";
import { PRIX_AFFICHE } from "@/lib/cn";
import { comparaisonPays, listerPays } from "@/server/espaces/administration";

type Props = { params: Promise<{ locale: string }> };

export const metadata = { robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * Paramètres par pays — règle 2 du cadrage.
 *
 * Aucun taux n'est codé en dur : commission, TVA, plafond de caution et délai
 * de versement sont des données, pilotables depuis cet écran sans
 * redéploiement. C'est ce qui permet d'ouvrir un marché ou d'ajuster une
 * tarification sans mobiliser un développeur.
 *
 * Les taux sont stockés en points de base — 1 % vaut 100 — et jamais en
 * flottant : 0,15 n'est pas représentable exactement en binaire, et une
 * commission qui dérive d'un centime tous les mille calculs finit par se voir
 * en comptabilité.
 */
export default async function PagePays({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("espaces.admin.pays");
  const tPays = await getTranslations("accueil.villes.pays");
  const format = await getFormatter();

  const parametres = listerPays();
  const activite = comparaisonPays();

  const pourcentage = (pointsDeBase: number) =>
    `${format.number(pointsDeBase / 100, { minimumFractionDigits: 2 })} %`;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8 sm:py-10">
      <EnTeteEspace titre={t("titre")} sousTitre={t("chapo")} />

      <div className="mt-8">
        <BanniereEnAttente>{t("avertissement")}</BanniereEnAttente>
      </div>

      <Tableau
        className="mt-6"
        colonnes={[
          { cle: "pays", entete: t("pays") },
          { cle: "devise", entete: t("devise"), secondaire: true },
          { cle: "commission", entete: t("commission"), numerique: true },
          { cle: "tva", entete: t("tva"), numerique: true },
          { cle: "plafond", entete: t("plafond"), numerique: true },
          { cle: "delai", entete: t("delai"), numerique: true, secondaire: true },
          { cle: "etat", entete: t("etat") },
        ]}
      >
        {parametres.map((pays) => (
          <tr key={pays.code}>
            <th scope="row" className="px-5 py-3.5 text-left font-normal">
              {pays.nom}
            </th>
            <Cellule secondaire attenue>
              {pays.devise}
            </Cellule>
            <Cellule numerique>{pourcentage(pays.commissionPdb)}</Cellule>
            <Cellule numerique attenue>
              {pourcentage(pays.tvaPdb)}
            </Cellule>
            <Cellule numerique>
              {format.number(pays.plafondCaution / 100, {
                ...PRIX_AFFICHE,
                currency: pays.devise,
              })}
            </Cellule>
            <Cellule numerique secondaire attenue>
              {t("jours", { nombre: pays.delaiLiberation })}
            </Cellule>
            <Cellule>
              <Pastille ton={pays.actif ? "succes" : "neutre"}>
                {pays.actif ? t("actif") : t("inactif")}
              </Pastille>
            </Cellule>
          </tr>
        ))}
      </Tableau>

      {/* L'activité constatée à côté des réglages : c'est ce qui permet de
          décider d'ouvrir un marché, ou de reconnaître qu'il ne prend pas. */}
      <section className="mt-10">
        <h2 className="text-[1.0625rem] font-semibold">{t("activite")}</h2>
        <Tableau
          className="mt-4"
          colonnes={[
            { cle: "pays", entete: t("pays") },
            { cle: "utilisateurs", entete: t("utilisateurs"), numerique: true },
            { cle: "annonces", entete: t("annonces"), numerique: true },
            { cle: "reservations", entete: t("reservations"), numerique: true },
            { cle: "volume", entete: t("volume"), numerique: true },
          ]}
        >
          {activite.map((ligne) => (
            <tr key={ligne.pays}>
              <th scope="row" className="px-5 py-3.5 text-left font-normal">
                {tPays(ligne.pays)}
              </th>
              <Cellule numerique>{ligne.utilisateurs}</Cellule>
              <Cellule numerique>{ligne.annonces}</Cellule>
              <Cellule numerique>{ligne.reservations}</Cellule>
              <Cellule numerique>
                {format.number(ligne.volume / 100, {
                  ...PRIX_AFFICHE,
                  currency: "EUR",
                })}
              </Cellule>
            </tr>
          ))}
        </Tableau>
      </section>
    </div>
  );
}
