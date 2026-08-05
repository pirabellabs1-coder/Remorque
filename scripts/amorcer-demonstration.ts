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
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { BAREME_PAR_DEFAUT } from "../src/config/baremes";
import { chargerEnv } from "../src/config/charger-env";
import { MARKETS } from "../src/config/markets";
import { PAYS, trouverVille } from "../src/config/villes";
import { JEU_DE_DEMONSTRATION } from "../src/server/annonces/catalogue";
import {
  ANNUAIRE,
  aujourdhui,
  AVIS_LOCATAIRES,
  decalerJours,
  generateur,
  GRAINES,
  REPARTITION_LOUEUR,
  tirer,
  tirerEntier,
  tirerPondere,
  VOLUMES,
} from "../src/server/donnees-demo";
import {
  annonce,
  annoncePhoto,
  avis,
  categorie,
  pays,
  reservation,
  tarif,
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

  const valeursLocataires = ANNUAIRE.map((personne) => ({
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
  const contexte: { statut: string; fin: Date; annonceId: string; locataireId: string; proprietaireId: string }[] = [];

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
   */
  const [compteDemo] = await db
    .insert(utilisateur)
    .values({
      email: `moi${DOMAINE_DEMO}`,
      emailVerifie: true,
      prenom: "Élodie",
      nom: "Vasseur",
      typeCompte: "particulier",
      paysId: paysFrance.id,
      langue: "fr",
      profilLocataire: true,
      profilProprietaire: true,
      identiteStatut: "verifie",
      identiteVerifieeLe: decalerJours(maintenant, -500),
      creeLe: decalerJours(maintenant, -730),
    })
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
}

amorcer()
  .catch((erreur) => {
    console.error("Échec de l'amorçage :", erreur);
    process.exitCode = 1;
  })
  .finally(() => sql.end());
