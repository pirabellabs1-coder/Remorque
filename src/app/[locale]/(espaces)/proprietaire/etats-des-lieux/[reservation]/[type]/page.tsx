import { notFound } from "next/navigation";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";

import { POINTS_CONTROLE } from "@/domain/location/constat";
import { EnTeteEspace } from "@/components/espace/coquille-espace";
import { FormulaireConstat } from "@/components/espace/formulaire-constat";
import type { CategoriePermis } from "@/domain/compatibilite/permis";
import { mediasDuConstat } from "@/server/locations/etats-des-lieux";
import { Link } from "@/i18n/navigation";
import {
  contexteConstat,
  type ConstatDetail,
} from "@/server/locations/etats-des-lieux";

type Props = {
  params: Promise<{ locale: string; reservation: string; type: string }>;
};

export const metadata = { robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * Un écran, deux visages : la saisie tant que le constat n'existe pas, la
 * pièce signée ensuite. C'est le même chemin dans les deux cas — celui vers
 * lequel pointent aussi bien le bouton « Réaliser » que la liste des constats
 * réalisés — parce qu'un constat n'a qu'une adresse, avant comme après.
 */
export default async function PageConstat({ params }: Props) {
  const { locale, reservation: reservationId, type } = await params;
  setRequestLocale(locale);

  if (type !== "depart" && type !== "retour") notFound();

  const contexte = await contexteConstat(reservationId);
  if (!contexte) notFound();

  const t = await getTranslations("espaces.loueur.etatsDesLieux");
  const format = await getFormatter();

  const constat = type === "depart" ? contexte.depart : contexte.retour;
  const { reservation } = contexte;

  // Les pièces déjà déposées sur le brouillon de ce constat, s'il existe : on
  // photographie souvent le matériel avant de revenir signer, et l'écran doit
  // reprendre là où on l'a laissé.
  const medias = await mediasDuConstat(reservationId, type);

  // Le retour ne se saisit qu'après le départ, et seulement sur une location
  // partie : mêmes règles que l'action serveur, dites avant la saisie plutôt
  // qu'au rejet de la soumission.
  const saisissable =
    constat === null &&
    (type === "depart"
      ? ["confirmee", "en_cours", "restituee"].includes(reservation.statut)
      : contexte.depart !== null &&
        ["en_cours", "restituee"].includes(reservation.statut));

  // Les défauts déjà notés au départ : le constat de retour se lit par rapport
  // à eux, un feu cassé à l'aller n'est pas un dommage du locataire.
  const reservesDepart =
    type === "retour" && contexte.depart
      ? POINTS_CONTROLE.filter(
          (point) => contexte.depart?.controles[point] === false,
        )
      : [];

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-8 sm:py-10">
      <Link
        href="/proprietaire/etats-des-lieux"
        className="text-sm font-medium text-texte-attenue transition-colors hover:text-accent"
      >
        ← {t("detail.retourListe")}
      </Link>

      <div className="mt-4">
        <EnTeteEspace
          titre={type === "depart" ? t("formulaire.titreDepart") : t("formulaire.titreRetour")}
          sousTitre={`${reservation.annonceTitre} · ${reservation.reference} · ${reservation.interlocuteur}`}
        />
      </div>

      {reservesDepart.length > 0 ? (
        <p className="mt-6 rounded-carte border border-attention/40 bg-attention/10 p-4 text-[0.9375rem]">
          {t("formulaire.reservesDepart", {
            points: reservesDepart
              .map((point) => t(`formulaire.points.${point}` as never))
              .join(", "),
          })}
        </p>
      ) : null}

      {constat ? (
        <DetailConstat
          constat={constat}
          reservationId={reservation.id}
          format={format}
          t={t}
        />
      ) : saisissable ? (
        <FormulaireConstat
          reservationId={reservation.id}
          type={type}
          medias={medias}
          nomLocataire={reservation.locataireNom}
          categoriesConnues={
            reservation.locataireCategories as CategoriePermis[]
          }
        />
      ) : (
        <p className="mt-8 rounded-carte border border-bordure bg-fond-eleve p-5 text-[0.9375rem] text-texte-attenue">
          {type === "retour" && contexte.depart === null
            ? t("formulaire.erreurs.departManquant")
            : t("formulaire.erreurs.statutIncompatible")}
        </p>
      )}
    </div>
  );
}

