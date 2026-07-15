/**
 * Build a rubai Android **preview** APK via EAS (standalone — no Metro).
 *
 * Prerequisite: set EAS preview env EXPO_PUBLIC_API_URL to your hosted API
 * (see docs/MVP_ANDROID.md). Then install the APK and open rubai like a
 * normal app.
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { loadEnvFiles } from "./load-env.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const mobileDir = resolve(root, "artifacts/mobile");

loadEnvFiles(resolve(root, ".env"), resolve(mobileDir, ".env"));

console.log("");
console.log("[rubai] Building Android PREVIEW APK on EAS (standalone MVP)...");
console.log("[rubai] This takes ~15–40 minutes on free tier (queue + build).");
console.log("[rubai] Docs: docs/MVP_ANDROID.md");
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
