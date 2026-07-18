/**
 * Preflight for standalone Android preview APK builds.
 * Fails fast if the app would ship pointing at a PC/LAN API or a dead host.
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { loadEnvFiles } from "./load-env.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const mobileDir = resolve(root, "artifacts/mobile");

loadEnvFiles(resolve(root, ".env"), resolve(mobileDir, ".env"));

const REQUIRED = [
  "EXPO_PUBLIC_API_URL",
  "EXPO_PUBLIC_SUPABASE_URL",
  "EXPO_PUBLIC_SUPABASE_ANON_KEY",
];

const OPTIONAL_WARN = ["EXPO_PUBLIC_REVENUECAT_TEST_API_KEY"];

function fail(msg) {
  console.error(`\n[preflight] FAIL: ${msg}\n`);
  process.exit(1);
}

function isPrivateLanHost(hostname) {
  const h = (hostname || "").toLowerCase();
  if (!h || h === "localhost" || h === "127.0.0.1" || h === "0.0.0.0") {
    return true;
  }
  if (h.endsWith(".local")) return true;
  if (/^10\.\d+\.\d+\.\d+$/.test(h)) return true;
  if (/^192\.168\.\d+\.\d+$/.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+$/.test(h)) return true;
  return false;
}

function assertPublicHttpsApi(raw) {
  if (!raw || !String(raw).trim()) {
    fail("EXPO_PUBLIC_API_URL is empty. Set it to your Railway HTTPS URL.");
  }
  let url;
  try {
    url = new URL(String(raw).trim());
  } catch {
    fail(`EXPO_PUBLIC_API_URL is not a valid URL: ${raw}`);
  }
  if (url.protocol !== "https:") {
    fail(
      `Preview APK must use HTTPS API (got ${url.protocol}//${url.host}). ` +
        `LAN/http URLs only work with Metro + PC. Example: https://….up.railway.app`,
    );
  }
  if (isPrivateLanHost(url.hostname)) {
    fail(
      `EXPO_PUBLIC_API_URL points at a private/LAN host (${url.hostname}). ` +
        `Standalone APK cannot reach your PC. Use the Railway URL.`,
    );
  }
  return url.origin.replace(/\/$/, "");
}

console.log("\n[preflight] Checking preview APK requirements...\n");

for (const key of REQUIRED) {
  if (!process.env[key]?.trim()) {
    fail(`Missing ${key} in .env (needed for standalone APK).`);
  }
}

for (const key of OPTIONAL_WARN) {
  if (!process.env[key]?.trim()) {
    console.warn(`[preflight] WARN: ${key} missing — subscriptions may not work in APK.`);
  }
}

const apiBase = assertPublicHttpsApi(process.env.EXPO_PUBLIC_API_URL);
console.log(`[preflight] API URL OK → ${apiBase}`);

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL.trim();
if (!supabaseUrl.startsWith("https://") || !supabaseUrl.includes("supabase")) {
  fail(`EXPO_PUBLIC_SUPABASE_URL looks wrong: ${supabaseUrl}`);
}
console.log(`[preflight] Supabase URL OK → ${supabaseUrl}`);

// Live health check — APK is useless if Railway is down.
const healthUrl = `${apiBase}/api/healthz`;
console.log(`[preflight] Hitting ${healthUrl} ...`);
try {
  const res = await fetch(healthUrl, { signal: AbortSignal.timeout(20_000) });
  const body = await res.text();
  if (!res.ok) {
    fail(`API health returned HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
  if (!body.includes("ok")) {
    fail(`API health body unexpected: ${body.slice(0, 200)}`);
  }
  console.log("[preflight] API health OK");
} catch (err) {
  fail(`Cannot reach hosted API (${healthUrl}): ${err?.message || err}`);
}

// Sync EAS preview env so cloud builds cannot drift from local .env.
const syncVars = [
  ["EXPO_PUBLIC_API_URL", process.env.EXPO_PUBLIC_API_URL.trim()],
  ["EXPO_PUBLIC_SUPABASE_URL", process.env.EXPO_PUBLIC_SUPABASE_URL.trim()],
  [
    "EXPO_PUBLIC_SUPABASE_ANON_KEY",
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY.trim(),
  ],
];
if (process.env.EXPO_PUBLIC_REVENUECAT_TEST_API_KEY?.trim()) {
  syncVars.push([
    "EXPO_PUBLIC_REVENUECAT_TEST_API_KEY",
    process.env.EXPO_PUBLIC_REVENUECAT_TEST_API_KEY.trim(),
  ]);
}

// Best-effort sync. Preview also bakes these into eas.json `env`, so a
 // failed eas env:create must not block the APK build.
console.log("[preflight] Syncing EAS preview environment variables (best-effort)...");
for (const [name, value] of syncVars) {
  const result = spawnSync(
    "pnpm",
    [
      "exec",
      "eas",
      "env:create",
      "preview",
      "--name",
      name,
      "--value",
      value,
      "--visibility",
      "plaintext",
      "--force",
      "--non-interactive",
    ],
    { cwd: mobileDir, encoding: "utf8", shell: true },
  );
  if (result.status !== 0) {
    console.warn(`[preflight] WARN: eas env:create failed for ${name} — continuing (eas.json env is source of truth)`);
    if (result.stderr) console.warn(String(result.stderr).slice(0, 400));
  } else {
    console.log(`[preflight]   synced ${name}`);
  }
}

console.log("\n[preflight] All checks passed. Safe to build preview APK.\n");
