import path from "path";
import { fileURLToPath } from "url";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });

/**
 * Run pending Drizzle migrations against the connected database.
 * Safe to call on every server startup — already-applied migrations are
 * skipped via the internal __drizzle_migrations tracking table.
 *
 * The migrations folder is resolved from `DRIZZLE_MIGRATIONS_DIR` env var
 * (set at build time / in production) or falls back to a path relative to
 * this source file (development).
 */
export async function runMigrations(): Promise<void> {
  const migrationsFolder =
    process.env["DRIZZLE_MIGRATIONS_DIR"] ??
    path.join(path.dirname(fileURLToPath(import.meta.url)), "./drizzle");
  await migrate(db, { migrationsFolder });
}

export * from "./schema";
