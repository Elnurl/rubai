import path from "path";
import { fileURLToPath } from "url";
import { sql } from "drizzle-orm";
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
 * SHA-256 hash of 0000_icy_victor_mancha.sql as computed by Drizzle's migrator.
 * Used to bootstrap the __drizzle_migrations tracking table when the schema was
 * applied outside of Drizzle (e.g. via drizzle-kit push or raw SQL) before the
 * runMigrations() startup hook existed.
 */
const INITIAL_MIGRATION_HASH =
  "e82bd8e3d4c046b89ac80319a9e1dcedf1b30839845071d99bdc64999f9e8402";
const INITIAL_MIGRATION_WHEN = 1781363848889;

/**
 * Run pending Drizzle migrations against the connected database.
 * Safe to call on every server startup — already-applied migrations are
 * skipped via the internal __drizzle_migrations tracking table.
 *
 * Bootstrap logic: if the `users` table already exists but the Drizzle
 * migrations tracking table has no entries, the initial migration was
 * applied outside of Drizzle's migrator (drizzle-kit push or raw SQL).
 * We insert a synthetic entry so the migrator skips the already-applied
 * SQL and doesn't crash with "relation already exists".
 *
 * The migrations folder is resolved from `DRIZZLE_MIGRATIONS_DIR` env var
 * (set at build time / in production) or falls back to a path relative to
 * this source file (development).
 */
export async function runMigrations(): Promise<void> {
  await bootstrapMigrationsIfNeeded();

  const migrationsFolder =
    process.env["DRIZZLE_MIGRATIONS_DIR"] ??
    path.join(path.dirname(fileURLToPath(import.meta.url)), "./drizzle");
  await migrate(db, { migrationsFolder });
}

async function bootstrapMigrationsIfNeeded(): Promise<void> {
  const client = await pool.connect();
  try {
    // Check whether the `users` table exists — proxy for "initial schema already applied".
    const tableCheck = await client.query<{ exists: boolean }>(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'users'
      ) AS exists
    `);
    const usersExists = tableCheck.rows[0]?.exists ?? false;
    if (!usersExists) {
      // Fresh database — let Drizzle run the migration normally.
      return;
    }

    // Users table exists. Ensure __drizzle_migrations is bootstrapped.
    // Drizzle stores it in the 'drizzle' schema.
    await client.query(`CREATE SCHEMA IF NOT EXISTS drizzle`);
    await client.query(`
      CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
        id SERIAL PRIMARY KEY,
        hash TEXT NOT NULL,
        created_at BIGINT
      )
    `);

    const countResult = await client.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM drizzle.__drizzle_migrations`,
    );
    const count = parseInt(countResult.rows[0]?.count ?? "0", 10);
    if (count === 0) {
      // Insert a synthetic record so the migrator treats migration 0000 as done.
      await client.query(
        `INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2)`,
        [INITIAL_MIGRATION_HASH, INITIAL_MIGRATION_WHEN],
      );
    }
  } finally {
    client.release();
  }
}

export * from "./schema";
