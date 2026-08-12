import postgres from "postgres";

/**
 * Pose une vérification sur un compte, à la main.
 *
 * Les deux portes — publier, réserver — lisent désormais `identite_statut` et
 * `permis_statut`. Les comptes créés avant elles n'ont ni l'un ni l'autre :
 * sans ce script, la base de démonstration montre un catalogue que personne
 * ne peut louer, et le compte de l'exploitant ne peut plus rien publier.
 *
 *     npm run db:habiliter                 # tous les comptes de démonstration
 *     npm run db:habiliter -- une@adresse  # un compte nommé
 *
 * **Sans adresse, seuls les comptes de démonstration sont touchés.** Poser une
 * vérification sur un compte réel, c'est affirmer qu'un contrôleur a vu une
 * pièce d'identité. Le faire par lot sur toute la base serait une fausse
 * déclaration, et elle serait invisible : le journal d'audit ne dirait rien,
 * puisque personne n'aurait cliqué. Une adresse explicite est donc exigée pour
 * tout ce qui n'est pas de la démonstration — l'exploitant sait alors ce qu'il
 * affirme, et sur qui.
 */

const DOMAINE_DEMO = "@demonstration.flexitrailer.eu";

const cible = process.argv[2]?.trim().toLowerCase();

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL manquante. Renseignez .env.local.");
  process.exit(1);
}

const sql = postgres(url, { prepare: false });

/** Dix ans : une date lointaine mais bornée, pour ne pas créer d'éternité. */
const expiration = new Date();
expiration.setFullYear(expiration.getFullYear() + 10);

async function principal() {
  const lignes = cible
    ? await sql`
        update utilisateur
           set email_verifie = true,
               identite_statut = 'verifie',
               identite_verifiee_le = coalesce(identite_verifiee_le, now()),
               permis_statut = 'verifie',
               permis_categories = '["B","BE"]'::jsonb,
               permis_expire_le = ${expiration}
         where lower(email) = ${cible}
        returning email`
    : await sql`
        update utilisateur
           set email_verifie = true,
               identite_statut = 'verifie',
               identite_verifiee_le = coalesce(identite_verifiee_le, now()),
               permis_statut = 'verifie',
               permis_categories = '["B","BE"]'::jsonb,
               permis_expire_le = ${expiration}
         where email like ${"%" + DOMAINE_DEMO}
        returning email`;

  if (lignes.length === 0) {
    console.error(
      cible
        ? `Aucun compte à l'adresse ${cible}.`
        : "Aucun compte de démonstration en base.",
    );
    process.exit(1);
  }

  console.log(`${lignes.length} compte(s) habilité(s).`);
  if (cible) console.log(`  → ${lignes[0].email}`);
}

principal()
  .catch((erreur) => {
    console.error(erreur);
    process.exitCode = 1;
  })
  .finally(() => sql.end());