function DetailConstat({
  constat,
  reservationId,
  format,
  t,
}: {
  constat: ConstatDetail;
  reservationId: string;
  format: Awaited<ReturnType<typeof getFormatter>>;
  t: Awaited<ReturnType<typeof getTranslations<"espaces.loueur.etatsDesLieux">>>;
}) {
  const date = (valeur: Date | null) =>
    valeur
      ? format.dateTime(valeur, {
          day: "numeric",
          month: "long",
          year: "numeric",
          hour: "numeric",
          minute: "numeric",
        })
      : "—";

  return (
    <div className="mt-8 space-y-6">
      <p
        className={
          constat.reserve
            ? "inline-block rounded-full bg-attention/15 px-3 py-1 text-sm font-medium text-attention"
            : "inline-block rounded-full bg-succes/15 px-3 py-1 text-sm font-medium text-succes"
        }
      >
        {constat.reserve ? t("detail.reserve") : t("detail.sansReserve")}
      </p>

      <section className="rounded-carte border border-bordure bg-fond-eleve p-5 shadow-(--ombre-carte)">
        <h2 className="text-[0.9375rem] font-semibold">{t("formulaire.controles")}</h2>
        <ul className="mt-2 divide-y divide-bordure">
          {POINTS_CONTROLE.map((point) => {
            const conforme = constat.controles[point] !== false;
            return (
              <li
                key={point}
                className="flex items-center justify-between gap-3 py-3"
              >
                <span className="text-[0.9375rem]">
                  {t(`formulaire.points.${point}` as never)}
                </span>
                <span
                  className={
                    conforme
                      ? "text-sm font-medium text-succes"
                      : "text-sm font-medium text-danger"
                  }
                >
                  {conforme ? t("formulaire.conforme") : t("formulaire.defaut")}
                </span>
              </li>
            );
          })}
        </ul>

        {constat.kilometrage !== null ? (
          <p className="mt-4 text-sm text-texte-attenue">
            {t("detail.kilometrage", { valeur: constat.kilometrage })}
          </p>
        ) : null}

        {constat.commentaire ? (
          <p className="mt-2 rounded-champ bg-fond-doux p-3 text-[0.9375rem]">
            {constat.commentaire}
          </p>
        ) : null}
      </section>

      <section className="rounded-carte border border-bordure bg-fond-eleve p-5 shadow-(--ombre-carte)">
        <h2 className="text-[0.9375rem] font-semibold">{t("formulaire.signatures")}</h2>
        <dl className="mt-3 space-y-2 text-[0.9375rem]">
          <div className="flex flex-wrap justify-between gap-2">
            <dt className="text-texte-attenue">{t("detail.signeLocataire")}</dt>
            <dd>{date(constat.signatureLocataireLe)}</dd>
          </div>
          <div className="flex flex-wrap justify-between gap-2">
            <dt className="text-texte-attenue">{t("detail.signeProprietaire")}</dt>
            <dd>{date(constat.signatureProprietaireLe)}</dd>
          </div>
        </dl>

        {constat.finaliseLe ? (
          <div className="mt-4 border-t border-bordure pt-3">
            <p className="text-sm text-texte-attenue">
              {t("detail.finalise", { date: date(constat.finaliseLe) })}
            </p>
            {/* La pièce téléchargeable : c'est elle qu'on joint à une
                déclaration de sinistre ou qu'on produit en litige. */}
            <a
              href={`/api/documents/constat/${reservationId}`}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-block text-sm font-medium text-accent underline-offset-4 hover:underline"
            >
              {t("detail.telecharger")}
            </a>
          </div>
        ) : null}
      </section>
    </div>
  );
}
