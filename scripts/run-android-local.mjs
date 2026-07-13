/**

 * Build and install rubai on a USB-connected Android device (local).

 *

 * Requires Android Studio, Android SDK, JDK 17, and USB debugging enabled.

 * Slower first-time setup than EAS — use build-android-dev.mjs if you prefer cloud.

 */

import { spawnSync } from "node:child_process";

import { fileURLToPath } from "node:url";

import { dirname, resolve } from "node:path";

import { loadEnvFiles } from "./load-env.mjs";



const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const mobileDir = resolve(root, "artifacts/mobile");



loadEnvFiles(resolve(root, ".env"), resolve(mobileDir, ".env"));



const env = {

  ...process.env,

  EXPO_NATIVE_BUILD: "true",

};



console.log("");

console.log("[rubai] Local Android build — requires Android Studio + USB debugging.");

console.log("[rubai] Docs: docs/DEV_BUILD_ANDROID.md");

console.log("");



const prebuild = spawnSync(

  "pnpm",

  ["exec", "expo", "prebuild", "--platform", "android", "--clean"],

  { cwd: mobileDir, stdio: "inherit", shell: true, env },

);

if (prebuild.status !== 0) process.exit(prebuild.status ?? 1);



const run = spawnSync(

  "pnpm",

  ["exec", "expo", "run:android", "--device"],

  { cwd: mobileDir, stdio: "inherit", shell: true, env },

);



process.exit(run.status ?? 1);


