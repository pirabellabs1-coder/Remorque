/**
 * Calculateur de charge — section 4.1.
 *
 * Répond à la seule question que se pose vraiment le locataire : « combien
 * puis-je réellement charger ? » La réponse n'est pas la charge utile inscrite
 * sur la remorque : elle est plafonnée par la masse que le véhicule tracteur
 * est capable de tirer.
 */

export type EntreesCharge = {
  /** Poids total autorisé en charge de la remorque, en kilogrammes. */
  ptacRemorqueKg: number;
  /** Poids de la remorque à vide, en kilogrammes. */
  poidsVideRemorqueKg: number;
  /** Masse tractable du véhicule pour ce type de remorque, en kilogrammes. */
  masseTractableKg: number;
};

export type ResultatCharge = {
  /** Charge utile théorique de la remorque, indépendamment du véhicule. */
  chargeUtileRemorqueKg: number;
  /** Masse totale réellement autorisée pour l'ensemble remorque + chargement. */
  masseAutoriseeKg: number;
  /** Ce que le locataire peut effectivement charger. */
  chargeReelleKg: number;
  /** Vrai si c'est le véhicule, et non la remorque, qui limite. */
  limiteParLeVehicule: boolean;
  /** Charge perdue à cause du véhicule, en kilogrammes. */
  chargePerdueKg: number;
};

export function calculerCharge(entrees: EntreesCharge): ResultatCharge {
  const { ptacRemorqueKg, poidsVideRemorqueKg, masseTractableKg } = entrees;

  if (poidsVideRemorqueKg > ptacRemorqueKg) {
    throw new Error(
      "Le poids à vide de la remorque ne peut pas dépasser son poids total autorisé en charge.",
    );
  }

  const chargeUtileRemorqueKg = ptacRemorqueKg - poidsVideRemorqueKg;

  // Le véhicule ne tire pas « le chargement » mais l'ensemble : la remorque
  // vide consomme déjà une partie de la masse tractable.
  const masseAutoriseeKg = Math.min(ptacRemorqueKg, masseTractableKg);
  const chargeReelleKg = Math.max(0, masseAutoriseeKg - poidsVideRemorqueKg);

  return {
    chargeUtileRemorqueKg,
    masseAutoriseeKg,
    chargeReelleKg,
    limiteParLeVehicule: masseTractableKg < ptacRemorqueKg,
    chargePerdueKg: chargeUtileRemorqueKg - chargeReelleKg,
  };
}
