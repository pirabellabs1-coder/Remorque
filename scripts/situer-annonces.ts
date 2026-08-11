import postgres from "postgres";

/**
 * Place les annonces existantes à leur vraie adresse.
 *
 * Toutes les annonces créées avant l'épingle de l'assistant portent le centre
 * de leur commune : elles se superposent sur la carte, la recherche par
 * distance se trompe de plusieurs kilomètres, et le cercle d'imprécision de
 * 800 mètres ne recouvre pas le bien. Ce script rattrape ce passé en
 * géocodant l'adresse déjà saisie.
 *
 *     npm run db:situer
 *
 * Rejouable et prudent : une annonce sans adresse est laissée où elle est, et
 * un résultat de géocodage à plus de trente kilomètres de sa commune est
 * refusé — c'est le signe que le service a compris autre chose, et une
 * remorque déplacée à tort serait pire qu'une remorque approximative.
 */

const CLE = new URL(
  process.env.NEXT_PUBLIC_MAP_STYLE_URL ?? "https://exemple.invalid",
).searchParams.get("key");

/** Distance en kilomètres entre deux points, formule de Haversine. */
function distanceKm(
  a: { lon: number; lat: number },
  b: { lon: number; lat: number },
): number {
  const rad = (degres: number) => (degres * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

async function main(): Promise<void> {
  if (!CLE) {
    console.error(
      "NEXT_PUBLIC_MAP_STYLE_URL absente ou sans clé : rien à géocoder.",
    );
    process.exit(1);
  }

  const sql = postgres(process.env.DATABASE_URL as string, { prepare: false });

  const annonces = await sql<
    {
      id: string;
      titre: string;
      adresse: string | null;
      codePostal: string | null;
      ville: string;
      lon: number;
      lat: number;
    }[]
  >`
    select id, titre, adresse_ligne1 as adresse, code_postal as "codePostal",
           ville,
           st_x(position::geometry) as lon,
           st_y(position::geometry) as lat
    from annonce
    where statut <> 'brouillon' and adresse_ligne1 is not null
    order by ville`;

  let places = 0;
  let ignorees = 0;

  for (const annonce of annonces) {
    const requete = [annonce.adresse, annonce.codePostal, annonce.ville]
      .filter(Boolean)
      .join(", ");

    const reponse = await fetch(
      `https://api.maptiler.com/geocoding/${encodeURIComponent(requete)}.json?key=${CLE}&limit=1`,
    );
    const resultat = (await reponse.json()) as {
      features?: { center?: [number, number] }[];
    };
    const centre = resultat.features?.[0]?.center;

    if (!Array.isArray(centre)) {
      console.log(`  ? ${annonce.titre} — adresse non reconnue`);
      ignorees += 1;
      continue;
    }

    const ecart = distanceKm(
      { lon: annonce.lon, lat: annonce.lat },
      { lon: centre[0], lat: centre[1] },
    );

    if (ecart > 30) {
      console.log(
        `  ! ${annonce.titre} — résultat à ${Math.round(ecart)} km de ${annonce.ville}, ignoré`,
      );
      ignorees += 1;
      continue;
    }

    await sql`
      update annonce
      set position = st_setsrid(st_makepoint(${centre[0]}, ${centre[1]}), 4326)
      where id = ${annonce.id}`;

    console.log(
      `  + ${annonce.titre} — ${annonce.ville}, déplacée de ${ecart.toFixed(2)} km`,
    );
    places += 1;
  }

  console.log(`\n${places} annonce(s) située(s), ${ignorees} laissée(s) en place.`);
  await sql.end();
  process.exit(0);
}

main().catch((erreur) => {
  console.error(erreur);
  process.exit(1);
});
