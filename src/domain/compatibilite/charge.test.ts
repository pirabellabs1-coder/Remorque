import { describe, expect, it } from "vitest";

import { calculerCharge } from "./charge";

describe("calculateur de charge", () => {
  it("rend la charge utile complète quand le véhicule ne limite pas", () => {
    const resultat = calculerCharge({
      ptacRemorqueKg: 1_300,
      poidsVideRemorqueKg: 300,
      masseTractableKg: 1_500,
    });

    expect(resultat.chargeUtileRemorqueKg).toBe(1_000);
    expect(resultat.chargeReelleKg).toBe(1_000);
    expect(resultat.limiteParLeVehicule).toBe(false);
    expect(resultat.chargePerdueKg).toBe(0);
  });

  it("plafonne la charge quand c'est le véhicule qui limite", () => {
    const resultat = calculerCharge({
      ptacRemorqueKg: 1_300,
      poidsVideRemorqueKg: 300,
      masseTractableKg: 900,
    });

    // Le véhicule tire 900 kg au total, dont 300 kg de remorque vide.
    expect(resultat.chargeReelleKg).toBe(600);
    expect(resultat.limiteParLeVehicule).toBe(true);
    expect(resultat.chargePerdueKg).toBe(400);
  });

  it("renvoie zéro plutôt qu'une valeur négative quand le véhicule est trop faible", () => {
    const resultat = calculerCharge({
      ptacRemorqueKg: 1_300,
      poidsVideRemorqueKg: 300,
      masseTractableKg: 250,
    });

    expect(resultat.chargeReelleKg).toBe(0);
  });

  it("refuse une remorque dont le poids à vide dépasse le poids autorisé", () => {
    expect(() =>
      calculerCharge({
        ptacRemorqueKg: 500,
        poidsVideRemorqueKg: 600,
        masseTractableKg: 1_500,
      }),
    ).toThrow();
  });
});
