/**
 * Postes ouverts au recrutement.
 *
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  LISTE VIDE TANT QU'AUCUN POSTE N'EST RÉELLEMENT OUVERT                 ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * Même discipline que pour l'identité de l'éditeur : rien n'est inventé ici.
 * Une offre d'emploi fictive n'est pas un texte de remplissage comme un autre —
 * quelqu'un y répond, prépare une candidature, attend. Le coût retombe sur une
 * personne qui cherche du travail, ce qui est la pire façon de meubler une
 * page.
 *
 * La page de recrutement s'adapte : sans poste, elle dit qu'il n'y en a pas et
 * ouvre la candidature spontanée ; dès qu'une entrée est ajoutée ici, elle
 * l'affiche avec son balisage `JobPosting`. Aucun code à changer.
 */

export type Poste = {
  /** Identifiant stable, employé comme ancre et comme clé de traduction. */
  cle: string;
  intitule: string;
  /** « Temps plein », « Alternance », « Stage »… */
  contrat: string;
  lieu: string;
  /** Description en quelques phrases, sans langue de bois. */
  mission: string;
  /** Date de publication, au format ISO. Sert au balisage structuré. */
  publieLe: string;
};

export const POSTES: readonly Poste[] = [];

/** Y a-t-il quelque chose à proposer aujourd'hui ? */
export function postesOuverts(): boolean {
  return POSTES.length > 0;
}
