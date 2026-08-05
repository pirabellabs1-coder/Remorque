/**
 * Diagnostic de la connexion à la base.
 *
 * À exécuter avant toute migration : `npm run db:verifier`.
 *
 * Pourquoi un script dédié plutôt que de laisser `db:migrate` échouer : les
 * erreurs de PostgreSQL et de drizzle-kit sont exactes mais illisibles pour
 * qui découvre Supabase. « SASL: SCRAM-SERVER-FIRST-MESSAGE » ne dit pas que
 * le mot de passe contient un caractère non encodé ; « prepared statement
 * already exists » ne dit pas qu'on a donné l'adresse du gestionnaire de
 * connexions là où il fallait la connexion directe. Chaque vérification ci-
 * dessous traduit une panne courante en une phrase et un geste.
 *
 * Le script ne modifie rien. Il peut être relancé autant de fois que voulu.
 */
import postgres from "postgres";

import { chargerEnv } from "../src/config/charger-env";

chargerEnv();

type Etat = "ok" | "avertissement" | "echec";

const resultats: { etat: Etat; titre: string; detail: string }[] = [];

function noter(etat: Etat, titre: string, detail: string) {
  resultats.push({ etat, titre, detail });
}

/**
 * Régions européennes de Supabase.
 *
 * La section 11 du cadrage impose que les données personnelles restent dans
 * l'Union. C'est vérifié ici parce que la région d'un projet Supabase **ne se
 * change pas** : s'en apercevoir après la mise en production oblige à recréer
 * le projet et à migrer les données. Autant le voir à la première commande.
 */
const REGIONS_UE = [
  "eu-central-1",
  "eu-central-2",
  "eu-west-1",
  "eu-west-2",
  "eu-west-3",
  "eu-north-1",
];

