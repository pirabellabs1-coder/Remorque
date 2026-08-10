/**
 * Amorçage de la vitrine française, sur un compte réel.
 *
 * `npm run db:demo` peuple la Belgique avec des comptes
 * `@demonstration.flexitrailer.eu`. Le marché français, lui, reste vide : le
 * cloisonnement par pays (`src/server/annonces/marche.ts`) écarte à juste titre
 * les annonces belges, et un visiteur français arrive donc sur une recherche
 * sans résultat.
 *
 * Ce script comble ce trou en rattachant un catalogue français à un compte
 * propriétaire **existant**, celui qui vient d'être créé sur le site. C'est ce
 * qui permet de parcourir l'espace loueur avec ses propres annonces, ses
 * revenus et son calendrier, plutôt que de regarder ceux d'un compte fictif.
 *
 *     npm run db:vitrine -- gildaslissanon0@gmail.com
 *
 * Rejouable : une annonce dont le couple ville/adresse existe déjà est laissée
 * telle quelle. Rien n'est supprimé — ce script n'efface jamais, contrairement
 * à l'amorçage de démonstration qui purge son propre domaine.
 */

import { and, eq } from "drizzle-orm";

import { CATEGORIES } from "../src/config/categories";
import { trouverVille } from "../src/config/villes";
import { db } from "../src/server/db";
import {
  annonce as tableAnnonce,
  annoncePhoto,
  categorie as tableCategorie,
  pays as tablePays,
  tarif,
  utilisateur,
} from "../src/server/db/schema";

