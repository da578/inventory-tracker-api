#!/bin/sh
set -e

echo "[Entrypoint] Waiting for MariaDB connection..."
until bun -e 'import mysql from "mysql2/promise"; const conn = await mysql.createConnection(process.env.DATABASE_URL); await conn.ping(); await conn.end();' 2>/dev/null; do
  sleep 1
done
echo "[Entrypoint] MariaDB connection established."

echo "[Entrypoint] Running database migrations..."
bun run src/db/migrate.ts

echo "[Entrypoint] Seeding initial database data..."
bun run src/db/seed.ts

echo "[Entrypoint] Starting Inventory Tracker API..."
exec bun dist/index.js
