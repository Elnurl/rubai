---
name: DB migration pattern
description: How to add new DB tables in this monorepo (no drizzle-migrate CLI configured).
---

## Steps

1. Create `lib/db/src/schema/<table_name>.ts` with pgTable definition
2. Export from `lib/db/src/schema/index.ts`
3. Run raw SQL via `psql "$DATABASE_URL"` to CREATE TABLE + indexes
4. Run `pnpm run typecheck:libs` to rebuild the composite lib and emit declarations
5. Import the new table via `@workspace/db` in any artifact

**Why:** No drizzle-kit migrate CLI is wired up; schema files are the declaration layer but the DB is provisioned manually via psql.

**How to apply:** Every new table needs all 4 steps — skipping the psql step means the table exists in TypeScript types but not in the real DB; skipping `typecheck:libs` means downstream artifacts can't import the new table type.