/** Le catalogue français d'ouverture, une annonce par grande ville. */
const CATALOGUE = [
  {
    titre: "Benne basculante 750 kg",
    categorie: "remorque-benne",
    villeSlug: "paris",
    adresse: "18 rue de l'Ourcq",
    codePostal: "75019",
    description:
      "Benne récente à bascule manuelle, parfaite pour évacuer gravats, terre et déchets verts. Bâche, filet et sangles fournis. Prise en main expliquée au départ.",
    ptacKg: 750,
    poidsVideKg: 250,
    longueurUtileMm: 2050,
    largeurUtileMm: 1300,
    hauteurUtileMm: 400,
    nombreEssieux: 1,
    freinee: false,
    prixJour: 3500,
    caution: 40000,
    equipements: ["Bâche", "Filet", "Sangles", "Roue de secours"],
    instantanee: true,
  },
  {
    titre: "Plateau 2 essieux 1 300 kg",
    categorie: "remorque-plateau",
    villeSlug: "lyon",
    adresse: "9 rue Saint-Nestor",
    codePostal: "69008",
    description:
      "Grand plateau à ridelles basses pour matériaux longs, palettes et mobilier volumineux. Freinée, stable à vide comme en charge, avec rampes de chargement.",
    ptacKg: 1300,
    poidsVideKg: 300,
    longueurUtileMm: 3000,
    largeurUtileMm: 1500,
    hauteurUtileMm: 350,
    nombreEssieux: 2,
    freinee: true,
    prixJour: 4200,
    caution: 60000,
    equipements: ["Rampes de chargement", "Sangles", "Roue de secours"],
    instantanee: true,
  },
  {
    titre: "Porte-voiture basculant",
    categorie: "porte-voiture",
    villeSlug: "marseille",
    adresse: "24 boulevard de Plombières",
    codePostal: "13003",
    description:
      "Porte-voiture à plateau basculant, treuil manuel inclus. Convient aux citadines comme aux berlines. Idéal pour un véhicule en panne ou un transfert de voiture de collection.",
    ptacKg: 2700,
    poidsVideKg: 600,
    longueurUtileMm: 4200,
    largeurUtileMm: 2000,
    hauteurUtileMm: null,
    nombreEssieux: 2,
    freinee: true,
    prixJour: 6900,
    caution: 90000,
    equipements: ["Treuil manuel", "Sangles à cliquet", "Cales de roue"],
    instantanee: false,
  },
  {
    titre: "Bagagère fermée 500 kg",
    categorie: "remorque-bagagere",
    villeSlug: "bordeaux",
    adresse: "31 rue Bouquière",
    codePostal: "33000",
    description:
      "Remorque fermée à clé, contenu à l'abri de la pluie et des regards. Déménagement d'étudiant, brocante, matériel de sonorisation. Facile à manœuvrer seul.",
    ptacKg: 500,
    poidsVideKg: 180,
    longueurUtileMm: 2000,
    largeurUtileMm: 1200,
    hauteurUtileMm: 1100,
    nombreEssieux: 1,
    freinee: false,
    prixJour: 2400,
    caution: 30000,
    equipements: ["Fermeture à clé", "Éclairage intérieur", "Sangles"],
    instantanee: true,
  },
  {
    titre: "Van 2 places",
    categorie: "van-a-chevaux",
    villeSlug: "nantes",
    adresse: "7 route de Vertou",
    codePostal: "44200",
    description:
      "Van deux places entretenu chaque année, pont antidérapant et barres de poitrail réglables. Attention au permis : ce van dépasse 750 kg à vide.",
    ptacKg: 2000,
    poidsVideKg: 850,
    longueurUtileMm: 3000,
    largeurUtileMm: 1600,
    hauteurUtileMm: 2300,
    nombreEssieux: 2,
    freinee: true,
    prixJour: 8500,
    caution: 120000,
    equipements: ["Barres de poitrail", "Tapis antidérapant", "Roue de secours"],
    instantanee: false,
  },
  {
    titre: "Porte-bateau 6 m",
    categorie: "porte-bateau",
    villeSlug: "montpellier",
    adresse: "12 avenue du Pont Juvénal",
    codePostal: "34000",
    description:
      "Remorque de mise à l'eau pour coque jusqu'à six mètres, rouleaux réglables et treuil à sangle. Révisée avant chaque saison, roulements graissés.",
    ptacKg: 1500,
    poidsVideKg: 350,
    longueurUtileMm: 6000,
    largeurUtileMm: 2100,
    hauteurUtileMm: null,
    nombreEssieux: 1,
    freinee: true,
    prixJour: 5500,
    caution: 80000,
    equipements: ["Treuil à sangle", "Rouleaux réglables", "Sangles"],
    instantanee: false,
  },
  {
    titre: "Porte-moto 1 place",
    categorie: "porte-moto",
    villeSlug: "lille",
    adresse: "5 rue de Wazemmes",
    codePostal: "59000",
    description:
      "Porte-moto léger avec rail central et rampe d'accès. Sangles à cliquet fournies. Tractable avec un simple permis B, se manœuvre à la main une fois dételé.",
    ptacKg: 500,
    poidsVideKg: 150,
    longueurUtileMm: 2400,
    largeurUtileMm: 1200,
    hauteurUtileMm: null,
    nombreEssieux: 1,
    freinee: false,
    prixJour: 2900,
    caution: 35000,
    equipements: ["Rampe d'accès", "Rail central", "Sangles à cliquet"],
    instantanee: true,
  },
  {
    titre: "Frigorifique 750 kg",
    categorie: "remorque-frigorifique",
    villeSlug: "toulouse",
    adresse: "40 avenue de Lyon",
    codePostal: "31500",
    description:
      "Remorque réfrigérée de 0 à 8 °C, groupe silencieux sur prise 230 V. Mariage, traiteur, marché : la chaîne du froid tient toute la journée sans surveillance.",
    ptacKg: 750,
    poidsVideKg: 400,
    longueurUtileMm: 2000,
    largeurUtileMm: 1300,
    hauteurUtileMm: 1600,
    nombreEssieux: 1,
    freinee: false,
    prixJour: 9500,
    caution: 100000,
    equipements: ["Groupe froid 230 V", "Étagères", "Thermomètre"],
    instantanee: false,
  },
  {
    titre: "Utilitaire 20 m³ avec hayon",
    categorie: "utilitaire",
    villeSlug: "rennes",
    adresse: "16 boulevard de Verdun",
    codePostal: "35000",
    description:
      "Fourgon 20 m³ avec hayon élévateur, idéal pour un déménagement complet. Diable, couvertures et sangles fournis. Permis B suffisant.",
    ptacKg: 3500,
    poidsVideKg: 1900,
    longueurUtileMm: 4300,
    largeurUtileMm: 2000,
    hauteurUtileMm: 2300,
    nombreEssieux: 2,
    freinee: true,
    prixJour: 11000,
    caution: 150000,
    equipements: ["Hayon élévateur", "Diable", "Couvertures", "Sangles"],
    instantanee: true,
  },
  {
    titre: "Nacelle sur remorque 12 m",
    categorie: "nacelle-et-materiel-chantier",
    villeSlug: "strasbourg",
    adresse: "3 rue de la Papeterie",
    codePostal: "67000",
    description:
      "Nacelle tractable douze mètres, stabilisateurs manuels et panier deux personnes. Élagage, façade, gouttières. Notice de sécurité remise au départ.",
    ptacKg: 1300,
    poidsVideKg: 900,
    longueurUtileMm: 4500,
    largeurUtileMm: 1800,
    hauteurUtileMm: null,
    nombreEssieux: 1,
    freinee: true,
    prixJour: 14000,
    caution: 150000,
    equipements: ["Stabilisateurs", "Panier 2 personnes", "Notice de sécurité"],
    instantanee: false,
  },
] as const;

