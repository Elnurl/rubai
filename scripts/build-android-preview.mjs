/**
 * Build a rubai Android **preview** APK via EAS (standalone — no Metro).
 *
 * Always runs preflight first: HTTPS Railway API, Supabase keys, live
 * /api/healthz, and syncs EAS preview env from local .env so the APK
 * cannot ship pointing at a PC LAN address.
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const mobileDir = resolve(root, "artifacts/mobile");

console.log("");
console.log("[rubai] Building Android PREVIEW APK on EAS (standalone MVP)...");
console.log("[rubai] Docs: docs/MVP_ANDROID.md");
console.log("");

const preflight = spawnSync(
  "node",
  [resolve(root, "scripts/preflight-android-preview.mjs")],
  {
    cwd: root,
    stdio: "inherit",
    shell: true,
    env: process.env,
  },
);

if ((preflight.status ?? 1) !== 0) {
  console.error(
    "\n[rubai] Preflight failed — fix the errors above, then retry.\n",
  );
  process.exit(preflight.status ?? 1);
}

console.log("[rubai] This takes ~15–40 minutes on free tier (queue + build).");
console.log("");

const result = spawnSync(
  "pnpm",
  ["exec", "eas", "build", "--platform", "android", "--profile", "preview"],
  {
    cwd: mobileDir,
    stdio: "inherit",
    shell: true,
    env: {
      ...process.env,
      EAS_BUILD: "true",
      EXPO_NATIVE_BUILD: "true",
    },
  },
);

process.exit(result.status ?? 1);
