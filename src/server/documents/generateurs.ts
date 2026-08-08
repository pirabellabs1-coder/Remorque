import "server-only";

import { createTranslator, createFormatter } from "use-intl/core";

import { ENTREPRISE, identiteComplete } from "@/config/entreprise";
import { DEFAULT_MARKET, type Market } from "@/config/markets";
import { POINTS_CONTROLE } from "@/domain/location/constat";
import { chargerToutesLesTraductions } from "@/i18n/messages";

import { Composeur } from "./composer";
import type { ConstatDocument, DossierDocument } from "./depot";
import type { FactureDocument } from "./facture";

/**
 * Les trois documents de la plateforme.
 *
 * Ils sont engendrés à la demande, jamais stockés : un contrat rangé sur un
 * disque devient faux dès qu'une donnée bouge, et il faudrait alors le
 * régénérer partout ou vivre avec deux vérités. Ici le document est toujours
 * le reflet exact de la base au moment du téléchargement.
 *
 * **L'honnêteté prime sur la présentation.** Quand l'identité de l'éditeur
 * n'est pas publiée, ou qu'aucun assureur n'est renseigné pour le pays, le
 * document le dit en toutes lettres au lieu d'imprimer des blancs qui le
 * feraient passer pour valide. C'est la règle que `config/entreprise.ts` pose
 * déjà pour les mentions légales.
 */

type Traducteur = (cle: string, valeurs?: Record<string, string | number>) => string;