function slugifier(valeur: string): string {
  return valeur
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function main(): Promise<void> {
  const email = process.argv[2]?.trim().toLowerCase();

  if (!email) {
    console.error(
      "Adresse électronique du propriétaire attendue.\n" +
        "  npm run db:vitrine -- personne@exemple.fr",
    );
    process.exit(1);
  }

  const [compte] = await db
    .select({
      id: utilisateur.id,
      prenom: utilisateur.prenom,
      profilProprietaire: utilisateur.profilProprietaire,
    })
    .from(utilisateur)
    .where(eq(utilisateur.email, email))
    .limit(1);

  if (!compte) {
    console.error(
      `Aucun compte pour « ${email} ». Créez-le sur le site, puis relancez.`,
    );
    process.exit(1);
  }

  // Le profil propriétaire est activé au besoin : sans lui, la garde d'accès
  // renvoie le compte vers l'espace locataire et ses propres annonces lui
  // restent invisibles.
  if (!compte.profilProprietaire) {
    await db
      .update(utilisateur)
      .set({ profilProprietaire: true })
      .where(eq(utilisateur.id, compte.id));
    console.log("Profil propriétaire activé sur le compte.");
  }

  const paysParCode = new Map(
    (await db.select().from(tablePays)).map((ligne) => [ligne.code, ligne]),
  );
  const categorieParSlug = new Map(
    (await db.select().from(tableCategorie)).map((ligne) => [ligne.slug, ligne]),
  );

  let creees = 0;
  let ignorees = 0;

  for (const entree of CATALOGUE) {
    const ville = trouverVille(entree.villeSlug);
    if (!ville) throw new Error(`Ville inconnue : ${entree.villeSlug}`);

    const paysLigne = paysParCode.get(ville.pays);
    if (!paysLigne) {
      throw new Error(
        `Pays absent de la base : ${ville.pays}. Lancez « npm run db:seed ».`,
      );
    }

    const categorieLigne = categorieParSlug.get(entree.categorie);
    if (!categorieLigne) {
      throw new Error(
        `Catégorie absente de la base : ${entree.categorie}. Lancez « npm run db:seed ».`,
      );
    }

    const slug = slugifier(entree.titre);

    // L'unicité porte sur le couple ville/adresse — index `annonce_slug_unique`.
    // Une benne parisienne et une benne bruxelloise portent légitimement le
    // même titre, donc la même adresse dans leur ville respective.
    const [existante] = await db
      .select({ id: tableAnnonce.id })
      .from(tableAnnonce)
      .where(
        and(
          eq(tableAnnonce.villeSlug, ville.slug),
          eq(tableAnnonce.slug, slug),
        ),
      )
      .limit(1);

    if (existante) {
      ignorees += 1;
      continue;
    }

    const photo = CATEGORIES.find(
      (categorie) => categorie.slug === entree.categorie,
    )!.photo;

    const [creee] = await db
      .insert(tableAnnonce)
      .values({
        proprietaireId: compte.id,
        categorieId: categorieLigne.id,
        paysId: paysLigne.id,
        titre: entree.titre,
        description: entree.description,
        slug,
        statut: "publiee",
        etapePublication: 6,
        ptacKg: entree.ptacKg,
        poidsVideKg: entree.poidsVideKg,
        chargeUtileKg: entree.ptacKg - entree.poidsVideKg,
        longueurUtileMm: entree.longueurUtileMm,
        largeurUtileMm: entree.largeurUtileMm,
        hauteurUtileMm: entree.hauteurUtileMm,
        nombreEssieux: entree.nombreEssieux,
        freinee: entree.freinee,
        typeAttelage: "Boule Ø 50 mm",
        faisceauBroches: 13,
        equipements: [...entree.equipements],
        caracteristiques: { quartier: ville.province },
        adresseLigne1: entree.adresse,
        codePostal: entree.codePostal,
        ville: ville.nom,
        villeSlug: ville.slug,
        position: { longitude: ville.longitude, latitude: ville.latitude },
        reservationInstantanee: entree.instantanee,
        politiqueAnnulation: "moderee",
        devise: paysLigne.devise,
        caution: entree.caution,
        publieeLe: new Date(),
      })
      .returning({ id: tableAnnonce.id });

    await db.insert(annoncePhoto).values({
      annonceId: creee.id,
      url: photo,
      ordre: 0,
    });

    await db.insert(tarif).values({
      annonceId: creee.id,
      prixJour: entree.prixJour,
    });

    creees += 1;
    console.log(`  + ${entree.titre} — ${ville.nom}`);
  }

  console.log(
    `\n${creees} annonce(s) créée(s), ${ignorees} déjà présente(s), ` +
      `sur le compte de ${compte.prenom ?? email}.`,
  );

  process.exit(0);
}

main().catch((erreur) => {
  console.error(erreur);
  process.exit(1);
});
