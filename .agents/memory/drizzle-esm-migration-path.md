---
name: Drizzle migrations path in esbuild ESM bundle
description: Why ./drizzle must be used as the fallback path when resolving migrations inside a bundled ESM file
---

When esbuild bundles the api-server into `dist/index.mjs`, all library code (including `lib/db/src/index.ts`) is inlined into that single file. At runtime `import.meta.url` resolves to the **bundle file itself** (`artifacts/api-server/dist/index.mjs`), not to the original source file.

**Why:** `path.dirname(fileURLToPath(import.meta.url))` therefore gives `artifacts/api-server/dist/`, so the migrations path must be `./drizzle` → `artifacts/api-server/dist/drizzle/` (which `build.mjs` copies there).

Using `../drizzle` resolves to `artifacts/api-server/drizzle/` which does not exist and causes "Can't find meta/_journal.json".

**How to apply:** In `lib/db/src/index.ts` `runMigrations()`, use `./drizzle` as the fallback (not `../drizzle`). The `DRIZZLE_MIGRATIONS_DIR` env var overrides in production (set in artifact.toml).
