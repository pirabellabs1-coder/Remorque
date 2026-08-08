import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";

import { BoutonPayer } from "@/components/espace/bouton-payer";
import { EnTeteEspace } from "@/components/espace/coquille-espace";
import { DocumentsLocation } from "@/components/espace/documents-location";
import { ListeVide } from "@/components/espace/indicateurs";
import { ActionsReservation } from "@/components/espace/actions-reservation";
import { PastilleStatut } from "@/components/espace/statut";
import { Pastille } from "@/components/espace/tableau";
import { Bouton } from "@/components/ui/bouton";
import { Illustration } from "@/components/ui/illustration";
import { Link } from "@/i18n/navigation";
import { cn, PRIX_AFFICHE } from "@/lib/cn";
import { mesReservations } from "@/server/espaces/locataire";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ filtre?: string; paiement?: string }>;
};

export const metadata = { robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * Quatre filtres, correspondant à des intentions et non à des statuts. Le
 * locataire ne cherche pas « mes réservations au statut restituée » : il
 * cherche celle de samedi, ou la facture de son déménagement de mars.
 */
const FILTRES = {
  toutes: () => true,
  aVenir: (statut: string) =>
    ["demandee", "acceptee", "payee", "confirmee"].includes(statut),
  enCours: (statut: string) => statut === "en_cours",
  passees: (statut: string) =>
    ["cloturee", "restituee", "annulee", "refusee", "expiree"].includes(statut),
} as const;

type ClefFiltre = keyof typeof FILTRES;

export default async function PageMesReservations({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { filtre, paiement } = await searchParams;
  const actif: ClefFiltre =
    filtre && filtre in FILTRES ? (filtre as ClefFiltre) : "toutes";

  const t = await getTranslations("espaces.locataire.reservations");
  const tPaiement = await getTranslations("espaces.paiement");
  const tCautions = await getTranslations("espaces.locataire.paiements.cautions");
  const format = await getFormatter();

  const toutes = await mesReservations();
  const reservations = toutes.filter((reservation) =>
    FILTRES[actif](reservation.statut),
  );

  const montant = (centimes: number, devise: string) =>
    format.number(centimes / 100, { ...PRIX_AFFICHE, currency: devise });

  const jour = (date: Date) =>
    format.dateTime(date, { day: "numeric", month: "short", year: "2-digit" });

  const duree = (debut: Date, fin: Date) =>
    Math.max(1, Math.round((fin.getTime() - debut.getTime()) / 86_400_000));

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-8 sm:py-10">
      <EnTeteEspace
        titre={t("titre")}
        sousTitre={t("chapo", { nombre: toutes.length })}
      />

      {/* Retour du prestataire de paiement. Le message dit ce qui est en
          cours, non ce qui est acquis : la réservation ne devient payée que
          lorsque Stripe nous l'a signé, ce qui prend parfois une seconde de
          plus que le retour du navigateur. */}
      {paiement === "succes" || paiement === "abandon" ? (
        <p
          role="status"
          className={
            paiement === "succes"
              ? "mt-6 rounded-carte border border-succes/40 bg-succes/10 p-4 text-[0.9375rem]"
              : "mt-6 rounded-carte border border-bordure bg-fond-eleve p-4 text-[0.9375rem] text-texte-attenue"
          }
        >
          {paiement === "succes" ? tPaiement("succes") : tPaiement("abandon")}
        </p>
      ) : null}

      {/* Onglets de filtre — de simples liens, donc partageables, ouvrables
          dans un nouvel onglet et fonctionnels sans JavaScript. */}
      <nav className="mt-6 flex flex-wrap gap-2">
        {(Object.keys(FILTRES) as ClefFiltre[]).map((clef) => {
          const nombre = toutes.filter((reservation) =>
            FILTRES[clef](reservation.statut),
          ).length;

          return (
            <Link
              key={clef}
              href={
                clef === "toutes"
                  ? { pathname: "/compte/reservations" }
                  : { pathname: "/compte/reservations", query: { filtre: clef } }
              }
              aria-current={clef === actif ? "page" : undefined}
              className={cn(
                "rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                clef === actif
                  ? "border-accent bg-accent text-accent-contraste"
                  : "border-bordure bg-fond-eleve hover:border-accent hover:text-accent",
              )}
            >
              {t(clef)}
              <span className="ml-2 tabular-nums opacity-70">{nombre}</span>
            </Link>
          );
        })}
      </nav>

      {reservations.length === 0 ? (
        <div className="mt-8">
          <ListeVide
            titre={t("vide.titre")}
            texte={t("vide.texte")}
            action={
              <Bouton as={Link} href="/recherche">
                {t("vide.action")}
              </Bouton>
            }
          />
        </div>
      ) : (
        /* Des cartes plutôt qu'un tableau, sur toutes les tailles d'écran. Un
           locataire a une vingtaine de locations, pas cent quarante : il n'a
           rien à comparer colonne par colonne, il cherche une location précise.
           Et plus de 70 % du trafic est mobile, où un tableau à six colonnes ne
           se lit pas. */
        <ul className="mt-8 space-y-4">
          {reservations.map((reservation) => (
            <li key={reservation.id}>
              <article className="overflow-hidden rounded-carte border border-bordure bg-fond-eleve shadow-(--ombre-carte)">
                <div className="flex flex-col gap-4 p-4 sm:flex-row sm:gap-5">
                  <Illustration
                    src={reservation.photo}
                    alt=""
                    className="aspect-[4/3] w-full shrink-0 rounded-[0.5rem] sm:w-36"
                    tailles="(min-width: 640px) 144px, 100vw"
                  />

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <PastilleStatut statut={reservation.statut} />
                      {/* L'état de la caution n'apparaît que tant qu'il y a
                          quelque chose à savoir : une caution libérée depuis
                          six mois n'est plus une information. */}
                      {reservation.cautionEtat === "gelee" ? (
                        <Pastille ton="danger">
                          {tCautions("gelee")}
                        </Pastille>
                      ) : reservation.cautionEtat === "en_liberation" ? (
                        <Pastille ton="attente">
                          {tCautions("en_liberation")}
                        </Pastille>
                      ) : reservation.cautionEtat === "retenue" ? (
                        <Pastille ton="danger">{tCautions("retenue")}</Pastille>
                      ) : null}
                    </div>

                    <h2 className="mt-2 font-semibold">
                      <Link
                        href={{
                          pathname: "/remorque/[ville]/[slug]",
                          params: {
                            ville: reservation.villeSlug,
                            slug: reservation.slug,
                          },
                        }}
                        className="hover:text-accent hover:underline"
                      >
                        {reservation.annonceTitre}
                      </Link>
                    </h2>

                    <p className="mt-1 text-[0.9375rem] text-texte-attenue">
                      {reservation.proprietaire} · {reservation.ville}
                    </p>

                    <p className="mt-2 text-[0.9375rem]">
                      {jour(reservation.debut)} → {jour(reservation.fin)}
                      <span className="text-texte-attenue">
                        {" · "}
                        {t("duree", {
                          nombre: duree(reservation.debut, reservation.fin),
                        })}
                      </span>
                    </p>
                  </div>

                  <div className="shrink-0 border-t border-bordure pt-3 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-5 sm:text-right">
                    <p className="text-lg font-bold tabular-nums">
                      {montant(reservation.montantTotal, reservation.devise)}
                    </p>
                    <p className="mt-1 text-sm text-texte-attenue">
                      {t("caution")}{" "}
                      <span className="tabular-nums">
                        {montant(reservation.caution, reservation.devise)}
                      </span>
                    </p>
                    <p className="mt-2 font-mono text-xs text-texte-attenue">
                      {reservation.reference}
                    </p>

                    {/* Le code de retrait ne voyage pas par courriel : il
                        s'échange de vive voix devant le matériel, et sa seule
                        utilité est d'attester qu'on est devant la bonne
                        personne. Il n'apparaît donc que là où l'on est
                        authentifié, et seulement quand il sert encore. */}
                    {reservation.codeRetrait &&
                    ["confirmee", "en_cours"].includes(reservation.statut) ? (
                      <p className="mt-2 text-sm">
                        <span className="text-texte-attenue">
                          {t("codeRetrait")}{" "}
                        </span>
                        <span className="font-mono text-base font-bold tracking-[0.2em]">
                          {reservation.codeRetrait}
                        </span>
                      </p>
                    ) : null}

                    {/* Le règlement est l'action attendue sur une demande
                        acceptée : elle passe donc avant l'annulation. */}
                    {reservation.statut === "acceptee" ? (
                      <div className="mt-3 sm:flex sm:justify-end">
                        <BoutonPayer reservationId={reservation.id} />
                      </div>
                    ) : null}

                    <div className="mt-3 sm:flex sm:justify-end">
                      <ActionsReservation
                        reservationId={reservation.id}
                        statut={reservation.statut}
                        role="locataire"
                      />
                    </div>

                    <div className="sm:flex sm:justify-end">
                      <DocumentsLocation
                        reservationId={reservation.id}
                        statut={reservation.statut}
                        avecFacture
                      />

                      {/* Le recours n'est proposé qu'une fois le matériel
                          retiré : avant, il n'y a rien à contester. */}
                      {["en_cours", "restituee", "cloturee"].includes(
                        reservation.statut,
                      ) ? (
                        <Link
                          href={{
                            pathname: "/compte/litiges/[reservation]",
                            params: { reservation: reservation.id },
                          }}
                          className="mt-2 inline-block text-sm text-texte-attenue underline-offset-4 transition-colors hover:text-danger hover:underline"
                        >
                          {t("litige")}
                        </Link>
                      ) : null}
                    </div>
                  </div>
                </div>
              </article>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
