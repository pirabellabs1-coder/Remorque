import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";

import { EnTeteEspace } from "@/components/espace/coquille-espace";
import { Courbe } from "@/components/espace/graphique";
import { CarteIndicateur } from "@/components/espace/indicateurs";
import { Cellule, Tableau } from "@/components/espace/tableau";
import { Link } from "@/i18n/navigation";
import { PRIX_AFFICHE } from "@/lib/cn";
import {
  comparaisonPays,
  inscriptionsParMois,
  syntheseAdmin,
} from "@/server/espaces/administration";

type Props = { params: Promise<{ locale: string }> };

export const metadata = { robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * Vue d'ensemble de l'administration.
 *
 * Les files d'attente passent avant les chiffres d'affaires. Ce qu'un
 * administrateur vient voir en arrivant, ce n'est pas le volume du mois —
 * qui se consulte quand on veut — c'est ce qui l'attend : une identité à
 * vérifier, un litige à arbitrer, un sinistre à transmettre.
 */
export default async function VueDensembleAdmin({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("espaces.admin.tableau");
  const tPays = await getTranslations("accueil.villes.pays");
  const format = await getFormatter();

  const synthese = (await syntheseAdmin());
  const pays = (await comparaisonPays());
  const inscriptions = (await inscriptionsParMois(12));

  const montant = (centimes: number) =>
    format.number(centimes / 100, {
      ...PRIX_AFFICHE,
      currency: synthese.devise,
    });

  const FILES = [
    {
      cle: "verifications",
      nombre: synthese.identitesAverifier,
      // La file de contrôle, et non la liste des comptes : un compteur qui
      // annonce trois dossiers en attente doit mener à l'écran où on les
      // traite, pas à un annuaire où il faut les retrouver.
      href: "/admin/verifications" as const,
    },
    { cle: "litiges", nombre: synthese.litigesOuverts, href: "/admin/litiges" as const },
    {
      cle: "sinistres",
      nombre: synthese.sinistresOuverts,
      href: "/admin/assurance" as const,
    },
    { cle: "support", nombre: synthese.ticketsOuverts, href: "/admin/support" as const },
  ];

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-8 sm:py-10">
      <EnTeteEspace titre={t("titre")} sousTitre={t("chapo")} />

      {/* ---------- Files d'attente ---------- */}
      <section className="mt-8">
        <h2 className="text-[1.0625rem] font-semibold">{t("files")}</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FILES.map((file) => (
            <Link
              key={file.cle}
              href={file.href}
              className="rounded-carte border border-bordure bg-fond-eleve p-5 shadow-(--ombre-carte) transition-colors hover:border-accent"
            >
              <p className="text-[0.8125rem] text-texte-attenue">
                {t(`file.${file.cle}` as never)}
              </p>
              <p className="mt-2 text-[2rem] leading-none font-bold tabular-nums">
                {file.nombre}
              </p>
              <p className="mt-2 text-xs text-texte-attenue">
                {t(`file.${file.cle}Precision` as never)}
              </p>
            </Link>
          ))}
        </div>
      </section>

      {/* ---------- Activité ---------- */}
      <section className="mt-10">
        <h2 className="text-[1.0625rem] font-semibold">{t("activite")}</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <CarteIndicateur
            libelle={t("volume")}
            valeur={montant(synthese.volumeAffaires)}
            precision={t("volumePrecision")}
          />
          <CarteIndicateur
            libelle={t("commission")}
            valeur={
              synthese.tauxCommissionReel === null
                ? undefined
                : `${format.number(synthese.tauxCommissionReel, {
                    maximumFractionDigits: 1,
                  })} %`
            }
            precision={t("commissionPrecision")}
          />
          <CarteIndicateur
            libelle={t("utilisateurs")}
            valeur={synthese.utilisateurs}
            precision={t("utilisateursPrecision", {
              nombre: synthese.nouveauxUtilisateurs30j,
            })}
          />
          <CarteIndicateur
            libelle={t("gel")}
            valeur={montant(synthese.fondsGeles)}
            precision={t("gelPrecision")}
          />
        </div>
      </section>

      {/* ---------- Croissance ---------- */}
      <section className="mt-10 rounded-carte border border-bordure bg-fond-eleve p-6 shadow-(--ombre-carte)">
        <h2 className="text-[1.0625rem] font-semibold">{t("croissanceTitre")}</h2>
        <div className="mt-6">
          <Courbe
            points={inscriptions}
            description={t("croissanceLegende")}
            format={(valeur) => format.number(valeur)}
          />
        </div>
      </section>

      {/* ---------- Comparaison entre pays ---------- */}
      <section className="mt-10">
        <h2 className="text-[1.0625rem] font-semibold">{t("pays")}</h2>
        <Tableau
          className="mt-4"
          colonnes={[
            { cle: "pays", entete: t("colonne.pays") },
            { cle: "annonces", entete: t("colonne.annonces"), numerique: true },
            {
              cle: "reservations",
              entete: t("colonne.reservations"),
              numerique: true,
            },
            { cle: "volume", entete: t("colonne.volume"), numerique: true },
          ]}
        >
          {pays.map((ligne) => (
            <tr key={ligne.pays}>
              <th scope="row" className="px-5 py-3.5 text-left font-normal">
                {tPays(ligne.pays)}
              </th>
              <Cellule numerique>{ligne.annonces}</Cellule>
              <Cellule numerique>{ligne.reservations}</Cellule>
              <Cellule numerique>{montant(ligne.volume)}</Cellule>
            </tr>
          ))}
        </Tableau>
      </section>
    </div>
  );
}
