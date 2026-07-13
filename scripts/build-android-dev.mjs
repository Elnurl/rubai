/**

 * Build a rubai Android **development** APK via EAS (cloud).

 *

 * One-time: install the APK on your phone from the link EAS prints.

 * Daily dev: pnpm dev:api + pnpm dev:android

 */

import { spawnSync } from "node:child_process";

import { fileURLToPath } from "node:url";

import { dirname, resolve } from "node:path";

import { loadEnvFiles } from "./load-env.mjs";



const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const mobileDir = resolve(root, "artifacts/mobile");



loadEnvFiles(resolve(root, ".env"), resolve(mobileDir, ".env"));



console.log("");

console.log("[rubai] Building Android development APK on EAS (cloud)...");

console.log("[rubai] This takes ~15–25 minutes. You need: eas-cli + eas login");

console.log("[rubai] Docs: docs/DEV_BUILD_ANDROID.md");

console.log("");



const env = {

  ...process.env,

  EAS_BUILD: "true",

  EXPO_NATIVE_BUILD: "true",

};



const result = spawnSync(

  "pnpm",

  ["exec", "eas", "build", "--platform", "android", "--profile", "development"],

  {

    cwd: mobileDir,

    stdio: "inherit",

    shell: true,

    env,

  },

);



process.exit(result.status ?? 1);


