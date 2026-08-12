import postgres from "postgres";

/**
 * Attribue un rôle interne à un compte.
 *
 *     npm run db:promouvoir -- une@adresse                        # super_administrateur
 *     npm run db:promouvoir -- une@adresse moderateur
 *     npm run db:promouvoir -- une@adresse aucun                  # retire le rôle
 *
 * **Pourquoi un script et non un `UPDATE` à la main.** Le rôle interne ouvre
 * l'administration : la file de vérification des identités, les remboursements,
 * le débit des cautions, la suspension des comptes. C'est le privilège le plus
 * fort de la plateforme, et « qui l'a accordé, à qui, et quand » est exactement
 * la question à laquelle `journal_audit` existe pour répondre. Une commande SQL
 * tapée dans un terminal ne laisse aucune trace ; celle-ci en laisse une, avec
 * l'état avant et après.
 *
 * L'auteur consigné est le script lui-même, faute de session : c'est moins
 * précis qu'un nom, et bien plus honnête qu'un nom inventé. La trace dit ce
 * qu'elle sait — une promotion faite depuis la ligne de commande, hors de
 * l'application.
 *
 * Aucune promotion par lot : une adresse à la fois, écrite en toutes lettres.
 * Un caractère générique qui promeut trois comptes par accident ne se rattrape
 * pas — les trois sont déjà administrateurs.
 */

const ROLES = [
  "agent_support",
  "moderateur",
  "gestionnaire_financier",
  "super_administrateur",
] as const;

const cible = process.argv[2]?.trim().toLowerCase();
const role = (process.argv[3] ?? "super_administrateur").trim();

if (!cible || !cible.includes("@")) {
  console.error(
    "Adresse électronique attendue.\n" +
      "  npm run db:promouvoir -- une@adresse [role]\n" +
      `  rôles : ${ROLES.join(", ")}, aucun`,
  );
  process.exit(1);
}

if (role !== "aucun" && !(ROLES as readonly string[]).includes(role)) {
  console.error(`Rôle inconnu : ${role}\n  rôles : ${ROLES.join(", ")}, aucun`);
  process.exit(1);
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL manquante. Renseignez .env.local.");
  process.exit(1);
}

const sql = postgres(url, { prepare: false });

async function principal() {
  const [avant] = await sql`
    select id, email, role from utilisateur where lower(email) = ${cible}`;

  if (!avant) {
    console.error(`Aucun compte à l'adresse ${cible}.`);
    process.exit(1);
  }

  const nouveau = role === "aucun" ? null : role;

  if (avant.role === nouveau) {
    console.log(`${avant.email} porte déjà ce rôle. Rien à faire.`);
    return;
  }

  await sql.begin(async (tx) => {
    await tx`update utilisateur set role = ${nouveau} where id = ${avant.id}`;

    await tx`
      insert into journal_audit (auteur_email, action, entite, entite_id, motif, avant, apres)
      values (
        'script:db:promouvoir',
        ${nouveau ? "role_attribue" : "role_retire"},
        'utilisateur',
        ${avant.id},
        'Attribution depuis la ligne de commande, hors application.',
        ${sql.json({ role: avant.role })},
        ${sql.json({ role: nouveau })}
      )`;
  });

  console.log(`${avant.email} : ${avant.role ?? "aucun"} → ${nouveau ?? "aucun"}`);
  console.log("Trace écrite au journal d'audit.");
}

principal()
  .catch((erreur) => {
    console.error(erreur);
    process.exitCode = 1;
  })
  .finally(() => sql.end());
