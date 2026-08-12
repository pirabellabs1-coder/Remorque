/**
 * Règles du jeton de réinitialisation de mot de passe.
 *
 * Le lien de connexion proposait « Oublié ? » et menait à une page qui
 * n'existait pas. Ce n'est pas un manque de confort : quelqu'un qui perd son
 * mot de passe perd son compte, ses réservations et ses documents de location.
 * C'était le seul des manques recensés à faire perdre un usager pour de bon.
 *
 * Logique pure, comme le reste du domaine : aucune base, aucun envoi. Ce qui
 * se décide ici est ce qu'un jeton autorise, et rien d'autre.
 */

/**
 * Une heure.
 *
 * Assez pour aller chercher le courriel, y compris s'il attend quelques
 * minutes dans une file. Assez court pour qu'un lien retrouvé dans une boîte
 * partagée trois jours plus tard n'ouvre plus rien. Les liens de
 * réinitialisation traînent : ils sont transférés par erreur, ils restent dans
 * les corbeilles, ils survivent aux sauvegardes de téléphone.
 */
export const VALIDITE_MINUTES = 60;

/**
 * Longueur minimale d'un mot de passe.
 *
 * La même qu'à l'inscription, et c'est le seul point qui compte : un parcours
 * de réinitialisation plus permissif que l'inscription serait la porte
 * dérobée du formulaire d'entrée — il suffirait de « perdre » son mot de passe
 * pour en choisir un plus court.
 */
export const LONGUEUR_MINIMALE = 12;

/** Ce qu'un jeton présenté permet de faire. */
export type VerdictJeton =
  | { valide: true }
  | { valide: false; cle: "inconnu" | "expire" | "dejaUtilise" };

export type EtatJeton = {
  expireLe: Date;
  consommeLe: Date | null;
};

/**
 * Ce jeton ouvre-t-il encore le formulaire ?
 *
 * **Trois verdicts, pas deux.** « Expiré » et « déjà utilisé » se ressemblent
 * de loin et n'appellent pas la même chose : le premier se répare en
 * redemandant un lien, le second veut dire que le mot de passe a déjà été
 * changé — et si ce n'est pas par soi, c'est le moment de s'en inquiéter.
 * Confondre les deux, c'est faire redemander un lien à quelqu'un dont le
 * compte vient d'être pris.
 *
 * L'ordre compte : un jeton consommé le reste après son expiration, et c'est
 * la consommation qu'il faut annoncer — elle en dit plus.
 */
export function verdictJeton(
  etat: EtatJeton | null,
  maintenant: Date,
): VerdictJeton {
  if (!etat) return { valide: false, cle: "inconnu" };
  if (etat.consommeLe) return { valide: false, cle: "dejaUtilise" };
  if (etat.expireLe <= maintenant) return { valide: false, cle: "expire" };
  return { valide: true };
}

/** Date d'expiration d'un jeton créé maintenant. */
export function expirationDepuis(maintenant: Date): Date {
  return new Date(maintenant.getTime() + VALIDITE_MINUTES * 60_000);
}

/**
 * Le mot de passe proposé est-il recevable ?
 *
 * Une seule règle, la longueur — délibérément. Les exigences de composition
 * (une majuscule, un chiffre, un caractère spécial) produisent `Bonjour1!` et
 * rien de mieux : elles allongent la peine sans allonger l'entropie, et
 * poussent à noter le mot de passe quelque part. Douze caractères libres valent
 * mieux que huit contraints.
 */
export function motDePasseRecevable(motDePasse: string): boolean {
  return motDePasse.length >= LONGUEUR_MINIMALE;
}
