import { migrate } from "drizzle-orm/mysql2/migrator";
import { db, poolConnection } from "./index";

async function runMigrate() {
  console.log("Running migrations on MariaDB...");
  await migrate(db, { migrationsFolder: "./src/db/migrations" });
  console.log("Migrations applied successfully!");
  await poolConnection.end();
}

runMigrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
