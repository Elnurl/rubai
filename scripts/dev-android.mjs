/**

 * Start Metro for the rubai **development build** (not Expo Go).

 *

 * Prerequisite: install the dev APK once via `pnpm build:android:dev`.

 * Then run this while `pnpm dev:api` is up — open the "rubai" dev app on your phone.

 */

import { spawn } from "node:child_process";

import os from "node:os";

import { fileURLToPath } from "node:url";

import { dirname, resolve } from "node:path";

import { loadEnvFiles } from "./load-env.mjs";

import { killPort } from "./kill-port.mjs";



const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const mobileDir = resolve(root, "artifacts/mobile");



loadEnvFiles(resolve(root, ".env"), resolve(mobileDir, ".env"));

await import("./verify-supabase.mjs");

const port = process.env.EXPO_PORT ?? process.env.PORT ?? "8081";



function detectLanIp() {

  for (const iface of Object.values(os.networkInterfaces())) {

    for (const addr of iface ?? []) {

      if (addr.family === "IPv4" && !addr.internal) {

        return addr.address;

      }

    }

  }

  return null;

}



const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? "";

const needsLan =

  !apiUrl ||

  apiUrl.includes("localhost") ||

  apiUrl.includes("127.0.0.1");

if (needsLan) {

  const lan = detectLanIp();

  if (lan) {

    process.env.EXPO_PUBLIC_API_URL = `http://${lan}:5000`;

    console.log(`[rubai] Phone API URL → ${process.env.EXPO_PUBLIC_API_URL}`);

  } else {

    process.env.EXPO_PUBLIC_API_URL = "http://localhost:5000";

    console.warn(

      "[rubai] Could not detect LAN IP — set EXPO_PUBLIC_API_URL in .env for phone testing.",

    );

  }

}



process.env.EXPO_PORT = port;

killPort(port);



console.log("");

console.log("[rubai] Dev client Metro — use the rubai dev app on your phone (not Expo Go).");

console.log("[rubai] Make sure pnpm dev:api is running in another terminal.");

console.log("");



const childEnv = {

  ...process.env,

  EXPO_PORT: port,

};

delete childEnv.CI;



const child = spawn(

  "pnpm",

  ["exec", "expo", "start", "--dev-client", "--port", port, "--lan", "--clear"],

  {

    cwd: mobileDir,

    stdio: "inherit",

    shell: true,

    env: childEnv,

  },

);



child.on("exit", (code) => process.exit(code ?? 0));


