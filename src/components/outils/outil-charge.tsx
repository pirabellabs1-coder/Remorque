"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { Carte } from "@/components/ui/carte";
import { calculerCharge } from "@/domain/compatibilite/charge";

function Champ({
  id,
  libelle,
  aide,
  valeur,
  onChange,
}: {
  id: string;
  libelle: string;
  aide?: string;
  valeur: string;
  onChange: (valeur: string) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium">
        {libelle}
      </label>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={0}
        step={10}
        value={valeur}
        onChange={(evenement) => onChange(evenement.target.value)}
        aria-describedby={aide ? `${id}-aide` : undefined}
        className="mt-1.5 h-11 w-full rounded-champ border border-bordure bg-fond-eleve px-3"
      />
      {aide ? (
        <p id={`${id}-aide`} className="mt-1.5 text-sm text-texte-attenue">
          {aide}
        </p>
      ) : null}
    </div>
  );
}

export function OutilCharge() {
  const t = useTranslations("outilCharge");
  const format = useFormatter();

  const [ptacRemorque, setPtacRemorque] = useState("1300");
  const [poidsVide, setPoidsVide] = useState("300");
  const [masseTractable, setMasseTractable] = useState("1500");

  const resultat = useMemo(() => {
    const entrees = {
      ptacRemorqueKg: Number(ptacRemorque),
      poidsVideRemorqueKg: Number(poidsVide),
      masseTractableKg: Number(masseTractable),
    };

    const valide = Object.values(entrees).every(
      (valeur) => Number.isFinite(valeur) && valeur > 0,
    );
    if (!valide) return null;

    try {
      return calculerCharge(entrees);
    } catch {
      // Saisie incohérente — poids à vide supérieur au poids autorisé.
      return null;
    }
  }, [ptacRemorque, poidsVide, masseTractable]);

  const kg = (valeur: number) => `${format.number(valeur)} kg`;

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Carte>
        <h2 className="text-lg font-semibold">{t("saisie")}</h2>
        <div className="mt-4 space-y-4">
          <Champ
            id="ptac-remorque"
            libelle={t("ptacRemorque")}
            aide={t("ptacRemorqueAide")}
            valeur={ptacRemorque}
            onChange={setPtacRemorque}
          />
          <Champ
            id="poids-vide"
            libelle={t("poidsVide")}
            aide={t("poidsVideAide")}
            valeur={poidsVide}
            onChange={setPoidsVide}
          />
          <Champ
            id="masse-tractable"
            libelle={t("masseTractable")}
            aide={t("masseTractableAide")}
            valeur={masseTractable}
            onChange={setMasseTractable}
          />
        </div>
      </Carte>

      <Carte>
        <h2 className="text-lg font-semibold">{t("resultat")}</h2>

        {!resultat ? (
          <p className="mt-4 text-texte-attenue">{t("saisieIncomplete")}</p>
        ) : (
          <div aria-live="polite">
            <p className="mt-4 text-sm text-texte-attenue">
              {t("chargeReelle")}
            </p>
            <p className="text-4xl font-semibold">{kg(resultat.chargeReelleKg)}</p>

            <dl className="mt-6 space-y-3 text-sm">
              <div className="flex justify-between border-t border-bordure pt-3">
                <dt className="text-texte-attenue">{t("chargeUtile")}</dt>
                <dd>{kg(resultat.chargeUtileRemorqueKg)}</dd>
              </div>
              <div className="flex justify-between border-t border-bordure pt-3">
                <dt className="text-texte-attenue">{t("masseAutorisee")}</dt>
                <dd>{kg(resultat.masseAutoriseeKg)}</dd>
              </div>
            </dl>

            {resultat.limiteParLeVehicule ? (
              <p className="mt-6 rounded-champ bg-attention/10 p-4 text-sm text-attention">
                {t("limiteVehicule", { kg: resultat.chargePerdueKg })}
              </p>
            ) : (
              <p className="mt-6 rounded-champ bg-succes/10 p-4 text-sm text-succes">
                {t("limiteRemorque")}
              </p>
            )}
          </div>
        )}
      </Carte>
    </div>
  );
}
