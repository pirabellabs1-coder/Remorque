/**
 * Assurance : ce que la plateforme fait, et ce qu'elle ne fait pas.
 *
 * **Elle n'assure rien.** Le matériel est assuré par son propriétaire, à qui
 * la loi en fait obligation. La plateforme n'est ni assureur ni courtier, ne
 * souscrit aucun contrat pour le compte des parties, et n'indemnise personne.
 *
 * Le site affirmait l'inverse d'un bout à l'autre — « assurance comprise »
 * jusque dans le contrat de location remis aux deux parties. Une affirmation
 * fausse sur une page commerciale est un risque ; la même dans un contrat en
 * est un autre, autrement sérieux.
 *
 * Ce que la plateforme apporte réellement, et qui remplace la promesse :
 *
 *  1. **L'état des lieux photographique horodaté**, au départ et au retour,
 *     conservé et opposable aux deux parties. C'est la pièce qui tranche.
 *  2. **La caution**, enregistrée sans être débitée, encadrée par le plancher
 *     et le plafond du pays.
 *  3. **Le paiement conservé** jusqu'à la remise, et l'identité vérifiée.
 *
 * Au-delà de la caution, un dommage se règle entre l'assureur du locataire et
 * celui du propriétaire. La plateforme fournit les pièces, elle n'arbitre pas
 * les polices.
 *
 * Ce fichier subsiste pour porter cette règle en un seul endroit, et pour que
 * le jour où un partenariat serait signé, la décision se prenne ici plutôt
 * qu'au fil de quarante chaînes de caractères.
 */

/**
 * La plateforme couvre-t-elle les locations ?
 *
 * Non, et rien dans l'interface ne doit le laisser croire. Passer cette valeur
 * à `true` sans contrat signé reviendrait à promettre une garantie
 * inexistante.
 */
export const PLATEFORME_ASSURE = false;
