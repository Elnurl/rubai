import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { loadEnvFiles } from "./load-env.mjs";
import { killPort } from "./kill-port.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const apiDir = resolve(root, "artifacts/api-server");

loadEnvFiles(
  resolve(root, ".env"),
  resolve(apiDir, ".env"),
);

process.env.NODE_ENV = "development";
process.env.PORT = process.env.PORT ?? "5000";

killPort(process.env.PORT);

const childEnv = {
  ...process.env,
  NODE_ENV: "development",
  CI: "true",
};

const build = spawn("node", ["build.mjs"], {
  cwd: apiDir,
  stdio: "inherit",
  shell: true,
  env: childEnv,
});

build.on("exit", (code) => {
  if (code !== 0) process.exit(code ?? 1);

  const start = spawn(
    "node",
    ["--enable-source-maps", "./dist/index.mjs"],
    {
      cwd: apiDir,
      stdio: "inherit",
      shell: true,
      env: childEnv,
    },
  );

  start.on("exit", (c) => process.exit(c ?? 0));
});
