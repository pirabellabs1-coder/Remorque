import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";

import { EnTeteEspace } from "@/components/espace/coquille-espace";
import { Anneau, Courbe } from "@/components/espace/graphique";
import { CarteIndicateur, ListeVide } from "@/components/espace/indicateurs";
import { PastilleStatut } from "@/components/espace/statut";
import { Bouton } from "@/components/ui/bouton";
import { Link } from "@/i18n/navigation";
import { PRIX_AFFICHE } from "@/lib/cn";
import {
  reservationsAtraiter,
  reservationsAvenir,
  revenusParAnnonce,
  revenusParMois,
  syntheseLoueur,
} from "@/server/espaces/activite";

type Props = { params: Promise<{ locale: string }> };

export const metadata = { robots: { index: false, follow: false } };

/** Le catalogue et l'activité changent à chaque publication. */
export const dynamic = "force-dynamic";

/**
 * Tableau de bord du loueur.
 *
 * Trois questions, dans cet ordre : qu'est-ce qui m'attend, combien j'ai
 * gagné, d'où vient l'argent. Les demandes à traiter passent avant les
 * chiffres parce qu'elles expirent — un revenu se consulte quand on veut,
 * une demande laissée vingt-quatre heures est perdue.
 */
export default async function TableauDeBordLoueur({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("espaces.loueur.tableau");
  const format = await getFormatter();

  const synthese = await syntheseLoueur();
  const mois = await revenusParMois(12);
  const aTraiter = await reservationsAtraiter();
  const aVenir = await reservationsAvenir();
  const parAnnonce = await revenusParAnnonce();

  const montant = (centimes: number) =>
    format.number(centimes / 100, {
      ...PRIX_AFFICHE,
      currency: synthese.devise,
    });

  const jour = (date: Date) =>
    format.dateTime(date, { day: "numeric", month: "short" });

  // Évolution mensuelle : non calculée si le mois précédent est à zéro. Une
  // variation rapportée à zéro n'a pas de valeur — elle serait infinie ou
  // absurde selon la convention retenue.
  const evolution =
    synthese.netMoisPrecedent > 0
      ? ((synthese.netMoisCourant - synthese.netMoisPrecedent) /
          synthese.netMoisPrecedent) *
        100
      : null;

  // Quatre annonces au plus dans l'anneau, le reste regroupé : au-delà, les
  // secteurs deviennent des filets illisibles.
  const TEINTES = ["var(--accent)", "#5b8def", "#8fb4f5", "#c3d6f9"];
  const tete = parAnnonce.slice(0, 4);
  const reste = parAnnonce
    .slice(4)
    .reduce((somme, entree) => somme + entree.net, 0);

  const parts = [
    ...tete.map((entree, index) => ({
      etiquette: entree.titre,
      valeur: entree.net,
      teinte: TEINTES[index],
    })),
    ...(reste > 0
      ? [
          {
            etiquette: `+ ${parAnnonce.length - 4}`,
            valeur: reste,
            teinte: "var(--bordure)",
          },
        ]
      : []),
  ];

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-8 sm:py-10">
      <EnTeteEspace
        titre={t("titre")}
        sousTitre={t("chapo")}
        actions={
          <Bouton as={Link} href="/proprietaire/annonces" taille="petit">
            {t("action")}
          </Bouton>
        }
      />

      {/* ---------- Chiffres de tête ---------- */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <CarteIndicateur
          libelle={t("revenus")}
          valeur={montant(synthese.netMoisCourant)}
          precision={
            evolution === null
              ? t("aucunMoisPrecedent")
              : t("versusMoisPrecedent", {
                  signe: evolution >= 0 ? "+" : "−",
                  pourcentage: Math.abs(Math.round(evolution)),
                })
          }
        />
        <CarteIndicateur
          libelle={t("netTotal")}
          valeur={montant(synthese.netTotal)}
          precision={t("netTotalPrecision")}
        />
        <CarteIndicateur
          libelle={t("demandes")}
          valeur={synthese.aTraiter}
          precision={t("demandesPrecision")}
        />
        <CarteIndicateur
          libelle={t("note")}
          valeur={
            synthese.noteMoyenne === null
              ? undefined
              : format.number(synthese.noteMoyenne, {
                  maximumFractionDigits: 1,
                })
          }
          precision={t("notePrecision")}
        />
      </div>

      {/* ---------- Demandes à traiter ---------- */}
      <section className="mt-10">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-[1.0625rem] font-semibold">
            {t("demandesTitre")}
          </h2>
          <Link
            href="/proprietaire/reservations"
            className="text-sm font-medium text-accent hover:underline"
          >
            {t("toutVoir")}
          </Link>
        </div>
        <p className="mt-1 text-[0.9375rem] text-texte-attenue">
          {t("demandesChapo")}
        </p>

        {aTraiter.length === 0 ? (
          <p className="mt-4 rounded-carte border border-bordure bg-fond-eleve px-5 py-8 text-center text-[0.9375rem] text-texte-attenue">
            {t("aucuneDemande")}
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {aTraiter.slice(0, 5).map((reservation) => (
              <li
                key={reservation.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-carte border border-bordure bg-fond-eleve px-5 py-4 shadow-(--ombre-carte)"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {reservation.annonceTitre}
                  </p>
                  <p className="mt-0.5 text-sm text-texte-attenue">
                    {reservation.locataire} · {jour(reservation.debut)} →{" "}
                    {jour(reservation.fin)}
                  </p>
                </div>
                <p className="font-bold tabular-nums">
                  {montant(reservation.netProprietaire)}
                </p>
                <PastilleStatut statut={reservation.statut} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ---------- Revenus ---------- */}
      <section className="mt-10 rounded-carte border border-bordure bg-fond-eleve p-6 shadow-(--ombre-carte)">
        <h2 className="text-[1.0625rem] font-semibold">{t("revenusTitre")}</h2>
        <div className="mt-6">
          <Courbe
            points={mois.map((entree) => ({
              etiquette: entree.etiquette,
              valeur: entree.net / 100,
            }))}
            description={t("revenusLegende")}
            format={(valeur) =>
              format.number(valeur, {
                ...PRIX_AFFICHE,
                currency: synthese.devise,
              })
            }
          />
        </div>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* ---------- Répartition ---------- */}
        <section className="rounded-carte border border-bordure bg-fond-eleve p-6 shadow-(--ombre-carte)">
          <h2 className="text-[1.0625rem] font-semibold">
            {t("repartitionTitre")}
          </h2>
          <div className="mt-6">
            {parts.length > 0 ? (
              <Anneau
                parts={parts}
                centre={montant(synthese.netTotal)}
                legende={t("repartitionLegende")}
              />
            ) : (
              <p className="text-[0.9375rem] text-texte-attenue">
                {t("aucuneDemande")}
              </p>
            )}
          </div>
        </section>

        {/* ---------- Prochaines locations ---------- */}
        <section className="rounded-carte border border-bordure bg-fond-eleve p-6 shadow-(--ombre-carte)">
          <h2 className="text-[1.0625rem] font-semibold">{t("aVenirTitre")}</h2>

          {aVenir.length === 0 ? (
            <p className="mt-6 text-[0.9375rem] text-texte-attenue">
              {t("aucuneAvenir")}
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-bordure">
              {aVenir.slice(0, 6).map((reservation) => (
                <li key={reservation.id} className="flex items-center gap-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[0.9375rem] font-medium">
                      {reservation.annonceTitre}
                    </p>
                    <p className="mt-0.5 text-sm text-texte-attenue">
                      {reservation.locataire}
                    </p>
                  </div>
                  <p className="shrink-0 text-right text-sm">
                    <span className="block font-medium">
                      {jour(reservation.debut)}
                    </span>
                    <span className="text-texte-attenue">
                      {montant(reservation.netProprietaire)}
                    </span>
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Le cas vide compte autant que le cas plein : c'est ce que verra tout
          nouveau loueur à sa première connexion. */}
      {synthese.netTotal === 0 && aTraiter.length === 0 ? (
        <div className="mt-10">
          <ListeVide
            titre={t("vide.titre")}
            texte={t("vide.texte")}
            action={
              <Bouton as={Link} href="/proprietaire/annonces">
                {t("vide.action")}
              </Bouton>
            }
          />
        </div>
      ) : null}
    </div>
  );
}
