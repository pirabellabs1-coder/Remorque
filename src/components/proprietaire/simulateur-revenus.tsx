"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useId, useMemo, useState } from "react";

import { Carte } from "@/components/ui/carte";
import { BAREME_PAR_DEFAUT } from "@/config/baremes";
import { simulerRevenus } from "@/domain/tarification/simulation";

/**
 * Simulateur de revenus (section 4.1 — acquisition propriétaires).
 *
 * Le propriétaire saisit son propre tarif et sa propre estimation
 * d'occupation : aucun prix de marché n'est présupposé, et le résultat est
 * explicitement présenté comme une projection à partir de ses hypothèses.
 */
export function SimulateurRevenus({ devise }: { devise: string }) {
  const t = useTranslations("mettreEnLocation.simulateur");
  const format = useFormatter();
  const identifiant = useId();

  const [prixJour, setPrixJour] = useState(35);
  const [joursParMois, setJoursParMois] = useState(6);

  const resultat = useMemo(
    () =>
      simulerRevenus({
        prixJour: Math.round(prixJour * 100),
        joursParMois,
        bareme: BAREME_PAR_DEFAUT,
      }),
    [prixJour, joursParMois],
  );

  const montant = (centimes: number) =>
    format.number(centimes / 100, {
      style: "currency",
      currency: devise,
      maximumFractionDigits: 0,
    });

  return (
    <Carte>
      <h2 className="text-xl font-semibold">{t("titre")}</h2>
      <p className="mt-2 text-sm text-texte-attenue">{t("chapo")}</p>

      <div className="mt-8 space-y-8">
        <div>
          <label
            htmlFor={`${identifiant}-prix`}
            className="flex items-baseline justify-between"
          >
            <span className="text-sm font-medium">{t("prixJour")}</span>
            <span className="text-lg font-semibold tabular-nums">
              {format.number(prixJour, {
                style: "currency",
                currency: devise,
                maximumFractionDigits: 0,
              })}
            </span>
          </label>
          <input
            id={`${identifiant}-prix`}
            type="range"
            min={10}
            max={150}
            step={5}
            value={prixJour}
            onChange={(evenement) => setPrixJour(Number(evenement.target.value))}
            className="mt-3 w-full accent-[var(--accent)]"
          />
        </div>

        <div>
          <label
            htmlFor={`${identifiant}-jours`}
            className="flex items-baseline justify-between"
          >
            <span className="text-sm font-medium">{t("joursParMois")}</span>
            <span className="text-lg font-semibold tabular-nums">
              {t("jours", { nombre: joursParMois })}
            </span>
          </label>
          <input
            id={`${identifiant}-jours`}
            type="range"
            min={0}
            max={20}
            step={1}
            value={joursParMois}
            onChange={(evenement) =>
              setJoursParMois(Number(evenement.target.value))
            }
            className="mt-3 w-full accent-[var(--accent)]"
          />
        </div>
      </div>

      <div className="mt-8 border-t border-bordure pt-6" aria-live="polite">
        <p className="text-sm text-texte-attenue">{t("netAnnuel")}</p>
        <p className="text-4xl font-semibold tabular-nums">
          {montant(resultat.netAnnuel)}
        </p>

        <dl className="mt-6 space-y-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-texte-attenue">{t("loyerMensuel")}</dt>
            <dd className="tabular-nums">{montant(resultat.loyerMensuel)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-texte-attenue">{t("commission")}</dt>
            <dd className="tabular-nums">
              − {montant(resultat.commissionMensuelle)}
            </dd>
          </div>
          <div className="flex justify-between border-t border-bordure pt-3 font-semibold">
            <dt>{t("netMensuel")}</dt>
            <dd className="tabular-nums">{montant(resultat.netMensuel)}</dd>
          </div>
        </dl>
      </div>

      <p className="mt-6 text-xs text-texte-attenue">{t("mention")}</p>
    </Carte>
  );
}
