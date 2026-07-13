/**
 * Verify Supabase Auth env before starting Metro / API.
 */
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { loadEnvFiles } from "./load-env.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
loadEnvFiles(resolve(root, ".env"));

const url =
  process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
const anon =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  "";
const jwtSecret = process.env.SUPABASE_JWT_SECRET || "";

function fail(msg) {
  console.error(`\n[rubai] Supabase setup error: ${msg}\n`);
  process.exit(1);
}

if (!url || url.includes("YOUR_PROJECT")) {
  fail(
    "Missing EXPO_PUBLIC_SUPABASE_URL — create a project at supabase.com and paste Settings → API → Project URL",
  );
}
if (!anon || anon.startsWith("eyJ...") || anon.length < 20) {
  fail(
    "Missing EXPO_PUBLIC_SUPABASE_ANON_KEY — paste Settings → API → anon public key",
  );
}
if (!jwtSecret || jwtSecret.includes("your-jwt-secret")) {
  fail(
    "Missing SUPABASE_JWT_SECRET — paste Settings → API → JWT Settings → JWT Secret (API server needs this)",
  );
}

let healthOk = false;
try {
  const res = await fetch(`${url.replace(/\/$/, "")}/auth/v1/health`, {
    headers: { apikey: anon },
  });
  healthOk = res.ok;
  if (!res.ok) {
    fail(`Supabase Auth health check failed (${res.status}) for ${url}`);
  }
} catch (err) {
  fail(
    `Cannot reach Supabase (${url}): ${err instanceof Error ? err.message : err}`,
  );
}

console.log("[rubai] Supabase OK");
console.log(`  url:    ${url}`);
console.log(`  health: ${healthOk ? "ok" : "?"}`);
console.log(`  jwt:    ${jwtSecret.slice(0, 6)}…`);
