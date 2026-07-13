import { spawn } from "node:child_process";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { loadEnvFiles } from "./load-env.mjs";
import { killPort } from "./kill-port.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const mobileDir = resolve(root, "artifacts/mobile");

loadEnvFiles(
  resolve(root, ".env"),
  resolve(mobileDir, ".env"),
);

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

// Physical phones cannot reach localhost — use the PC's LAN IP for the API.
const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? "";
const needsLan =
  !apiUrl ||
  apiUrl.includes("localhost") ||
  apiUrl.includes("127.0.0.1");
if (needsLan) {
  const lan = detectLanIp();
  if (lan) {
    process.env.EXPO_PUBLIC_API_URL = `http://${lan}:5000`;
    console.log(
      `[rubai] Phone API URL → ${process.env.EXPO_PUBLIC_API_URL}`,
    );
  } else {
    process.env.EXPO_PUBLIC_API_URL = "http://localhost:5000";
    console.warn(
      "[rubai] Could not detect LAN IP — set EXPO_PUBLIC_API_URL in .env for phone testing.",
    );
  }
}

process.env.EXPO_PORT = port;

killPort(port);

const childEnv = {
  ...process.env,
  EXPO_PORT: port,
};
delete childEnv.CI;

const child = spawn(
  "pnpm",
  ["exec", "expo", "start", "--port", port, "--lan", "--clear"],
  {
    cwd: mobileDir,
    stdio: "inherit",
    shell: true,
    env: childEnv,
  },
);

child.on("exit", (code) => process.exit(code ?? 0));
