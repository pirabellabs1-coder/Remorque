import { describe, expect, it } from "vitest";

import {
  constatSuffisammentIllustre,
  MEDIAS_MAXIMUM,
  PHOTOS_MINIMUM,
  TAILLE_MAXIMUM,
  verdictMedia,
} from "./medias";

/**
 * Ce que ces tests protègent : « un constat porte des preuves, pas des
 * promesses ».
 *
 * Le constat se signe sur un parking, souvent en bordure de réseau, entre deux
 * personnes pressées. Chaque refus doit donc dire pourquoi — « refusé » sans
 * motif fait recommencer à l'identique — et chaque acceptation doit valoir
 * quelque chose le jour où le plancher fendu se conteste.
 */

const photo = { typeMime: "image/jpeg", taille: 2_000_000 };
const video = { typeMime: "video/mp4", taille: 20_000_000 };

describe("recevabilité d'un fichier", () => {
  it("accepte les formats que produisent les téléphones", () => {
    expect(verdictMedia(photo, 0)).toEqual({ ok: true, type: "photo" });
    expect(verdictMedia(video, 0)).toEqual({ ok: true, type: "video" });
    // Le format d'Apple, qu'on reçoit sans le demander.
    expect(verdictMedia({ typeMime: "video/quicktime", taille: 1000 }, 0)).toEqual({
      ok: true,
      type: "video",
    });
  });

  it("refuse ce qui n'est ni image ni vidéo", () => {
    // Sans ce contrôle, le constat devient un dépôt de fichiers arbitraires.
    expect(verdictMedia({ typeMime: "application/pdf", taille: 1000 }, 0)).toEqual({
      ok: false,
      motif: "type",
    });
  });

  it("applique à la vidéo une limite plus large qu'à la photo", () => {
    // Un téléphone récent filme en haute définition : imposer la limite des
    // photos ferait échouer presque toutes les vidéos.
    expect(TAILLE_MAXIMUM.video).toBeGreaterThan(TAILLE_MAXIMUM.photo);

    const grosse = { typeMime: "video/mp4", taille: TAILLE_MAXIMUM.photo + 1 };
    expect(verdictMedia(grosse, 0).ok).toBe(true);
  });

  it("refuse au-delà de sa propre limite", () => {
    expect(
      verdictMedia({ typeMime: "video/mp4", taille: TAILLE_MAXIMUM.video + 1 }, 0),
    ).toEqual({ ok: false, motif: "taille" });
  });

  it("refuse quand le constat est déjà plein", () => {
    // Le cas réel : une pellicule entière sélectionnée d'un geste, qui
    // bloquerait la remise du matériel pendant dix minutes.
    expect(verdictMedia(photo, MEDIAS_MAXIMUM)).toEqual({
      ok: false,
      motif: "trop",
    });
  });

  it("vérifie la place avant le format", () => {
    // L'ordre compte : dire « format refusé » sur un constat plein enverrait
    // chercher un autre fichier, qui serait refusé aussi.
    expect(verdictMedia({ typeMime: "application/pdf", taille: 1 }, MEDIAS_MAXIMUM))
      .toEqual({ ok: false, motif: "trop" });
  });
});

describe("valeur probante", () => {
  it("exige un minimum de photographies", () => {
    const photos = Array.from({ length: PHOTOS_MINIMUM }, () => ({
      type: "photo" as const,
    }));
    expect(constatSuffisammentIllustre(photos)).toBe(true);
    expect(constatSuffisammentIllustre(photos.slice(1))).toBe(false);
  });

  it("ne laisse pas les vidéos tenir lieu de photographies", () => {
    // Une vidéo se regarde mal en pièce jointe d'un litige, ne s'imprime pas,
    // et un assureur demande des photographies. Elle complète, elle ne
    // remplace pas.
    const videos = Array.from({ length: 10 }, () => ({ type: "video" as const }));
    expect(constatSuffisammentIllustre(videos)).toBe(false);
  });
});
