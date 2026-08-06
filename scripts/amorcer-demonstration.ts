/**
 * Amorçage du graphe de démonstration en base.
 *
 * Exécution : `npm run db:demo`. Idempotent — relançable sans doublon.
 *
 * Ce script écrit en base ce que `src/server/donnees-demo/` produisait jusqu'ici
 * en mémoire : pays, propriétaires, locataires, annonces, photos, tarifs,
 * réservations et avis. À partir de là, les écrans lisent de vraies lignes,
 * jointes par de vraies clés étrangères.
 *
 * Ce que ce passage change, et qui n'est pas cosmétique :
 *
 *   — Les données survivent au redémarrage. Une annonce publiée reste publiée.
 *   — Les contraintes s'appliquent. Une réservation sans propriétaire existant
 *     est désormais refusée par la base, là où le jeu en mémoire l'acceptait
 *     sans broncher. Plusieurs incohérences ont d'ailleurs été révélées par
 *     cette première insertion.
 *   — Les agrégats sont calculés, non stockés. La note d'une annonce est la
 *     moyenne de ses avis : elle ne peut plus mentir.
 *
 * L'ordre d'insertion suit les dépendances : pays → utilisateurs → annonces →
 * réservations → avis. Chaque étape est idempotente par une clé naturelle
 * (code du pays, adresse électronique, couple ville/slug, numéro de
 * réservation), jamais par l'identifiant technique qui, lui, est engendré.
 */
import { eq, sql as raw } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { BAREME_PAR_DEFAUT } from "../src/config/baremes";
import { chargerEnv } from "../src/config/charger-env";
import { MARKETS } from "../src/config/markets";
import { PAYS, trouverVille } from "../src/config/villes";
import { JEU_DE_DEMONSTRATION } from "../src/server/annonces/catalogue";
import {
  ACTIONS_AUDIT,
  ANNUAIRE,
  aujourdhui,
  AUTEURS_ADMIN,
  AVIS_LOCATAIRES,
  decalerJours,
  generateur,
  GRAINES,
  REPARTITION_LOUEUR,
  tirer,
  tirerEntier,
  SUJETS_SUPPORT,
  tirerPondere,
  VOLUMES,
} from "../src/server/donnees-demo";
import { hacherMotDePasse } from "../src/server/authentification/mots-de-passe";
import {
  annonce,
  annoncePhoto,
  avis,
  categorie,
  caution,
  identifiant,
  journalAudit,
  litige,
  paiement,
  pays,
  reservation,
  reversement,
  sinistre,
  tarif,
  ticketSupport,
  utilisateur,
} from "../src/server/db/schema";

chargerEnv();

const url = process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL_DIRECT ou DATABASE_URL doit être défini.");
  process.exit(1);
}

// Le gestionnaire de connexions coupe les sessions longues. Les insertions
// sont donc groupées plus bas — une requête par table plutôt qu'une par ligne —
// et la connexion tolère une inactivité franche le temps des gros lots.
const sql = postgres(url, {
  max: 1,
  prepare: false,
  idle_timeout: 0,
  connect_timeout: 30,
});
const db = drizzle(sql);

/** Devise du pays, lue des marchés — jamais écrite en dur (règle 7). */
function deviseDuPays(code: string): string {
  const marche = Object.values(MARKETS).find((m) => m.country === code);
  return marche?.currency ?? "EUR";
}

function langueDuPays(code: string): string {
  const marche = Object.values(MARKETS).find((m) => m.country === code);
  return marche?.language ?? "fr";
}

/**
 * Moyens de paiement du jeu d'essai — les mêmes que ceux affichés au
 * locataire. Volontairement peu variés : un particulier paie presque toujours
 * avec la même carte.
 */
const MOYENS_PAIEMENT = ["Visa ••4218", "Mastercard ••7731", "Visa ••4218"];

const NOMS_PAYS: Record<string, string> = {
  BE: "Belgique",
  FR: "France",
  LU: "Luxembourg",
  CH: "Suisse",
  NL: "Pays-Bas",
  DE: "Allemagne",
  IT: "Italie",
  ES: "Espagne",
  PT: "Portugal",
};

/**
 * Domaine réservé aux comptes de démonstration.
 *
 * Il rend le jeu d'essai reconnaissable en une clause SQL, donc effaçable sans
 * risque d'emporter un vrai compte. C'est la condition pour que ce script soit
 * rejouable, et pour qu'on puisse un jour le retirer d'une base en exploitation
 * par une seule requête.
 */
const DOMAINE_DEMO = "@demonstration.flexitrailer.eu";

/** Mot de passe commun aux comptes de démonstration. Jeu d'essai, non secret. */
const MOT_DE_PASSE_DEMO = "Demonstration2026!";

