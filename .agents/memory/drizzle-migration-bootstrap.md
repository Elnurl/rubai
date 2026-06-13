---
name: Drizzle migration bootstrap on pre-existing database
description: How to mark a migration as applied when tables were created outside Drizzle's migrator (e.g. via drizzle-kit push or raw SQL)
---

When `drizzle-kit push` or raw `psql` was used to create tables before the `runMigrations()` startup hook existed, the `drizzle.__drizzle_migrations` table is empty. Running `migrate()` then fails with "relation X already exists".

**Fix:** Compute the SHA-256 hash of the migration SQL file the same way Drizzle does (`crypto.createHash('sha256').update(fileContent).digest('hex')`), then insert it manually:

```sql
INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
VALUES ('<sha256-of-sql-file>', <journal.entries[n].when>);
```

`when` is the millisecond timestamp from `lib/db/drizzle/meta/_journal.json`.

**Why:** Drizzle's migrator skips any migration whose hash is already in `__drizzle_migrations`. Inserting the hash is safe and idempotent — it just tells the migrator "this was already applied".

**How to apply:** Only needed once when bootstrapping the migrator on a DB that was managed without it. Future migrations added via `drizzle-kit generate` will be applied normally.
