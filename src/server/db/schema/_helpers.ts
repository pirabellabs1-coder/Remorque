import { sql } from "drizzle-orm";
import {
  char,
  customType,
  integer,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Identifiant primaire. UUID généré en base : aucun compteur métier n'est
 * exposé dans les adresses publiques ni dans les documents PDF.
 */
export const id = () =>
  uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`);

export const reference = (name: string) => uuid(name);

/** Horodatages systématiques, en UTC. */
export const timestamps = {
  creeLe: timestamp("cree_le", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
  modifieLe: timestamp("modifie_le", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

/**
 * Montant monétaire.
 *
 * Toujours stocké en plus petite unité (centimes) sur un entier : aucun
 * flottant ne doit approcher un montant. Toute entité monétaire porte sa
 * devise — section 09 : « aucune conversion implicite ».
 */
export const montant = (name: string) => integer(name);

export const devise = (name = "devise") => char(name, { length: 3 });

export type Coordonnees = { longitude: number; latitude: number };

/**
 * Point géographique PostGIS en WGS 84.
 *
 * Le type natif `geometry` de Drizzle est écarté volontairement : il déclare
 * `geometry(point)` sans SRID et écrit les valeurs sans référentiel, ce qui
 * rend impossible toute projection `::geography` — donc tout calcul de
 * distance en mètres. On déclare donc le type complet, SRID compris.
 *
 * Les distances sont toujours calculées sur la projection `::geography` :
 * elles sont alors exprimées en mètres sur le sphéroïde, ce qui est exactement
 * ce que demande une recherche par rayon (M03).
 */
export const pointGeographique = customType<{
  data: Coordonnees;
  driverData: string;
}>({
  dataType() {
    return "geometry(Point, 4326)";
  },
  toDriver(value) {
    return `SRID=4326;POINT(${value.longitude} ${value.latitude})`;
  },
  fromDriver(value) {
    return lireEwkbPoint(value);
  },
});

/** Projection en `geography` d'une colonne de position, pour ST_DWithin. */
export const positionGeographique = (colonne: string) =>
  sql.raw(`(${colonne}::geography)`);

/**
 * PostGIS renvoie les géométries en EWKB hexadécimal. Seul le cas d'un point
 * en deux dimensions nous intéresse : la plateforme ne stocke rien d'autre.
 */
function lireEwkbPoint(hex: string): Coordonnees {
  const octets = Buffer.from(hex, "hex");
  // Octet 0 : boutisme (1 = petit-boutiste, le cas usuel sur PostgreSQL).
  const petitBoutiste = octets.readUInt8(0) === 1;
  const lireDouble = (position: number) =>
    petitBoutiste
      ? octets.readDoubleLE(position)
      : octets.readDoubleBE(position);

  const typeGeometrie = petitBoutiste
    ? octets.readUInt32LE(1)
    : octets.readUInt32BE(1);
  // Le bit 0x20000000 signale la présence d'un SRID sur quatre octets.
  const decalage = (typeGeometrie & 0x20000000) !== 0 ? 9 : 5;

  return {
    longitude: lireDouble(decalage),
    latitude: lireDouble(decalage + 8),
  };
}
