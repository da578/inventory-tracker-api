import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "./schema";

/**
 * Shared MySQL/MariaDB connection pool.
 */
export const poolConnection = mysql.createPool(
  process.env.DATABASE_URL ||
    "mysql://inventory:inventory123@127.0.0.1:3306/inventory_tracker",
);

/**
 * Drizzle ORM client instance configured with MySQL connection and all schema definitions.
 */
export const db = drizzle({
  client: poolConnection,
  schema,
  mode: "default",
});
