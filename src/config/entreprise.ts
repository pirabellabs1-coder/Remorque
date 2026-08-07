/**
 * Identité de l'éditeur du site.
 *
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  À RENSEIGNER AVANT TOUTE MISE EN LIGNE PUBLIQUE                        ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * Ces informations sont **obligatoires** : article 6-III de la loi pour la
 * confiance dans l'économie numérique pour les mentions légales, article
 * L.111-1 du code de la consommation pour les conditions de vente, et
 * article 13 du RGPD pour la politique de confidentialité.
 *
 * Elles ne sont pas inventées ici, et ne doivent pas l'être : une raison
 * sociale ou un numéro d'immatriculation faux exposent plus qu'une mention
 * absente — c'est une fausse déclaration, non un oubli.
 *
 * Les valeurs vides sont donc laissées vides, et l'interface le dit
 * franchement plutôt que d'afficher un texte à trous qui passerait pour
 * complet. `identiteComplete()` permet aux pages de le vérifier.
 */

export const ENTREPRISE = {
  /** Raison sociale exacte, telle qu'immatriculée. */
  raisonSociale: "",
  /** SARL, SAS, SASU, auto-entrepreneur… */
  formeJuridique: "",
  /** Capital social, en toutes lettres avec sa devise. Vide si sans objet. */
  capitalSocial: "",
  /** SIREN à neuf chiffres, ou équivalent du pays d'immatriculation. */
  siren: "",
  /** Numéro de TVA intracommunautaire. */
  tvaIntracommunautaire: "",
  /** Registre du commerce et ville du greffe. */
  rcs: "",

  /** Siège social. */
  adresse: "",
  codePostal: "",
  ville: "",
  pays: "France",

  /** Contact du public. Une adresse électronique suffit légalement. */
  courriel: "",
  telephone: "",

  /** Personne physique responsable de la publication. */
  directeurPublication: "",

  /**
   * Hébergeur — sa mention est obligatoire, et c'est celle qu'on oublie.
   * Les valeurs ci-dessous correspondent à un déploiement sur Vercel ; à
   * corriger si l'hébergement change.
   */
  hebergeur: {
    nom: "Vercel Inc.",
    adresse: "440 N Barranca Ave #4133, Covina, CA 91723",
    pays: "États-Unis",
    site: "https://vercel.com",
  },

  /**
   * Médiateur de la consommation.
   *
   * Obligatoire pour tout professionnel vendant à des particuliers en France
   * (article L.612-1 du code de la consommation). L'adhésion à un médiateur
   * agréé est payante et doit être souscrite : elle ne se déclare pas.
   */
  mediateur: {
    nom: "",
    adresse: "",
    site: "",
  },

  /**
   * Assureur de la plateforme.
   *
   * La couverture est l'argument central du produit ; le nom de l'assureur et
   * le numéro de police doivent être vérifiables par le locataire.
   */
  assureur: {
    nom: "",
    police: "",
  },

  /** Délégué à la protection des données, si désigné. */
  dpo: {
    nom: "",
    courriel: "",
  },
} as const;

/**
 * L'identité minimale est-elle renseignée ?
 *
 * Volontairement strict : ces cinq champs sont ceux sans lesquels les mentions
 * légales ne remplissent pas leur office. Le reste peut manquer sans rendre la
 * page fautive.
 */
export function identiteComplete(): boolean {
  return Boolean(
    ENTREPRISE.raisonSociale &&
      ENTREPRISE.siren &&
      ENTREPRISE.adresse &&
      ENTREPRISE.courriel &&
      ENTREPRISE.directeurPublication,
  );
}

/** Adresse postale sur une ligne, pour les mentions et les documents. */
export function adressePostale(): string {
  return [
    ENTREPRISE.adresse,
    [ENTREPRISE.codePostal, ENTREPRISE.ville].filter(Boolean).join(" "),
    ENTREPRISE.pays,
  ]
    .filter(Boolean)
    .join(", ");
}

/**
 * Date de dernière mise à jour des documents contractuels.
 *
 * Une version datée est ce qui rend un consentement opposable : le registre
 * consigne « conditions générales, version 2026-07 », encore faut-il pouvoir
 * dire ce que disait cette version-là.
 */
export const VERSION_DOCUMENTS = "2026-07";
