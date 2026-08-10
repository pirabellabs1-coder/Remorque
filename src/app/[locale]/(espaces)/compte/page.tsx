import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";

import { EnTeteEspace } from "@/components/espace/coquille-espace";
import { CarteIndicateur, ListeVide } from "@/components/espace/indicateurs";
import { PastilleStatut } from "@/components/espace/statut";
import { Bouton } from "@/components/ui/bouton";
import { Illustration } from "@/components/ui/illustration";
import { Link } from "@/i18n/navigation";
import { PRIX_AFFICHE } from "@/lib/cn";
import {
  avisAecrire,
  prochaineLocation,
  reservationsEnCours,
  syntheseLocataire,
} from "@/server/espaces/locataire";

type Props = { params: Promise<{ locale: string }> };

export const metadata = { robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * Tableau de bord du locataire.
 *
 * Ce que le locataire vient chercher, c'est une chose : où et quand retirer la
 * remorque de samedi. La prochaine location passe donc avant tout le reste, en
 * grand, avec ses dates et le prénom du loueur — pas les compteurs, qui ne se
 * consultent qu'en second.
 *
 * C'est la symétrie de l'arbitrage retenu côté administration, où les files
 * d'attente passent avant les chiffres d'affaires : dans les deux cas, l'écran
 * s'ouvre sur ce qui demande une action, non sur ce qui se contemple.
 */
export default async function TableauDeBordLocataire({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("espaces.locataire.tableau");
  const format = await getFormatter();

  const synthese = await syntheseLocataire();
  const enCours = await reservationsEnCours();
  const aEcrire = await avisAecrire();

  const mise = await prochaineLocation();
  const prochaine = mise?.reservation;

  const montant = (centimes: number, devise: string) =>
    format.number(centimes / 100, { ...PRIX_AFFICHE, currency: devise });

  const jourComplet = (date: Date) =>
    format.dateTime(date, {
      weekday: "long",
      day: "numeric",
      month: "long",
    });

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-8 sm:py-10">
      <EnTeteEspace titre={t("titre")} sousTitre={t("chapo")} />

      <div className="mt-8 space-y-10">
        {/* ---------- Prochaine location ---------- */}
        <section>
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="text-[1.0625rem] font-semibold">
              {enCours.length > 0 ? t("enCours") : t("prochaine")}
            </h2>
            <Link
              href="/compte/reservations"
              className="text-sm font-medium text-accent hover:underline"
            >
              {t("voirTout")}
            </Link>
          </div>

          <div className="mt-4">
            {prochaine ? (
              <article className="overflow-hidden rounded-carte border border-bordure bg-fond-eleve shadow-(--ombre-carte)">
                <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:gap-6">
                  <Illustration
                    src={prochaine.photo}
                    alt=""
                    className="aspect-[4/3] w-full shrink-0 rounded-[0.5rem] sm:w-44"
                    tailles="(min-width: 640px) 176px, 100vw"
                  />

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <PastilleStatut statut={prochaine.statut} />
                      {prochaine.statut !== "en_cours" ? (
                        <span className="text-sm text-texte-attenue">
                          {t("joursAvant", { nombre: mise?.joursAvant ?? 0 })}
                        </span>
                      ) : null}
                    </div>

                    <h3 className="mt-2 text-lg font-semibold">
                      {prochaine.annonceTitre}
                    </h3>
                    <p className="mt-1 text-[0.9375rem] text-texte-attenue">
                      {t("chez", { prenom: prochaine.proprietaire })} ·{" "}
                      {prochaine.ville}
                    </p>

                    <dl className="mt-4 grid gap-x-8 gap-y-2 text-[0.9375rem] sm:grid-cols-2">
                      <div>
                        <dt className="text-sm text-texte-attenue">
                          {t("retrait")}
                        </dt>
                        <dd className="font-medium">
                          {jourComplet(prochaine.debut)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-sm text-texte-attenue">
                          {t("restitution")}
                        </dt>
                        <dd className="font-medium">
                          {jourComplet(prochaine.fin)}
                        </dd>
                      </div>
                    </dl>
                  </div>

                  <div className="shrink-0 sm:text-right">
                    <p className="text-2xl font-bold tracking-[-0.02em] tabular-nums">
                      {montant(prochaine.montantTotal, prochaine.devise)}
                    </p>
                    <p className="mt-1 font-mono text-xs text-texte-attenue">
                      {prochaine.reference}
                    </p>
                  </div>
                </div>
              </article>
            ) : (
              <ListeVide
                titre={t("vide.titre")}
                texte={t("vide.texte")}
                action={
                  <Bouton as={Link} href="/recherche">
                    {t("vide.action")}
                  </Bouton>
                }
              />
            )}
          </div>
        </section>

        {/* ---------- Compteurs ---------- */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <CarteIndicateur
            libelle={t("aVenir")}
            valeur={synthese.aVenir}
            precision={t("aVenirPrecision")}
          />
          <CarteIndicateur
            libelle={t("cautions")}
            valeur={montant(synthese.cautionsGelees, synthese.devise)}
            precision={t("cautionsPrecision")}
          />
          <CarteIndicateur
            libelle={t("messages")}
            valeur={synthese.messagesNonLus}
            precision={t("messagesPrecision")}
          />
          <CarteIndicateur
            libelle={t("totalDepense")}
            valeur={montant(synthese.totalDepense, synthese.devise)}
            precision={t("totalDepensePrecision")}
          />
        </div>

        {/* ---------- Rappel d'avis ---------- */}
        {aEcrire.length > 0 ? (
          <section className="flex flex-wrap items-center justify-between gap-4 rounded-carte border border-bordure bg-fond-doux p-5">
            <div>
              <h2 className="text-[0.9375rem] font-semibold">{t("aEcrire")}</h2>
              <p className="mt-1 text-[0.9375rem] text-texte-attenue">
                {t("aEcrireTexte", { nombre: aEcrire.length })}
              </p>
            </div>
            <Bouton as={Link} href="/compte/avis" variante="secondaire">
              {t("aEcrireAction")}
            </Bouton>
          </section>
        ) : null}
      </div>
    </div>
  );
}
