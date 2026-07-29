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

/**
 * Point géographique PostGIS en `geography`, et non `geometry` : les calculs
 * de distance sont alors exprimés en mètres sur le sphéroïde, ce qui est
 * exactement ce que demande une recherche par rayon (M03).
 */
export const pointGeographique = customType<{
  data: { longitude: number; latitude: number };
  driverData: string;
}>({
  dataType() {
    return "geography(Point, 4326)";
  },
  toDriver(value) {
    return `SRID=4326;POINT(${value.longitude} ${value.latitude})`;
  },
});
