import "server-only";

import { and, eq, gt, sql } from "drizzle-orm";

import { db } from "@/server/db";
import { tentativeConnexion } from "@/server/db/schema";

/**
 * Limitation des tentatives de connexion.
 *
 * Sans elle, rien n'empêche d'essayer des milliers de mots de passe sur une
 * adresse connue. scrypt rend chaque essai coûteux — quelques dizaines de
 * millisecondes — mais un attaquant patient dispose de millions de secondes, et
 * les listes de mots de passe courants font quelques milliers d'entrées.
 *
 * Deux compteurs, et non un seul.
 *
 *   — **Par adresse électronique**, qui protège un compte précis contre le
 *     bourrage de mots de passe.
 *   — **Par adresse IP**, qui protège l'ensemble des comptes contre le
 *     balayage : essayer le même mot de passe très répandu sur dix mille
 *     adresses différentes ne déclencherait jamais le premier compteur.
 *
 * Le comptage est en base et non en mémoire : sur une plateforme sans serveur,
 * chaque requête peut atterrir sur une instance différente, et un compteur en
 * mémoire se réinitialiserait à chaque fois — c'est-à-dire jamais ne
 * déclencherait.
 */

/** Au-delà, l'adresse est bloquée le temps de la fenêtre. */
const SEUIL_COURRIEL = 8;

/** Plus permissif : une entreprise ou un foyer partagent une seule adresse IP. */
const SEUIL_IP = 30;

/** Fenêtre glissante d'observation. */
const FENETRE_MINUTES = 15;

export type Verdict =
  | { autorise: true }
  | { autorise: false; secondesAvant: number };

function debutFenetre(): Date {
  return new Date(Date.now() - FENETRE_MINUTES * 60_000);
}

/**
 * Peut-on encore essayer ?
 *
 * Appelée **avant** toute vérification de mot de passe : le calcul scrypt est
 * précisément ce qu'il ne faut pas offrir à un attaquant, puisqu'il coûte
 * autant au serveur qu'à lui.
 */
export async function tentativeAutorisee(
  courriel: string,
  adresseIp: string | undefined,
): Promise<Verdict> {
  const depuis = debutFenetre();

  const [parCourriel] = await db
    .select({
      nombre: sql<number>`count(*)::int`,
      // Le pilote rend `max()` sous forme de chaîne, jamais de date : le type
      // le dit, sans quoi la conversion est oubliée jusqu'au premier blocage —
      // c'est-à-dire jusqu'au moment précis où le code doit fonctionner.
      derniere: sql<string | null>`max(${tentativeConnexion.creeLe})`,
    })
    .from(tentativeConnexion)
    .where(
      and(
        eq(tentativeConnexion.courriel, courriel),
        eq(tentativeConnexion.reussie, false),
        gt(tentativeConnexion.creeLe, depuis),
      ),
    );

  if ((parCourriel?.nombre ?? 0) >= SEUIL_COURRIEL) {
    return { autorise: false, secondesAvant: attenteRestante(parCourriel.derniere) };
  }

  if (adresseIp) {
    const [parIp] = await db
      .select({
        nombre: sql<number>`count(*)::int`,
        // Le pilote rend `max()` sous forme de chaîne, jamais de date : le type
      // le dit, sans quoi la conversion est oubliée jusqu'au premier blocage —
      // c'est-à-dire jusqu'au moment précis où le code doit fonctionner.
      derniere: sql<string | null>`max(${tentativeConnexion.creeLe})`,
      })
      .from(tentativeConnexion)
      .where(
        and(
          eq(tentativeConnexion.adresseIp, adresseIp),
          eq(tentativeConnexion.reussie, false),
          gt(tentativeConnexion.creeLe, depuis),
        ),
      );

    if ((parIp?.nombre ?? 0) >= SEUIL_IP) {
      return { autorise: false, secondesAvant: attenteRestante(parIp.derniere) };
    }
  }

  return { autorise: true };
}

/** Temps restant avant que la fenêtre glissante ne libère la plus vieille tentative. */
function attenteRestante(derniere: string | Date | null): number {
  if (!derniere) return FENETRE_MINUTES * 60;
  const horodatage = derniere instanceof Date ? derniere : new Date(derniere);
  const ecoule = (Date.now() - horodatage.getTime()) / 1000;
  return Math.max(1, Math.ceil(FENETRE_MINUTES * 60 - ecoule));
}

/**
 * Consigne une tentative.
 *
 * Les réussites sont consignées aussi : elles n'entrent dans aucun compteur,
 * mais permettent à l'usager de reconnaître une connexion qu'il n'a pas faite
 * — c'est la moitié utile d'un journal de sécurité.
 */
export async function consignerTentative(
  courriel: string,
  adresseIp: string | undefined,
  reussie: boolean,
): Promise<void> {
  await db.insert(tentativeConnexion).values({
    courriel,
    adresseIp,
    reussie,
  });
}

/**
 * Efface les tentatives échouées d'une adresse après une connexion réussie.
 *
 * Sans cela, quelqu'un qui se trompe sept fois puis réussit resterait à un
 * essai du blocage pendant un quart d'heure — pour un compte dont il vient
 * pourtant de prouver qu'il est le titulaire.
 */
export async function reinitialiserTentatives(courriel: string): Promise<void> {
  await db
    .delete(tentativeConnexion)
    .where(
      and(
        eq(tentativeConnexion.courriel, courriel),
        eq(tentativeConnexion.reussie, false),
      ),
    );
}
