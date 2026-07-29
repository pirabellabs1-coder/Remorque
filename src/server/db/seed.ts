/**
 * Amorçage de la base : pays de lancement et catalogue des catégories.
 *
 * Idempotent — le script peut être relancé sans dupliquer les données.
 * Exécution : `npm run db:seed`.
 */
import { db, sql } from "./index";
import { categorie, pays } from "./schema";

const PAYS_DE_LANCEMENT = {
  code: "FR",
  nom: "France",
  marche: "fr-FR",
  langue: "fr",
  devise: "EUR",
  actif: true,
  // Barèmes indicatifs de la section 02, à arbitrer lors de l'atelier de
  // cadrage (décision n° 03) et modifiables ensuite depuis l'administration.
  commissionLocataireBp: 1200,
  commissionProprietaireBp: 800,
  tvaCommissionBp: 2000,
  cautionMinimum: 20_000,
  cautionMaximum: 150_000,
  cautionLiberationHeures: 72,
} as const;

/** Section 4.1 — une page par catégorie, optimisée pour la recherche. */
const CATEGORIES = [
  { slug: "remorque-benne", nom: "Remorque benne", releveKilometrique: false },
  { slug: "remorque-plateau", nom: "Remorque plateau", releveKilometrique: false },
  { slug: "porte-voiture", nom: "Porte-voiture", releveKilometrique: false },
  { slug: "remorque-bagagere", nom: "Remorque bagagère", releveKilometrique: false },
  { slug: "van-a-chevaux", nom: "Van à chevaux", releveKilometrique: false },
  { slug: "porte-bateau", nom: "Porte-bateau", releveKilometrique: false },
  { slug: "porte-moto", nom: "Porte-moto", releveKilometrique: false },
  {
    slug: "remorque-frigorifique",
    nom: "Remorque frigorifique",
    releveKilometrique: false,
  },
  {
    slug: "nacelle-et-materiel-chantier",
    nom: "Nacelle et matériel de chantier",
    releveKilometrique: true,
  },
  { slug: "utilitaire", nom: "Utilitaire", releveKilometrique: true },
] as const;

async function seed() {
  await db
    .insert(pays)
    .values(PAYS_DE_LANCEMENT)
    .onConflictDoNothing({ target: pays.code });

  await db
    .insert(categorie)
    .values(
      CATEGORIES.map((entree, index) => ({ ...entree, ordre: index })),
    )
    .onConflictDoNothing({ target: categorie.slug });

  console.log(
    `Amorçage terminé : 1 pays, ${CATEGORIES.length} catégories.`,
  );
}

seed()
  .catch((erreur) => {
    console.error("Échec de l'amorçage :", erreur);
    process.exitCode = 1;
  })
  .finally(() => sql.end());