function verifierAdresse(nom: string, url: string | undefined, portAttendu: number) {
  if (!url) {
    noter("echec", nom, `Variable absente. Voir « .env.example » et copier ce fichier en « .env.local ».`);
    return null;
  }

  let analysee: URL;
  try {
    analysee = new URL(url);
  } catch {
    noter("echec", nom, "Adresse illisible. Elle doit commencer par « postgresql:// ».");
    return null;
  }

  // Le mot de passe est très souvent la cause du premier échec : Supabase en
  // engendre qui contiennent `@`, `#` ou `?`, lesquels coupent l'analyse de
  // l'adresse s'ils ne sont pas encodés.
  const brut = url.slice(url.indexOf("://") + 3, url.lastIndexOf("@"));
  if (/[@#?]/.test(brut.slice(brut.indexOf(":") + 1))) {
    noter(
      "echec",
      nom,
      "Le mot de passe contient un caractère spécial non encodé (@, # ou ?). " +
        "Encodez-le, ou réengendrez un mot de passe sans ces caractères depuis Supabase.",
    );
    return null;
  }

  const port = Number(analysee.port);
  if (port !== portAttendu) {
    noter(
      "avertissement",
      nom,
      `Port ${port || "absent"} au lieu de ${portAttendu}. ` +
        (portAttendu === 6543
          ? "L'application doit passer par le gestionnaire de connexions (6543)."
          : "Les migrations exigent la connexion directe (5432) : le gestionnaire " +
            "de connexions travaille en mode transaction et refuse les instructions " +
            "de définition de schéma."),
    );
  }

  const region = REGIONS_UE.find((candidate) => analysee.hostname.includes(candidate));
  if (analysee.hostname.includes("supabase") && !region) {
    noter(
      "echec",
      `${nom} — région`,
      "Le projet n'est pas hébergé dans l'Union européenne. La section 11 du " +
        "cadrage l'impose, et la région d'un projet Supabase ne se change pas : " +
        "recréez le projet en choisissant Frankfurt (eu-central-1) ou Paris (eu-west-3).",
    );
    return null;
  }

  if (region) noter("ok", `${nom} — région`, `${region}, dans l'Union européenne.`);

  return analysee;
}

async function verifierConnexion(nom: string, url: string, attendPostgis: boolean) {
  const sql = postgres(url, { max: 1, prepare: false, connect_timeout: 15 });

  try {
    const [{ version }] = await sql<{ version: string }[]>`SELECT version()`;
    noter("ok", `${nom} — connexion`, version.split(" ").slice(0, 2).join(" "));

    if (attendPostgis) {
      const extensions = await sql<{ extname: string }[]>`
        SELECT extname FROM pg_extension WHERE extname IN ('postgis', 'pg_trgm', 'unaccent')
      `;
      const presentes = new Set(extensions.map((ligne) => ligne.extname));

      for (const requise of ["postgis", "pg_trgm", "unaccent"]) {
        if (presentes.has(requise)) {
          noter("ok", `Extension ${requise}`, "installée.");
        } else {
          noter(
            "avertissement",
            `Extension ${requise}`,
            "absente — elle sera installée par « npm run db:prepare ».",
          );
        }
      }

      // État des migrations : distinguer « base vierge » de « base à jour »
      // évite de relancer une migration déjà passée, ou de croire le socle en
      // place alors qu'aucune table n'existe.
      const [{ nombre }] = await sql<{ nombre: number }[]>`
        SELECT count(*)::int AS nombre
        FROM information_schema.tables
        WHERE table_schema = 'public'
      `;
      noter(
        nombre === 0 ? "avertissement" : "ok",
        "Tables publiques",
        nombre === 0
          ? "aucune — la migration n'a pas encore été appliquée. Lancez « npm run db:setup »."
          : `${nombre} présentes.`,
      );
    }
  } catch (erreur) {
    const message = erreur instanceof Error ? erreur.message : String(erreur);

    // Traduction des pannes les plus fréquentes.
    let explication = message;
    if (/SASL|password authentication/i.test(message)) {
      explication =
        "Mot de passe refusé. Réinitialisez-le dans Supabase, sous « Settings » → " +
        "« Database » → « Reset database password », puis recopiez l'adresse complète.";
    } else if (/ENOTFOUND|EAI_AGAIN/i.test(message)) {
      explication =
        "Hôte introuvable. Vérifiez la référence du projet dans l'adresse, ou que " +
        "le projet n'est pas en pause (Supabase suspend les projets gratuits inactifs).";
    } else if (/ETIMEDOUT|ECONNREFUSED/i.test(message)) {
      explication =
        "Connexion refusée ou expirée. Le projet est peut-être en pause, ou un " +
        "pare-feu bloque le port.";
    }

    noter("echec", `${nom} — connexion`, explication);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

async function verifier() {
  const applicative = verifierAdresse("DATABASE_URL", process.env.DATABASE_URL, 6543);
  const directe = verifierAdresse(
    "DATABASE_URL_DIRECT",
    process.env.DATABASE_URL_DIRECT,
    5432,
  );

  if (applicative) {
    await verifierConnexion("DATABASE_URL", process.env.DATABASE_URL!, false);
  }
  if (directe) {
    await verifierConnexion(
      "DATABASE_URL_DIRECT",
      process.env.DATABASE_URL_DIRECT!,
      true,
    );
  }

  // Les autres secrets ne bloquent pas la base, mais autant les signaler
  // maintenant plutôt qu'à la première page protégée.
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret || secret.length < 32) {
    noter(
      "avertissement",
      "BETTER_AUTH_SECRET",
      "absent ou trop court. Engendrez-en un : openssl rand -base64 32",
    );
  } else {
    noter("ok", "BETTER_AUTH_SECRET", "présent.");
  }

  /* ---- Restitution ---- */
  const SIGNES: Record<Etat, string> = {
    ok: "  OK  ",
    avertissement: " ⚠ À VOIR ",
    echec: " ✗ ÉCHEC ",
  };

  console.log("");
  for (const resultat of resultats) {
    console.log(`${SIGNES[resultat.etat]} ${resultat.titre}`);
    console.log(`         ${resultat.detail}`);
  }

  const echecs = resultats.filter((resultat) => resultat.etat === "echec").length;
  const avertissements = resultats.filter(
    (resultat) => resultat.etat === "avertissement",
  ).length;

  console.log("");
  if (echecs > 0) {
    console.log(
      `${echecs} point${echecs > 1 ? "s" : ""} bloquant${echecs > 1 ? "s" : ""}. ` +
        "Corrigez-les avant « npm run db:setup ».",
    );
    process.exitCode = 1;
  } else if (avertissements > 0) {
    console.log(
      `Connexion établie, ${avertissements} point${avertissements > 1 ? "s" : ""} à traiter. ` +
        "« npm run db:setup » s'en chargera pour les extensions et les migrations.",
    );
  } else {
    console.log("Tout est en ordre.");
  }
}

verifier().catch((erreur) => {
  console.error("Le diagnostic lui-même a échoué :", erreur);
  process.exitCode = 1;
});
