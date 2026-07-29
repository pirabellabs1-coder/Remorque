"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useId, useMemo, useState } from "react";

import { Bouton } from "@/components/ui/bouton";
import { PARTENAIRE_CONFIRME } from "@/config/assurance";
import { calculerDevis, type BaremePays } from "@/domain/tarification/devis";
import { PRIX_AFFICHE } from "@/lib/cn";
import type { AnnonceDetail } from "@/server/annonces/catalogue";

function aujourdhui(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Nombre de jours facturés entre deux dates, bornes incluses côté départ. */
function joursEntre(debut: string, fin: string): number {
  const ms = Date.parse(fin) - Date.parse(debut);
  if (Number.isNaN(ms) || ms < 0) return 0;
  return Math.max(1, Math.round(ms / 86_400_000));
}

/**
 * Carte de réservation.
 *
 * « Prix ligne par ligne, sans frais caché, avant toute saisie de paiement »
 * (M05). Le décompte est calculé par le moteur de tarification du domaine, le
 * même qui produira le montant réellement débité : un écart entre l'estimation
 * affichée ici et le récapitulatif final est la première cause de réclamation
 * sur ce type de service.
 *
 * La prime d'assurance n'est pas chiffrée tant que le partenaire n'est pas
 * signé — voir `src/config/assurance.ts`.
 */
export function CarteReservation({
  annonce,
  bareme,
}: {
  annonce: AnnonceDetail;
  bareme: BaremePays;
}) {
  const t = useTranslations("annonce.reservation");
  const format = useFormatter();
  const identifiant = useId();

  const [debut, setDebut] = useState("");
  const [fin, setFin] = useState("");

  const jours = debut && fin ? joursEntre(debut, fin) : 0;

  const devis = useMemo(
    () =>
      jours > 0
        ? calculerDevis({
            prixJour: annonce.prixJour,
            nombreJours: jours,
            bareme,
          })
        : null,
    [jours, annonce.prixJour, bareme],
  );

  /** Décompte : deux décimales systématiques, comme sur une facture. */
  const montant = (centimes: number) =>
    format.number(centimes / 100, {
      style: "currency",
      currency: annonce.devise,
    });

  /** Prix mis en avant : centimes affichés seulement s'ils existent. */
  const prixAffiche = (centimes: number) =>
    format.number(centimes / 100, { ...PRIX_AFFICHE, currency: annonce.devise });

  const classeChamp =
    "h-11 w-full rounded-champ border border-bordure bg-fond-eleve px-3 text-[0.9375rem]";

  return (
    <aside className="rounded-carte border border-bordure bg-fond-eleve p-5 shadow-sm lg:sticky lg:top-36">
      <p className="text-2xl font-semibold">
        {prixAffiche(annonce.prixJour)}
        <span className="text-base font-normal text-texte-attenue">
          {" "}
          {t("parJour")}
        </span>
      </p>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <div>
          <label
            htmlFor={`${identifiant}-debut`}
            className="block pb-1 text-xs font-medium text-texte-attenue"
          >
            {t("du")}
          </label>
          <input
            id={`${identifiant}-debut`}
            type="date"
            min={aujourdhui()}
            value={debut}
            onChange={(evenement) => {
              setDebut(evenement.target.value);
              if (fin && evenement.target.value > fin) setFin("");
            }}
            className={classeChamp}
          />
        </div>
        <div>
          <label
            htmlFor={`${identifiant}-fin`}
            className="block pb-1 text-xs font-medium text-texte-attenue"
          >
            {t("au")}
          </label>
          <input
            id={`${identifiant}-fin`}
            type="date"
            min={debut || aujourdhui()}
            value={fin}
            onChange={(evenement) => setFin(evenement.target.value)}
            className={classeChamp}
          />
        </div>
      </div>

      {devis ? (
        <dl className="mt-5 space-y-2 text-sm" aria-live="polite">
          <div className="flex justify-between">
            <dt className="text-texte-attenue">
              {t("loyer", { jours, prix: prixAffiche(annonce.prixJour) })}
            </dt>
            <dd className="tabular-nums">{montant(devis.loyer)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-texte-attenue">{t("fraisService")}</dt>
            <dd className="tabular-nums">{montant(devis.fraisService)}</dd>
          </div>
          {!PARTENAIRE_CONFIRME ? (
            <div className="flex justify-between">
              <dt className="text-texte-attenue">{t("assurance")}</dt>
              <dd className="text-texte-attenue">{t("assuranceComprise")}</dd>
            </div>
          ) : null}
          <div className="flex justify-between border-t border-bordure pt-2 font-semibold">
            <dt>{t("total")}</dt>
            <dd className="tabular-nums">{montant(devis.totalLocataire)}</dd>
          </div>
        </dl>
      ) : (
        <p className="mt-5 text-sm text-texte-attenue">{t("choisirDates")}</p>
      )}

      <Bouton
        as="button"
        type="button"
        taille="grand"
        pleineLargeur
        disabled
        className="mt-5"
      >
        {annonce.reservationInstantanee ? t("reserver") : t("demander")}
      </Bouton>
      <p className="mt-2 text-center text-xs text-texte-attenue">
        {t("bientot")}
      </p>

      <ul className="mt-5 space-y-1.5 border-t border-bordure pt-4 text-xs text-texte-attenue">
        <li>{t("caution", { montant: prixAffiche(annonce.caution) })}</li>
        <li>{t(`annulation.${annonce.politiqueAnnulation}`)}</li>
      </ul>
    </aside>
  );
}
