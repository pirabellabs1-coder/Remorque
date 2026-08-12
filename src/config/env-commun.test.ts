import { describe, expect, it } from "vitest";
import { z } from "zod";

import { analyser } from "./env-commun";

/**
 * Ce que ces tests protègent : « une variable écrite sans valeur ne casse pas
 * le démarrage ».
 *
 * Le cas s'est produit pour de bon. `vercel env pull` réécrit `.env.local` en
 * ne rendant que les *noms* des variables marquées sensibles — leurs valeurs
 * restent chiffrées chez l'hébergeur. Le fichier se retrouve plein de lignes
 * `RESEND_API_KEY=`, et le schéma refusait de démarrer sur des variables qu'il
 * déclarait pourtant facultatives. Le message d'erreur accusait Stripe et
 * Resend, jamais configurés ici, au lieu de dire que le fichier avait été
 * réécrit : quatre-vingt-huit tests tombaient pour une raison qui n'était
 * écrite nulle part.
 */

const schema = z.object({
  OBLIGATOIRE: z.string().min(1),
  FACULTATIVE: z.string().url().optional(),
  PREFIXEE: z.string().startsWith("sk_").optional(),
});

describe("valeurs vides", () => {
  it("traite une chaîne vide comme une absence", () => {
    const resultat = analyser(
      schema,
      { OBLIGATOIRE: "présente", FACULTATIVE: "", PREFIXEE: "" },
      "essai",
    );

    expect(resultat.FACULTATIVE).toBeUndefined();
    expect(resultat.PREFIXEE).toBeUndefined();
  });

  it("laisse échouer une obligatoire vraiment vide", () => {
    // La souplesse s'arrête là : une variable exigée et laissée vide reste une
    // erreur, sans quoi la validation ne servirait plus à rien.
    expect(() => analyser(schema, { OBLIGATOIRE: "" }, "essai")).toThrow(
      /OBLIGATOIRE/,
    );
  });

  it("ne touche pas aux valeurs renseignées", () => {
    const resultat = analyser(
      schema,
      {
        OBLIGATOIRE: "présente",
        FACULTATIVE: "https://exemple.fr",
        PREFIXEE: "sk_essai",
      },
      "essai",
    );

    expect(resultat.FACULTATIVE).toBe("https://exemple.fr");
    expect(resultat.PREFIXEE).toBe("sk_essai");
  });

  it("refuse toujours une valeur présente mais mal formée", () => {
    // Une adresse invalide n'est pas une absence : elle signale une faute de
    // saisie, et la taire ferait échouer l'appel réseau plus tard, ailleurs.
    expect(() =>
      analyser(
        schema,
        { OBLIGATOIRE: "présente", FACULTATIVE: "pas-une-adresse" },
        "essai",
      ),
    ).toThrow(/FACULTATIVE/);
  });
});
