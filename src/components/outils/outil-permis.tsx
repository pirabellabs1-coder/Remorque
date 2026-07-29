"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { Carte } from "@/components/ui/carte";
import {
  evaluerCompatibilite,
  permisRequis,
  type CategoriePermis,
} from "@/domain/compatibilite/permis";

const CATEGORIES: CategoriePermis[] = ["B", "B96", "BE"];

function ChampNombre({
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

/**
 * Outil « quel permis pour quelle remorque » (section 4.1).
 *
 * Contenu à très fort trafic naturel : l'outil doit rester utilisable sans
 * compte, et la page qui l'héberge doit être rendue par le serveur. Seul le
 * calcul est interactif — il s'appuie sur le même moteur que le filtre de
 * recherche « compatible avec mon véhicule », afin qu'un visiteur ne puisse
 * jamais obtenir ici une réponse différente de celle du tunnel de réservation.
 */
export function OutilPermis() {
  const t = useTranslations("outilPermis");

  const [ptacVehicule, setPtacVehicule] = useState("2000");
  const [tractableFreine, setTractableFreine] = useState("1500");
  const [ptacRemorque, setPtacRemorque] = useState("1300");
  const [freinee, setFreinee] = useState(true);

  const nombres = {
    ptacVehicule: Number(ptacVehicule),
    tractableFreine: Number(tractableFreine),
    ptacRemorque: Number(ptacRemorque),
  };

  const saisieComplete =
    Number.isFinite(nombres.ptacVehicule) &&
    nombres.ptacVehicule > 0 &&
    Number.isFinite(nombres.ptacRemorque) &&
    nombres.ptacRemorque > 0 &&
    Number.isFinite(nombres.tractableFreine) &&
    nombres.tractableFreine > 0;

  const resultat = useMemo(() => {
    if (!saisieComplete) return null;

    const vehicule = {
      ptacKg: nombres.ptacVehicule,
      tractableFreineKg: nombres.tractableFreine,
      // La masse non freinée est plafonnée à 750 kg sur la quasi-totalité des
      // véhicules de tourisme ; on retient le minimum des deux valeurs.
      tractableNonFreineKg: Math.min(750, nombres.tractableFreine),
    };
    const materiel = { ptacKg: nombres.ptacRemorque, freinee };

    return {
      requis: permisRequis(vehicule, materiel),
      verdicts: CATEGORIES.map((categorie) => ({
        categorie,
        verdict: evaluerCompatibilite(vehicule, materiel, [categorie]),
      })),
    };
  }, [
    saisieComplete,
    nombres.ptacVehicule,
    nombres.tractableFreine,
    nombres.ptacRemorque,
    freinee,
  ]);

  const ensemble = nombres.ptacVehicule + nombres.ptacRemorque;

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Carte>
        <h2 className="text-lg font-semibold">{t("votreVehicule")}</h2>
        <div className="mt-4 space-y-4">
          <ChampNombre
            id="ptac-vehicule"
            libelle={t("ptacVehicule")}
            aide={t("ptacVehiculeAide")}
            valeur={ptacVehicule}
            onChange={setPtacVehicule}
          />
          <ChampNombre
            id="tractable-freine"
            libelle={t("tractableFreine")}
            aide={t("tractableFreineAide")}
            valeur={tractableFreine}
            onChange={setTractableFreine}
          />
        </div>

        <h2 className="mt-8 text-lg font-semibold">{t("laRemorque")}</h2>
        <div className="mt-4 space-y-4">
          <ChampNombre
            id="ptac-remorque"
            libelle={t("ptacRemorque")}
            aide={t("ptacRemorqueAide")}
            valeur={ptacRemorque}
            onChange={setPtacRemorque}
          />
          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={freinee}
              onChange={(evenement) => setFreinee(evenement.target.checked)}
              className="size-4"
            />
            {t("remorqueFreinee")}
          </label>
        </div>
      </Carte>

      <Carte>
        <h2 className="text-lg font-semibold">{t("resultat")}</h2>

        {!resultat ? (
          <p className="mt-4 text-texte-attenue">{t("saisieIncomplete")}</p>
        ) : (
          <>
            <p className="mt-4 text-texte-attenue">
              {t("ensemble", { kg: ensemble })}
            </p>

            <p className="mt-2 text-2xl font-semibold">
              {resultat.requis
                ? t("permisRequis", { permis: resultat.requis })
                : t("horsPerimetre")}
            </p>

            <ul className="mt-6 space-y-3" aria-live="polite">
              {resultat.verdicts.map(({ categorie, verdict }) => (
                <li
                  key={categorie}
                  className="flex items-start gap-3 border-t border-bordure pt-3"
                >
                  <span className="w-12 shrink-0 font-mono text-sm font-semibold">
                    {categorie}
                  </span>
                  <span
                    className={
                      verdict.compatible ? "text-succes" : "text-texte-attenue"
                    }
                  >
                    {verdict.compatible
                      ? t("autorise")
                      : verdict.motifs[0] ?? t("nonAutorise")}
                  </span>
                </li>
              ))}
            </ul>

            <p className="mt-6 text-sm text-texte-attenue">{t("avertissement")}</p>
          </>
        )}
      </Carte>
    </div>
  );
}