async function outils(locale: Market) {
  const messages = await chargerToutesLesTraductions(locale);

  // Les clés sont composées à l'exécution (points de contrôle, types de
  // constat) : le typage statique de `next-intl` ne peut pas les connaître.
  const t = createTranslator({
    locale,
    messages,
    namespace: "documents",
  }) as unknown as Traducteur;

  const format = createFormatter({ locale });

  const date = (valeur: Date) =>
    format.dateTime(valeur, {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

  const dateHeure = (valeur: Date) =>
    format.dateTime(valeur, {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "numeric",
      minute: "numeric",
    });

  /** Les montants sont des entiers de centimes — règle 1. */
  const montant = (centimes: number, devise: string) =>
    format.number(centimes / 100, {
      style: "currency",
      currency: devise,
      maximumFractionDigits: 2,
    });

  return { t, date, dateHeure, montant };
}

const PLATEFORME = "FlexiTrailer";

/** Bloc « parties » et « matériel », commun aux trois documents. */
function corpsCommun(
  composeur: Composeur,
  dossier: DossierDocument,
  t: Traducteur,
  date: (valeur: Date) => string,
): void {
  composeur
    .titre(t("commun.parties"))
    .lignes([
      [t("commun.locataire"), dossier.locataireNom],
      [t("commun.proprietaire"), dossier.proprietaireNom],
    ])
    .espace()
    .titre(t("commun.materiel"))
    .lignes([
      [t("commun.designation"), dossier.annonceTitre],
      [t("commun.ville"), dossier.annonceVille],
      [
        t("commun.ptac"),
        dossier.ptacKg === null
          ? t("commun.nonRenseigne")
          : t("commun.kg", { valeur: dossier.ptacKg }),
      ],
      [
        t("commun.chargeUtile"),
        dossier.chargeUtileKg === null
          ? t("commun.nonRenseigne")
          : t("commun.kg", { valeur: dossier.chargeUtileKg }),
      ],
    ])
    .espace()
    .titre(t("commun.periode"))
    .lignes([
      [t("commun.du"), date(dossier.debut)],
      [t("commun.au"), date(dossier.fin)],
      [t("commun.duree"), t("commun.jours", { nombre: dossier.nombreJours })],
    ]);
}

/** Mention de pied, identique partout : qui a édité, quand, et sous quelle réserve. */
function pied(
  composeur: Composeur,
  dossier: DossierDocument,
  t: Traducteur,
  date: (valeur: Date) => string,
): void {
  if (!identiteComplete()) {
    composeur.espace(16).paragraphe(t("commun.identiteIncomplete"), { attenue: true });
  }

  composeur.pied(
    `${t("commun.reference", { numero: dossier.numero })} — ${t("commun.editeLe", {
      date: date(new Date()),
      plateforme: ENTREPRISE.raisonSociale || PLATEFORME,
    })}`,
  );
}

export async function contratDeLocation(
  dossier: DossierDocument,
  locale: Market = DEFAULT_MARKET,
): Promise<Uint8Array> {
  const { t, date, montant } = await outils(locale);
  const composeur = await Composeur.creer();

  composeur.enTete(
    t("contrat.titre"),
    t("contrat.sousTitre", { plateforme: ENTREPRISE.raisonSociale || PLATEFORME }),
  );

  composeur.espace(4).paragraphe(t("commun.reference", { numero: dossier.numero }), {
    attenue: true,
  });

  corpsCommun(composeur, dossier, t, date);

  composeur
    .espace()
    .titre(t("contrat.montants"))
    .lignes([
      [t("contrat.loyer"), montant(dossier.loyer, dossier.devise)],
      [t("contrat.fraisService"), montant(dossier.fraisService, dossier.devise)],
      [t("contrat.total"), montant(dossier.totalLocataire, dossier.devise)],
      [t("contrat.caution"), montant(dossier.caution, dossier.devise)],
    ])
    .espace()
    .separateur()
    .titre(t("contrat.conditions"))
    .paragraphe(t("contrat.conditionsTexte"))
    .espace(6)
    .paragraphe(t("contrat.cautionTexte"))
    .espace(6)
    .paragraphe(t("contrat.assuranceTexte"))
    .espace()
    .titre(t("contrat.signatures"))
    .paragraphe(t("contrat.signaturesTexte"))
    .espace(6)
    .paragraphe(
      dossier.confirmeeLe
        ? t("contrat.confirmeLe", { date: date(dossier.confirmeeLe) })
        : t("contrat.nonConfirme"),
      { attenue: !dossier.confirmeeLe },
    );

  pied(composeur, dossier, t, date);
  return composeur.rendre(`${t("contrat.titre")} ${dossier.numero}`);
}

export async function attestationAssurance(
  dossier: DossierDocument,
  locale: Market = DEFAULT_MARKET,
): Promise<Uint8Array> {
  const { t, date } = await outils(locale);
  const composeur = await Composeur.creer();

  composeur.enTete(
    t("attestation.titre"),
    t("attestation.sousTitre", { numero: dossier.numero }),
  );

  corpsCommun(composeur, dossier, t, date);

  composeur
    .espace()
    .titre(t("attestation.assureur"))
    .lignes([
      [
        t("attestation.assureur"),
        dossier.assureurNom ?? t("commun.nonRenseigne"),
      ],
      [t("attestation.pays"), dossier.paysNom],
    ]);

  if (!dossier.assureurNom) {
    composeur.espace(8).paragraphe(t("attestation.assureurManquant"), {
      attenue: true,
    });
  }

  composeur
    .espace()
    .separateur()
    .titre(t("attestation.couverture"))
    .paragraphe(t("attestation.couvertureTexte"))
    .espace(6)
    .titre(t("attestation.portee"))
    .paragraphe(t("attestation.porteeTexte"));

  pied(composeur, dossier, t, date);
  return composeur.rendre(`${t("attestation.titre")} ${dossier.numero}`);
}

export async function facturePdf(
  document: FactureDocument,
  locale: Market = DEFAULT_MARKET,
): Promise<Uint8Array> {
  const { t, date, montant } = await outils(locale);
  const composeur = await Composeur.creer();

  composeur.enTete(
    t("facture.titre"),
    t("facture.sousTitre", { numero: document.numero }),
  );

  composeur
    .espace(4)
    .paragraphe(t("facture.emiseLe", { date: date(document.emiseLe) }), {
      attenue: true,
    })
    .espace()
    .titre(t("facture.client"))
    .lignes([
      [t("commun.locataire"), document.destinataireNom],
      [t("commun.reference", { numero: document.reference }), document.annonceTitre],
    ])
    .espace()
    .titre(t("facture.detail"))
    .lignes(
      document.lignes.map(
        (ligne) =>
          [
            t(`facture.${ligne.cle}`),
            montant(ligne.montantTtc, document.devise),
          ] as const,
      ),
    )
    .espace()
    .separateur()
    .titre(t("facture.totaux"))
    .lignes([
      [t("facture.totalHt"), montant(document.montantHt, document.devise)],
      [
        // Le taux est en points de base : 2000 se lit « 20 % ».
        t("facture.tva", { taux: document.tauxTvaBp / 100 }),
        montant(document.montantTva, document.devise),
      ],
      [t("facture.totalTtc"), montant(document.montantTtc, document.devise)],
    ])
    .espace()
    .titre(t("facture.regimeTitre"))
    .paragraphe(t("facture.regimeTexte"))
    .espace(6)
    .paragraphe(t("facture.conservation"), { attenue: true });

  if (!identiteComplete()) {
    composeur.espace(16).paragraphe(t("commun.identiteIncomplete"), { attenue: true });
  }

  composeur.pied(
    `${document.numero} — ${t("commun.editeLe", {
      date: date(new Date()),
      plateforme: ENTREPRISE.raisonSociale || PLATEFORME,
    })}`,
  );

  return composeur.rendre(`${t("facture.titre")} ${document.numero}`);
}

export async function constatPdf(
  dossier: DossierDocument,
  constats: readonly ConstatDocument[],
  locale: Market = DEFAULT_MARKET,
): Promise<Uint8Array> {
  const { t, date, dateHeure } = await outils(locale);
  const composeur = await Composeur.creer();

  composeur.enTete(
    t("constat.titre"),
    t("constat.sousTitre", { numero: dossier.numero }),
  );

  corpsCommun(composeur, dossier, t, date);

  if (constats.length === 0) {
    composeur.espace().paragraphe(t("constat.aucun"), { attenue: true });
    pied(composeur, dossier, t, date);
    return composeur.rendre(`${t("constat.titre")} ${dossier.numero}`);
  }

  // L'absence de constat de départ vaut présomption de bon état, au détriment
  // de celui qui ne l'a pas fait : le document doit le dire, pas le taire.
  if (!constats.some((constat) => constat.type === "depart")) {
    composeur.espace().paragraphe(t("constat.manqueDepart"), { attenue: true });
  }

  for (const constat of constats) {
    composeur
      .espace()
      .separateur()
      .titre(constat.type === "depart" ? t("constat.depart") : t("constat.retour"))
      .lignes(
        POINTS_CONTROLE.map(
          (point) =>
            [
              t(`constat.points.${point}`),
              constat.controles[point] === false
                ? t("constat.defaut")
                : t("constat.conforme"),
            ] as const,
        ),
      );

    if (constat.kilometrage !== null) {
      composeur.lignes([
        [t("constat.kilometrage"), String(constat.kilometrage)],
      ]);
    }

    if (constat.commentaire) {
      composeur
        .espace(6)
        .paragraphe(`${t("constat.commentaire")} : ${constat.commentaire}`);
    }

    composeur.espace(6).lignes([
      [
        t("constat.signeLocataire"),
        constat.signatureLocataireLe
          ? dateHeure(constat.signatureLocataireLe)
          : t("constat.nonSigne"),
      ],
      [
        t("constat.signeProprietaire"),
        constat.signatureProprietaireLe
          ? dateHeure(constat.signatureProprietaireLe)
          : t("constat.nonSigne"),
      ],
    ]);
  }

  composeur.espace().paragraphe(t("constat.valeurTexte"), { attenue: true });

  pied(composeur, dossier, t, date);
  return composeur.rendre(`${t("constat.titre")} ${dossier.numero}`);
}
