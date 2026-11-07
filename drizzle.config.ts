import { defineConfig } from "drizzle-kit";

/**
 * Drizzle Kit configuration for MariaDB / MySQL.
 *
 * @remarks
 * This configuration is used by Drizzle Kit to generate SQL migration files
 * and push schemas to the database based on TypeScript schema definitions in src/db/schema.
 *
 * @public
 */
export default defineConfig({
  dialect: "mysql",
  schema: "./src/db/schema/index.ts",
  out: "./src/db/migrations",
  dbCredentials: {
    url:
      process.env.DATABASE_URL ||
      "mysql://inventory:inventory123@127.0.0.1:3306/inventory_tracker",
  },
  verbose: true,
  strict: true,
});