/** Minuscules sans diacritique, pour fabriquer une adresse depuis un nom. */
function sansAccent(valeur: string): string {
  return valeur
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Efface le jeu d'essai avant de le reconstruire.
 *
 * La première version se contentait d'insertions « sans conflit », en pariant
 * sur la clé naturelle. Le pari tenait tant que le script ne changeait pas :
 * ajouter un seul tirage aléatoire décale toute la suite du générateur, donc
 * les numéros de réservation, et l'amorçage empilait 201 réservations là où il
 * en voulait 140. Un script d'amorçage qui n'est rejouable que s'il ne change
 * jamais n'est pas rejouable.
 *
 * L'effacement descend l'ordre des dépendances. Les pays et les catégories
 * survivent : ce sont des données de configuration, pas de démonstration.
 */
async function purger() {
  await sql`
    DELETE FROM avis WHERE auteur_id IN (
      SELECT id FROM utilisateur WHERE email LIKE ${"%" + DOMAINE_DEMO}
    )
  `;
  // Le journal d'audit reste en écriture seule **en exploitation** : aucun
  // code applicatif ne doit le modifier ni le purger, c'est la condition de sa
  // valeur probante. Mais les entrées de démonstration désignent des
  // réservations de démonstration, qui vont disparaître : les laisser
  // produirait un journal renvoyant à des dossiers inexistants, et l'empilerait
  // de soixante lignes à chaque amorçage. On efface donc exactement celles-là,
  // par la référence qu'elles portent, et rien d'autre.
  //
  // Deux passes : celles qui désignent une réservation de démonstration encore
  // présente, et celles devenues orphelines lors d'un amorçage antérieur —
  // leur réservation ayant déjà été effacée, aucune jointure ne les
  // retrouverait.
  await sql`
    DELETE FROM journal_audit WHERE entite_id IN (
      SELECT r.id::text FROM reservation r
      JOIN utilisateur u ON u.id = r.locataire_id
      WHERE u.email LIKE ${"%" + DOMAINE_DEMO}
    )
  `;
  await sql`
    DELETE FROM journal_audit
    WHERE entite_id IS NOT NULL
      AND entite_id NOT IN (SELECT id::text FROM reservation)
      AND entite_id NOT IN (SELECT id::text FROM annonce)
      AND entite_id NOT IN (SELECT id::text FROM utilisateur)
  `;
  for (const table of ["reversement", "caution", "paiement"]) {
    await sql.unsafe(`
      DELETE FROM ${table} WHERE reservation_id IN (
        SELECT r.id FROM reservation r
        JOIN utilisateur u ON u.id = r.locataire_id
        WHERE u.email LIKE '%${DOMAINE_DEMO}'
      )
    `);
  }
  await sql`
    DELETE FROM ticket_support WHERE demandeur_id IN (
      SELECT id FROM utilisateur WHERE email LIKE ${"%" + DOMAINE_DEMO}
    )
  `;
  await sql`
    DELETE FROM litige WHERE ouvert_par_id IN (
      SELECT id FROM utilisateur WHERE email LIKE ${"%" + DOMAINE_DEMO}
    )
  `;
  await sql`
    DELETE FROM sinistre WHERE declare_par_id IN (
      SELECT id FROM utilisateur WHERE email LIKE ${"%" + DOMAINE_DEMO}
    )
  `;
  await sql`
    DELETE FROM reservation WHERE locataire_id IN (
      SELECT id FROM utilisateur WHERE email LIKE ${"%" + DOMAINE_DEMO}
    )
  `;
  // Photos et tarifs partent en cascade avec leur annonce.
  await sql`
    DELETE FROM annonce WHERE proprietaire_id IN (
      SELECT id FROM utilisateur WHERE email LIKE ${"%" + DOMAINE_DEMO}
    )
  `;
  await sql`DELETE FROM utilisateur WHERE email LIKE ${"%" + DOMAINE_DEMO}`;
}

async function amorcer() {
  const hasard = generateur(GRAINES.activiteLoueur);
  const maintenant = aujourdhui();

  await purger();

  /* ---------------------------------------------------------------- Pays -- */
  // Les neuf pays visés, et non le seul pays de lancement : une annonce
  // bruxelloise a besoin de la Belgique en base pour exister. Seule la France
  // est active — les autres sont préparés, ce qui est la règle 7 appliquée à
  // la lettre plutôt que promise.
  for (const code of PAYS) {
    await db
      .insert(pays)
      .values({
        code,
        nom: NOMS_PAYS[code],
        marche: `${langueDuPays(code)}-${code}`,
        langue: langueDuPays(code),
        devise: deviseDuPays(code),
        actif: code === "FR",
        ...BAREME_PAR_DEFAUT,
      })
      .onConflictDoNothing({ target: pays.code });
  }

  const paysParCode = new Map(
    (await db.select().from(pays)).map((ligne) => [ligne.code, ligne]),
  );

  const categorieParSlug = new Map(
    (await db.select().from(categorie)).map((ligne) => [ligne.slug, ligne]),
  );

  /* ------------------------------------------------------- Propriétaires -- */
  // Un compte par propriétaire distinct du catalogue. L'adresse électronique
  // sert de clé naturelle : c'est elle qui rend l'amorçage rejouable.
  const proprietaires = new Map<string, string>();

  const valeursProprietaires = [];
  const prenomsVus = new Set<string>();

  for (const entree of JEU_DE_DEMONSTRATION) {
    const prenom = entree.proprietaire.prenom;
    if (prenomsVus.has(prenom)) continue;
    prenomsVus.add(prenom);

    const villeAnnonce = trouverVille(entree.villeSlug);
    const paysAnnonce = paysParCode.get(villeAnnonce?.pays ?? "FR")!;

    valeursProprietaires.push({
      email: `${sansAccent(prenom)}${DOMAINE_DEMO}`,
      emailVerifie: true,
      prenom,
      typeCompte: (entree.proprietaire.professionnel
        ? "professionnel"
        : "particulier") as "professionnel" | "particulier",
      paysId: paysAnnonce.id,
      langue: paysAnnonce.langue,
      profilProprietaire: true,
      profilLocataire: false,
      identiteStatut: "verifie" as const,
      identiteVerifieeLe: decalerJours(maintenant, -400),
      // La date d'inscription alimente le « propriétaire depuis » de la fiche
      // publique : elle doit être plausible, donc antérieure aux annonces.
      creeLe: decalerJours(maintenant, -tirerEntier(hasard, 400, 900)),
    });
  }

  const lignesProprietaires = await db
    .insert(utilisateur)
    .values(valeursProprietaires)
    .returning({ id: utilisateur.id, prenom: utilisateur.prenom });

  for (const ligne of lignesProprietaires) {
    proprietaires.set(ligne.prenom!, ligne.id);
  }

  /* ----------------------------------------------------------- Locataires -- */
  const paysFrance = paysParCode.get("FR")!;

  // Exactement le volume déclaré, et non tout l'annuaire : c'est
  // `donnees-demo/volumes.ts` qui fait autorité sur les quantités, l'annuaire
  // n'étant qu'un réservoir de noms. Sans cette borne, ajouter un prénom à la
  // liste changeait silencieusement la population de la base.
  const valeursLocataires = ANNUAIRE.slice(0, VOLUMES.utilisateurs).map((personne) => ({
    email: `${sansAccent(personne.prenom)}.${sansAccent(personne.nom)}${DOMAINE_DEMO}`,
    emailVerifie: true,
    prenom: personne.prenom,
    nom: personne.nom,
    typeCompte: "particulier" as const,
    paysId: paysFrance.id,
    langue: "fr",
    profilLocataire: true,
    identiteStatut: (hasard() < 0.85 ? "verifie" : "en_attente") as
      | "verifie"
      | "en_attente",
    creeLe: decalerJours(maintenant, -tirerEntier(hasard, 10, 800)),
  }));

  const locataires = (
    await db
      .insert(utilisateur)
      .values(valeursLocataires)
      .returning({ id: utilisateur.id })
  ).map((ligne) => ligne.id);

  /* ------------------------------------------------------------ Annonces -- */
  const annoncesInserees: {
    id: string;
    proprietaireId: string;
    paysId: string;
    devise: string;
    prixJour: number;
    caution: number;
    villeSlug: string;
  }[] = [];

  for (const entree of JEU_DE_DEMONSTRATION) {
    const ville = trouverVille(entree.villeSlug);
    if (!ville) {
      console.warn(`Ville inconnue, annonce ignorée : ${entree.villeSlug}`);
      continue;
    }

    const paysAnnonce = paysParCode.get(ville.pays)!;
    const categorieAnnonce = categorieParSlug.get(entree.categorie);
    if (!categorieAnnonce) {
      console.warn(`Catégorie inconnue, annonce ignorée : ${entree.categorie}`);
      continue;
    }

    const proprietaireId = proprietaires.get(entree.proprietaire.prenom)!;

    // La position est décalée du centre de la commune de quelques centaines de
    // mètres à quelques kilomètres. Poser toutes les annonces sur le centre
    // exact donnerait des distances nulles partout : l'index géographique ne
    // servirait à rien et le tri par proximité n'ordonnerait rien. Le décalage
    // est déterministe, donc reproductible d'un amorçage à l'autre.
    //
    // Un degré de latitude vaut environ 111 km ; la longitude est corrigée par
    // le cosinus de la latitude, sans quoi le décalage serait deux fois trop
    // grand à Stockholm et correct à Séville.
    const rayonKm = 0.4 + hasard() * 6;
    const azimut = hasard() * 2 * Math.PI;
    const dLat = (rayonKm / 111) * Math.cos(azimut);
    const dLon =
      (rayonKm / (111 * Math.cos((ville.latitude * Math.PI) / 180))) *
      Math.sin(azimut);
    const [ligne] = await db
      .insert(annonce)
      .values({
        proprietaireId,
        categorieId: categorieAnnonce.id,
        paysId: paysAnnonce.id,
        titre: entree.titre,
        description: entree.description,
        slug: entree.slug,
        statut: "publiee",
        etapePublication: 6,
        ptacKg: entree.ptacKg,
        poidsVideKg: entree.poidsVideKg,
        chargeUtileKg: entree.chargeUtileKg,
        longueurUtileMm: entree.longueurUtileMm,
        largeurUtileMm: entree.largeurUtileMm,
        hauteurUtileMm: entree.hauteurUtileMm,
        freinee: entree.freinee,
        typeAttelage: entree.typeAttelage,
        faisceauBroches: entree.faisceauBroches,
        equipements: entree.equipements,
        // Le quartier est la part publique de la localisation : l'adresse exacte
        // reste masquée jusqu'à la confirmation. Faute de colonne dédiée, il
        // vit dans les caractéristiques, qui sont précisément prévues pour ce
        // qui varie d'une annonce à l'autre sans structurer le schéma.
        caracteristiques: { quartier: entree.quartier },
        ville: entree.ville,
        villeSlug: entree.villeSlug,
        position: {
          longitude: ville.longitude + dLon,
          latitude: ville.latitude + dLat,
        },
        reservationInstantanee: entree.reservationInstantanee,
        politiqueAnnulation: entree.politiqueAnnulation,
        devise: entree.devise,
        caution: entree.caution,
        publieeLe: decalerJours(maintenant, -tirerEntier(hasard, 30, 400)),
      })
      .onConflictDoUpdate({
        target: [annonce.villeSlug, annonce.slug],
        set: { titre: entree.titre, modifieLe: new Date() },
      })
      .returning({ id: annonce.id });

    annoncesInserees.push({
      id: ligne.id,
      proprietaireId,
      paysId: paysAnnonce.id,
      devise: entree.devise,
      prixJour: entree.prixJour,
      caution: entree.caution,
      villeSlug: entree.villeSlug,
    });

    /* ---- Photo ---- */
    await db.delete(annoncePhoto).where(eq(annoncePhoto.annonceId, ligne.id));
    await db.insert(annoncePhoto).values({
      annonceId: ligne.id,
      url: entree.photo,
      ordre: 0,
    });

    /* ---- Tarif de base ---- */
    // Effacé puis réinséré : un tarif est une ligne de grille, pas un attribut
    // de l'annonce. Le « mettre à jour » n'aurait pas de sens dès qu'il y en
    // aura plusieurs (saison, promotion).
    await db.delete(tarif).where(eq(tarif.annonceId, ligne.id));
    await db.insert(tarif).values({
      annonceId: ligne.id,
      prixJour: entree.prixJour,
      remiseSemaineBp: 1000,
      remiseMoisBp: 2000,
    });
  }

  /* -------------------------------------------------------- Réservations -- */
  const valeursReservations = [];
  const contexte: {
    statut: string;
    debut: Date;
    fin: Date;
    annonceId: string;
    locataireId: string;
    proprietaireId: string;
  }[] = [];

  for (let index = 0; index < VOLUMES.reservationsLoueur; index += 1) {
    const cible = tirer(hasard, annoncesInserees);
    const locataireId = tirer(hasard, locataires);

    const debut = decalerJours(maintenant, -tirerEntier(hasard, 0, 420) + 30);
    const nombreJours = tirerEntier(hasard, 1, 4);
    const fin = decalerJours(debut, nombreJours);

    // Le statut ne peut pas contredire les dates : une location terminée n'est
    // jamais « confirmée », une location future n'est jamais « clôturée ».
    let statut = tirerPondere(hasard, REPARTITION_LOUEUR);
    const passee = fin < maintenant;
    const future = debut > maintenant;

    if (passee && ["confirmee", "payee", "acceptee", "demandee", "en_cours"].includes(statut)) {
      statut = hasard() < 0.9 ? "cloturee" : "annulee";
    }
    if (future && ["cloturee", "restituee", "en_cours"].includes(statut)) {
      statut = hasard() < 0.7 ? "confirmee" : "demandee";
    }
    if (!passee && !future) statut = "en_cours";

    const loyer = cible.prixJour * nombreJours;
    const fraisService = Math.round(
      (loyer * BAREME_PAR_DEFAUT.commissionLocataireBp) / 10_000,
    );
    const commissionProprietaire = Math.round(
      (loyer * BAREME_PAR_DEFAUT.commissionProprietaireBp) / 10_000,
    );

    valeursReservations.push({
      numero: `FT-${debut.getFullYear()}-${(index + 1).toString().padStart(4, "0")}`,
      annonceId: cible.id,
      locataireId,
      proprietaireId: cible.proprietaireId,
      paysId: cible.paysId,
      devise: cible.devise,
      statut: statut as never,
      debut,
      fin,
      nombreJours,
      loyer,
      fraisService,
      commissionProprietaire,
      // Le net reversé est dérivé, jamais saisi : loyer moins la commission du
      // propriétaire. L'écrire à la main serait la première occasion de le
      // faire diverger du calcul officiel.
      montantReverse: loyer - commissionProprietaire,
      totalLocataire: loyer + fraisService,
      caution: cible.caution,
      // Le barème appliqué est figé dans la réservation : le modifier plus tard
      // depuis l'administration ne doit pas réécrire le passé.
      baremes: { ...BAREME_PAR_DEFAUT },
    });

    contexte.push({
      statut,
      debut,
      fin,
      annonceId: cible.id,
      locataireId,
      proprietaireId: cible.proprietaireId,
    });
  }

  /**
   * Compte de démonstration : celui qu'on ouvre pour montrer le produit.
   *
   * Les cent quarante réservations se répartissent sur deux cent vingt
   * locataires, soit trois ou quatre chacun — un chiffre réaliste, et un
   * espace locataire quasiment vide à la démonstration. Un compte porte donc
   * un historique complet, celui d'un particulier qui déménage, bricole et
   * part en vacances.
   *
   * Il porte les deux profils. La plateforme le prévoit — la navigation offre
   * « Passer en loueur » — et c'est le même individu : rien ne justifie deux
   * comptes pour une personne qui loue et met en location.
   *
   * Il **est** l'un des propriétaires du catalogue, et non un compte de plus.
   *
   * Une première version en créait un séparé. Résultat : deux Élodie en base,
   * l'une possédant des annonces sans jamais louer, l'autre louant sans rien
   * posséder. Le compte « les deux profils » avait donc un espace loueur vide
   * — exactement ce que la démonstration doit montrer. On promeut plutôt un
   * propriétaire existant en lui ouvrant le profil locataire : c'est la même
   * personne, et c'est ce que la plateforme prévoit.
   */
  const [compteDemo] = await db
    .update(utilisateur)
    .set({
      email: `moi${DOMAINE_DEMO}`,
      nom: "Vasseur",
      profilLocataire: true,
      identiteVerifieeLe: decalerJours(maintenant, -500),
      creeLe: decalerJours(maintenant, -730),
    })
    .where(eq(utilisateur.id, proprietaires.get("Élodie") ?? ""))
    .returning({ id: utilisateur.id });

  // Les locations lui sont attribuées en nombre exact — `VOLUMES` fait
  // autorité — et prises dans le lot général plutôt qu'ajoutées : les totaux
  // de la plateforme restent justes et aucune ligne n'est comptée deux fois.
  //
  // Elles sont prélevées à intervalle régulier pour couvrir toute la période
  // et toute la palette de statuts. Dix-huit consécutives tomberaient dans le
  // même mois et donneraient un historique invraisemblable.
  const pas = Math.floor(valeursReservations.length / VOLUMES.reservationsLocataire);
  let attribuees = 0;

  for (
    let index = 0;
    index < valeursReservations.length && attribuees < VOLUMES.reservationsLocataire;
    index += pas
  ) {
    // Nul ne loue chez soi : si l'annonce lui appartenait, on passe.
    if (contexte[index].proprietaireId === compteDemo.id) continue;
    valeursReservations[index].locataireId = compteDemo.id;
    contexte[index].locataireId = compteDemo.id;
    attribuees += 1;
  }

  const lignesReservations = await db
    .insert(reservation)
    .values(valeursReservations)
    .returning({ id: reservation.id });

  /* ---------------------------------------------------------------- Avis -- */
  // Un avis n'existe que sur une location close : la clé étrangère vers
  // `reservation` l'impose désormais, là où le jeu en mémoire permettait d'en
  // fabriquer sans réservation correspondante.
  const valeursAvis = [];

  for (const [index, ligne] of lignesReservations.entries()) {
    const source = contexte[index];
    if (source.statut !== "cloturee") continue;
    if (hasard() > 0.55) continue;

    valeursAvis.push({
      reservationId: ligne.id,
      auteurId: source.locataireId,
      destinataireId: source.proprietaireId,
      annonceId: source.annonceId,
      note: hasard() < 0.72 ? 5 : hasard() < 0.85 ? 4 : hasard() < 0.95 ? 3 : 2,
      commentaire: tirer(hasard, AVIS_LOCATAIRES),
      publieLe: decalerJours(source.fin, tirerEntier(hasard, 1, 5)),
    });
  }

  if (valeursAvis.length > 0) {
    await db.insert(avis).values(valeursAvis);
  }


  /* -------------------------------------------------- Litiges et sinistres -- */
  //
  // Un litige et un sinistre ne peuvent naître que d'une location réellement
  // engagée : la clé étrangère vers `reservation` l'impose désormais, là où le
  // jeu en mémoire pouvait en fabriquer sans support. Ils sont donc tirés parmi
  // les locations terminées ou en cours, jamais parmi les demandes refusées.
  const eligibles = lignesReservations
    .map((ligne, index) => ({ id: ligne.id, ...contexte[index] }))
    .filter((entree) =>
      ["cloturee", "restituee", "en_cours", "confirmee"].includes(entree.statut),
    );

  const MOTIFS_LITIGE = [
    "dommage",
    "retard",
    "non_conformite",
    "annulation",
    "paiement",
  ] as const;

  const DESCRIPTIONS_LITIGE: Record<string, string> = {
    dommage: "Feu arrière gauche cassé au retour, non signalé au départ.",
    retard: "Remorque rendue avec deux jours de retard, sans prévenir.",
    non_conformite: "Bâche annoncée dans l'équipement, absente à la remise.",
    annulation: "Annulation la veille du départ, remboursement contesté.",
    paiement: "Double débit constaté sur la carte du locataire.",
  };

  const valeursLitiges = [];
  const litigesPris = new Set<number>();

  for (let index = 0; index < VOLUMES.litiges && index < eligibles.length; index += 1) {
    // Un pas premier balaie tout le lot sans repasser deux fois sur la même
    // location tant qu'on n'a pas fait le tour.
    const rang = (index * 11) % eligibles.length;
    if (litigesPris.has(rang)) continue;
    litigesPris.add(rang);

    const source = eligibles[rang];
    const motif = tirer(hasard, MOTIFS_LITIGE);

    // Un litige ouvert immobilise des fonds — règle 6. Le montant réclamé est
    // donc réel et non décoratif : c'est lui que l'écran d'administration
    // additionne pour dire ce qui est gelé.
    const statut = tirerPondere(hasard, [
      { valeur: "ouvert", poids: 30 },
      { valeur: "en_resolution_amiable", poids: 25 },
      { valeur: "en_arbitrage", poids: 15 },
      { valeur: "resolu", poids: 30 },
    ] as const);

    const montantReclame = tirerEntier(hasard, 40, 900) * 100;

    valeursLitiges.push({
      reservationId: source.id,
      ouvertParId: source.locataireId,
      statut: statut as never,
      motif,
      description: DESCRIPTIONS_LITIGE[motif],
      devise: "EUR",
      montantReclame,
      montantAccorde: statut === "resolu" ? Math.round(montantReclame * 0.6) : null,
      resoluLe: statut === "resolu" ? decalerJours(source.fin, 12) : null,
      creeLe: decalerJours(source.fin, 2),
    });
  }

  if (valeursLitiges.length > 0) {
    await db.insert(litige).values(valeursLitiges);
  }

  const valeursSinistres = [];
  const sinistresPris = new Set<number>();

  for (let index = 0; index < VOLUMES.sinistres && index < eligibles.length; index += 1) {
    const rang = (index * 17 + 5) % eligibles.length;
    if (sinistresPris.has(rang) || litigesPris.has(rang)) continue;
    sinistresPris.add(rang);

    const source = eligibles[rang];
    const statut = tirerPondere(hasard, [
      { valeur: "declare", poids: 25 },
      { valeur: "transmis", poids: 25 },
      { valeur: "en_cours", poids: 15 },
      { valeur: "indemnise", poids: 25 },
      { valeur: "refuse", poids: 10 },
    ] as const);

    const montantEstime = tirerEntier(hasard, 200, 3500) * 100;

    valeursSinistres.push({
      reservationId: source.id,
      declareParId: source.proprietaireId,
      statut: statut as never,
      description: tirer(hasard, [
        "Choc arrière sur parking, hayon déformé.",
        "Pneu éclaté sur autoroute, jante endommagée.",
        "Vol de la roue de secours pendant la location.",
        "Timon tordu après une manœuvre en marche arrière.",
        "Bâche déchirée par le vent, arceaux pliés.",
        "Feux de signalisation arrachés, faisceau sectionné.",
      ]),
      devise: "EUR",
      montantEstime,
      montantIndemnise: statut === "indemnise" ? montantEstime : null,
      referenceAssureur: ["transmis", "en_cours", "indemnise", "refuse"].includes(statut)
        ? `AX-${2026}-${(4000 + index).toString()}`
        : null,
      transmisLe: statut === "declare" ? null : decalerJours(source.fin, 3),
      clotureLe: ["indemnise", "refuse"].includes(statut)
        ? decalerJours(source.fin, 30)
        : null,
      creeLe: decalerJours(source.fin, 1),
    });
  }

  if (valeursSinistres.length > 0) {
    await db.insert(sinistre).values(valeursSinistres);
  }

  /* --------------------------------------------------------------- Support -- */
  // Le demandeur est un vrai compte, et le ticket se rattache à une
  // réservation quand le sujet le suppose. Un ticket « caution non libérée »
  // sans location derrière serait un dossier qu'aucun agent ne pourrait
  // instruire.
  const valeursTickets = SUJETS_SUPPORT.slice(0, VOLUMES.tickets).map(
    (sujet, index) => {
      const source = eligibles[(index * 7) % eligibles.length];
      const statut = tirerPondere(hasard, [
        { valeur: "ouvert", poids: 35 },
        { valeur: "en_cours", poids: 25 },
        { valeur: "resolu", poids: 40 },
      ] as const);

      const ouvertLe = decalerJours(maintenant, -tirerEntier(hasard, 1, 60));

      return {
        reference: `SUP-${2026}-${(1000 + index).toString()}`,
        demandeurId: source.locataireId,
        reservationId: source.id,
        sujet,
        canal: tirerPondere(hasard, [
          { valeur: "formulaire", poids: 50 },
          { valeur: "courriel", poids: 35 },
          { valeur: "telephone", poids: 15 },
        ] as const) as never,
        priorite: tirerPondere(hasard, [
          { valeur: "normale", poids: 55 },
          { valeur: "haute", poids: 25 },
          { valeur: "basse", poids: 20 },
        ] as const) as never,
        statut: statut as never,
        // La première réponse est ce que mesure l'engagement de délai : elle
        // n'existe pas tant que le ticket n'a pas été pris en charge.
        premiereReponseLe:
          statut === "ouvert" ? null : decalerJours(ouvertLe, 1),
        resoluLe: statut === "resolu" ? decalerJours(ouvertLe, 3) : null,
        creeLe: ouvertLe,
      };
    },
  );

  // Les sujets se répètent au-delà de la liste : on ne fabrique pas de doublon
  // de référence, la contrainte d'unicité l'interdirait de toute façon.
  if (valeursTickets.length > 0) {
    await db.insert(ticketSupport).values(valeursTickets);
  }


  /* ------------------------------------------------------------- Finance -- */
  //
  // Paiement, caution et reversement sont trois mouvements distincts, et c'est
  // toute la difficulté du modèle : le locataire *paie* le total, la caution
  // est seulement *gelée* sur sa carte, et le propriétaire est *reversé* après
  // la restitution. Les confondre — ou n'en stocker qu'un — rendrait impossible
  // de répondre à « où est mon argent ? », qui est la question la plus posée au
  // support d'une place de marché.
  //
  // Ils naissent ensemble, à la réservation, et suivent ensuite des calendriers
  // propres.
  const litigesParReservation = new Map<string, string>();
  for (const entree of valeursLitiges) {
    if (entree.statut !== "resolu" && entree.statut !== "clos_sans_suite") {
      litigesParReservation.set(entree.reservationId, "litige");
    }
  }
  for (const entree of valeursSinistres) {
    if (["declare", "transmis", "en_cours"].includes(entree.statut as string)) {
      litigesParReservation.set(entree.reservationId, "sinistre");
    }
  }

  const valeursPaiements = [];
  const valeursCautions = [];
  const valeursReversements = [];

  for (const [index, ligne] of lignesReservations.entries()) {
    const source = contexte[index];
    const valeurs = valeursReservations[index];

    // Une demande non payée n'a produit aucun mouvement : ni empreinte, ni
    // débit. En fabriquer un ferait apparaître de l'argent là où il n'y en a
    // jamais eu.
    if (["demandee", "refusee", "expiree"].includes(source.statut)) continue;

    const annule = source.statut === "annulee";
    const termine = ["restituee", "cloturee"].includes(source.statut);
    const engage = ["payee", "confirmee", "en_cours"].includes(source.statut);

    /* ---- Paiement ---- */
    valeursPaiements.push({
      reservationId: ligne.id,
      statut: (annule ? "rembourse" : "capture") as never,
      devise: valeurs.devise,
      montant: valeurs.totalLocataire,
      montantRembourse: annule ? valeurs.totalLocataire : 0,
      moyenPaiement: MOYENS_PAIEMENT[index % MOYENS_PAIEMENT.length],
      autoriseLe: decalerJours(source.debut, -tirerEntier(hasard, 1, 20)),
      captureLe: annule ? null : decalerJours(source.debut, -1),
      creeLe: decalerJours(source.debut, -tirerEntier(hasard, 1, 20)),
    });

    /* ---- Caution ---- */
    //
    // La libération n'est pas immédiate : le pays fixe un délai après la
    // restitution — 72 heures pour la France — pendant lequel un dommage peut
    // encore être signalé. `liberation_prevue_le` porte cette date, et c'est
    // elle que l'écran du locataire affiche plutôt qu'un vague « bientôt ».
    const liberationPrevue = decalerJours(
      source.fin,
      Math.ceil(BAREME_PAR_DEFAUT.cautionLiberationHeures / 24),
    );
    const blocage = litigesParReservation.get(ligne.id);

    valeursCautions.push({
      reservationId: ligne.id,
      // Règle 6 : un litige ou un sinistre ouvert interdit la libération. La
      // caution reste donc constituée — elle n'est ni rendue ni débitée tant
      // que le dossier n'est pas tranché.
      statut: (blocage
        ? "contestee"
        : annule
          ? "liberee"
          : termine && liberationPrevue < maintenant
            ? "liberee"
            : "constituee") as never,
      devise: valeurs.devise,
      montant: valeurs.caution,
      montantDebite: 0,
      liberationPrevueLe: annule ? null : liberationPrevue,
      libereeLe:
        !blocage && (annule || (termine && liberationPrevue < maintenant))
          ? liberationPrevue
          : null,
      contesteeLe: blocage ? decalerJours(source.fin, 2) : null,
      creeLe: decalerJours(source.debut, -1),
    });

    /* ---- Reversement ---- */
    //
    // Rien n'est reversé tant que la location n'est pas terminée : verser
    // d'avance reviendrait à financer le propriétaire avec l'argent d'un
    // locataire qui n'a pas encore reçu le matériel.
    if (annule) continue;

    valeursReversements.push({
      reservationId: ligne.id,
      beneficiaireId: source.proprietaireId,
      // Règle 6, seconde moitié : un dossier ouvert gèle le transfert. Le
      // motif est écrit, sans quoi le propriétaire voit un versement bloqué
      // sans savoir pourquoi et appelle le support.
      statut: (blocage ? "gele" : termine ? "paye" : "planifie") as never,
      devise: valeurs.devise,
      montant: valeurs.montantReverse,
      commissionRetenue: valeurs.commissionProprietaire,
      geleMotif: blocage
        ? blocage === "litige"
          ? "Litige ouvert sur cette location"
          : "Sinistre déclaré sur cette location"
        : null,
      prevuLe: liberationPrevue,
      envoyeLe: !blocage && termine && liberationPrevue < maintenant ? liberationPrevue : null,
      creeLe: source.fin,
    });

    if (engage) {
      // Rien de plus : la branche existe pour rendre lisible le fait qu'une
      // location engagée mais non terminée a bien un reversement *planifié*.
    }
  }

  if (valeursPaiements.length > 0) await db.insert(paiement).values(valeursPaiements);
  if (valeursCautions.length > 0) await db.insert(caution).values(valeursCautions);
  if (valeursReversements.length > 0) {
    await db.insert(reversement).values(valeursReversements);
  }

  /* --------------------------------------------------------- Journal d'audit -- */
  // Chaque entrée porte l'identifiant de l'entité concernée. C'est ce qui
  // permet à la purge de reconnaître les entrées de démonstration sans toucher
  // aux autres — et, plus tard, de retrouver l'historique d'un dossier précis.
  const valeursAudit = [];

  for (let index = 0; index < VOLUMES.entreesAudit; index += 1) {
    const modele = ACTIONS_AUDIT[index % ACTIONS_AUDIT.length];
    const auteur = tirer(hasard, AUTEURS_ADMIN);

    valeursAudit.push({
      // L'adresse est figée au moment de l'action, même si le compte évolue
      // ensuite : c'est l'auteur d'alors qu'il faut pouvoir nommer.
      auteurEmail: auteur,
      action: modele.action,
      entite: modele.cible,
      entiteId: tirer(hasard, eligibles).id,
      motif: modele.motif,
      avant: modele.avant ? { valeur: modele.avant } : null,
      apres: modele.apres ? { valeur: modele.apres } : null,
      creeLe: decalerJours(maintenant, -tirerEntier(hasard, 0, 180)),
    });
  }

  if (valeursAudit.length > 0) {
    await db.insert(journalAudit).values(valeursAudit);
  }

  /* --------------------------------------------------- Accès de démonstration -- */
  //
  // Sans mot de passe, les comptes de démonstration ne servent à rien depuis
  // que les espaces exigent une session : on arriverait sur une page de
  // connexion qu'aucun identifiant n'ouvre, et les écrans peuplés seraient
  // devenus inaccessibles.
  //
  // Le mot de passe est le même pour tous, et il est écrit en clair juste
  // ici — c'est un jeu d'essai, pas un secret. La seule chose qui compte est
  // qu'aucun de ces comptes ne survive à la mise en production : ils portent
  // tous le domaine de démonstration, et la purge les emporte d'une requête.
  const empreinteDemo = await hacherMotDePasse(MOT_DE_PASSE_DEMO);

  const comptesAvecAcces = await db
    .select({ id: utilisateur.id, email: utilisateur.email })
    .from(utilisateur)
    .where(raw`${utilisateur.email} LIKE ${"%" + DOMAINE_DEMO}`);

  await db.insert(identifiant).values(
    comptesAvecAcces.map((compte) => ({
      utilisateurId: compte.id,
      fournisseur: "mot_de_passe",
      identifiantExterne: compte.email,
      empreinte: empreinteDemo,
    })),
  );

  // Un compte d'administration, sans lequel les treize écrans du back-office
  // seraient injoignables. Le rôle est le plus élevé : c'est un environnement
  // de démonstration, et restreindre ici ne protégerait rien.
  const [admin] = await db
    .insert(utilisateur)
    .values({
      email: `admin${DOMAINE_DEMO}`,
      emailVerifie: true,
      prenom: "Administration",
      nom: "Démonstration",
      typeCompte: "particulier",
      paysId: paysFrance.id,
      langue: "fr",
      profilLocataire: false,
      profilProprietaire: false,
      identiteStatut: "verifie",
      role: "super_administrateur",
    })
    .returning({ id: utilisateur.id });

  await db.insert(identifiant).values({
    utilisateurId: admin.id,
    fournisseur: "mot_de_passe",
    identifiantExterne: `admin${DOMAINE_DEMO}`,
    empreinte: empreinteDemo,
  });

  /* ------------------------------------------------------------- Rapport -- */
  const compter = async (table: string) => {
    const [{ n }] = await sql.unsafe<{ n: number }[]>(
      `SELECT count(*)::int AS n FROM ${table}`,
    );
    return n;
  };

  console.log("");
  console.log("Amorçage du graphe de démonstration :");
  console.log(`  pays          ${await compter("pays")}`);
  console.log(`  utilisateurs  ${await compter("utilisateur")}`);
  console.log(`  annonces      ${await compter("annonce")}`);
  console.log(`  photos        ${await compter("annonce_photo")}`);
  console.log(`  tarifs        ${await compter("tarif")}`);
  console.log(`  réservations  ${await compter("reservation")}`);
  console.log(`  avis          ${await compter("avis")}`);
  console.log(`  litiges       ${await compter("litige")}`);
  console.log(`  sinistres     ${await compter("sinistre")}`);
  console.log(`  tickets       ${await compter("ticket_support")}`);
  console.log(`  journal       ${await compter("journal_audit")}`);
  console.log(`  paiements     ${await compter("paiement")}`);
  console.log(`  cautions      ${await compter("caution")}`);
  console.log(`  reversements  ${await compter("reversement")}`);
  console.log("");
  console.log("Comptes de démonstration — mot de passe : " + MOT_DE_PASSE_DEMO);
  console.log(`  locataire             moi${DOMAINE_DEMO}`);
  console.log(`  administration        admin${DOMAINE_DEMO}`);

  // Le compte « moi » porte les deux profils mais ne possède aucune annonce :
  // son espace loueur est donc vide, ce qui est exact mais ne montre rien. On
  // nomme donc aussi le propriétaire le mieux fourni, pour que la
  // démonstration de l'espace loueur ait quelque chose à montrer.
  const [meilleurLoueur] = await sql<{ email: string; n: number }[]>`
    SELECT u.email, count(*)::int n
    FROM reservation r
    JOIN utilisateur u ON u.id = r.proprietaire_id
    WHERE u.email LIKE ${"%" + DOMAINE_DEMO}
    GROUP BY u.email ORDER BY n DESC LIMIT 1
  `;
  if (meilleurLoueur) {
    console.log(
      `  loueur                ${meilleurLoueur.email}  (${meilleurLoueur.n} locations)`,
    );
  }
}

amorcer()
  .catch((erreur) => {
    console.error("Échec de l'amorçage :", erreur);
    process.exitCode = 1;
  })
  .finally(() => sql.end());
