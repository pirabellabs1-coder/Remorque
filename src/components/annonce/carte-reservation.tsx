"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useId, useMemo, useState } from "react";

import { Bouton } from "@/components/ui/bouton";
import { calculerDevis, type BaremePays } from "@/domain/tarification/devis";
import { PRIX_AFFICHE } from "@/lib/cn";
import { Link } from "@/i18n/navigation";
import type { AnnonceDetail } from "@/server/annonces/catalogue";

function aujourdhui(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Créneaux de remise et de restitution.
 *
 * À l'heure pleine, de 7 h à 20 h : un particulier remet sa remorque avant de
 * partir travailler ou en rentrant, et proposer les demi-heures allongerait la
 * liste sans rien régler. La borne haute évite de convenir d'un rendez-vous à
 * la nuit tombée, quand l'état des lieux photographique ne vaut plus rien.
 */
const CRENEAUX = Array.from(
  { length: 14 },
  (_, rang) => `${String(rang + 7).padStart(2, "0")}:00`,
);

const RETRAIT_PAR_DEFAUT = "09:00";
const RESTITUTION_PAR_DEFAUT = "18:00";

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
 * La plateforme n'assure pas le matériel : le décompte le dit, et la fiche
 * l'explique — voir `src/config/assurance.ts`.
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
  const [heureDebut, setHeureDebut] = useState(RETRAIT_PAR_DEFAUT);
  const [heureFin, setHeureFin] = useState(RESTITUTION_PAR_DEFAUT);
  const [partage, setPartage] = useState(false);

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

  async function partager() {
    const adresse = window.location.href;

    // `navigator.share` ouvre le partage natif du téléphone — messagerie,
    // courriel, presse-papiers — là où il existe. Ailleurs, on copie.
    if (navigator.share) {
      try {
        await navigator.share({ title: annonce.titre, url: adresse });
      } catch {
        // Partage annulé : il n'y a rien à signaler.
      }
      return;
    }

    try {
      await navigator.clipboard.writeText(adresse);
      setPartage(true);
      setTimeout(() => setPartage(false), 2500);
    } catch {
      // Presse-papiers refusé : l'adresse reste dans la barre du navigateur.
    }
  }

  const classeChamp =
    "h-11 w-full rounded-champ border border-bordure bg-fond-eleve px-3 text-[0.9375rem]";

  return (
    <aside className="rounded-carte border border-bordure bg-fond-eleve p-5 shadow-sm">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-2xl font-semibold">
          {prixAffiche(annonce.prixJour)}
          <span className="text-base font-normal text-texte-attenue">
            {" "}
            {t("parJour")}
          </span>
        </p>
        {devis ? (
          <p className="shrink-0 text-sm text-texte-attenue">
            {t("totalEstime", { montant: montant(devis.totalLocataire) })}
          </p>
        ) : null}
      </div>

      {/* Date et heure côte à côte pour chaque bout de la location. L'heure
          n'entre pas dans le prix — la location se facture au jour — mais
          c'est elle qui fixe le rendez-vous de remise et de restitution, et
          elle voyage jusqu'à la réservation : les colonnes sont des
          horodatages depuis toujours, seule l'interface les ignorait. */}
      <div className="mt-5 space-y-3">
        <div className="grid grid-cols-[1fr_auto] gap-2">
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
              htmlFor={`${identifiant}-heureDebut`}
              className="block pb-1 text-xs font-medium text-texte-attenue"
            >
              {t("heureRetrait")}
            </label>
            <select
              id={`${identifiant}-heureDebut`}
              value={heureDebut}
              onChange={(evenement) => setHeureDebut(evenement.target.value)}
              className={classeChamp}
            >
              {CRENEAUX.map((creneau) => (
                <option key={creneau} value={creneau}>
                  {creneau}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-[1fr_auto] gap-2">
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
          <div>
            <label
              htmlFor={`${identifiant}-heureFin`}
              className="block pb-1 text-xs font-medium text-texte-attenue"
            >
              {t("heureRestitution")}
            </label>
            <select
              id={`${identifiant}-heureFin`}
              value={heureFin}
              onChange={(evenement) => setHeureFin(evenement.target.value)}
              className={classeChamp}
            >
              {CRENEAUX.map((creneau) => (
                <option key={creneau} value={creneau}>
                  {creneau}
                </option>
              ))}
            </select>
          </div>
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
          {/* Qui assure le matériel : la plateforme ne s'en charge pas, et
              le décompte doit le dire là où on lit le prix. */}
          <div className="flex justify-between">
            <dt className="text-texte-attenue">{t("assurance")}</dt>
            <dd className="text-texte-attenue">{t("assuranceComprise")}</dd>
          </div>
          <div className="flex justify-between border-t border-bordure pt-2 font-semibold">
            <dt>{t("total")}</dt>
            <dd className="tabular-nums">{montant(devis.totalLocataire)}</dd>
          </div>
        </dl>
      ) : (
        <p className="mt-5 text-sm text-texte-attenue">{t("choisirDates")}</p>
      )}

      {/* Le panneau ne crée plus la demande : il compose des dates et conduit
          au formulaire, où le preneur se nomme et se situe. Le contrat, la
          facture et l'attestation d'assurance nomment un preneur et le
          situent — réserver d'un seul bouton revenait à confier un bien de
          plusieurs milliers d'euros à quelqu'un dont on ne savait rien. */}
      {jours > 0 ? (
        <Bouton
          as={Link}
          href={{
            pathname: "/reserver/[ville]/[slug]",
            params: { ville: annonce.villeSlug, slug: annonce.slug },
            query: {
              debut: `${debut}T${heureDebut}`,
              fin: `${fin}T${heureFin}`,
            },
          }}
          taille="grand"
          pleineLargeur
          className="mt-5"
        >
          {annonce.reservationInstantanee ? t("reserver") : t("demander")}
        </Bouton>
      ) : (
        // Désactivé plutôt que masqué : on voit ce qui attend une fois les
        // dates choisies, plutôt qu'un panneau qui change de forme.
        <Bouton taille="grand" pleineLargeur disabled className="mt-5">
          {annonce.reservationInstantanee ? t("reserver") : t("demander")}
        </Bouton>
      )}

      <p className="mt-2 text-center text-xs text-texte-attenue">
        {t("aucunDebit")}
      </p>

      <div className="mt-4 border-t border-bordure pt-4">
        <button
          type="button"
          onClick={() => void partager()}
          className="inline-flex h-10 w-full items-center justify-center rounded-champ border border-bordure px-3 text-sm font-medium transition-colors hover:border-accent hover:text-accent"
        >
          {partage ? t("partage") : t("partager")}
        </button>
      </div>

      <ul className="mt-5 space-y-1.5 border-t border-bordure pt-4 text-xs text-texte-attenue">
        <li>{t("caution", { montant: prixAffiche(annonce.caution) })}</li>
        <li>{t(`annulation.${annonce.politiqueAnnulation}`)}</li>
      </ul>
    </aside>
  );
}
