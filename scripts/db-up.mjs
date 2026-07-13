import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { resolveDockerBin, dockerPathEnv } from "./find-docker.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const docker = resolveDockerBin();

if (!docker) {
  console.error(
    "[rubai] Docker not found. Start Docker Desktop, then run this again.",
  );
  console.error(
    "[rubai] Or use a cloud DB (Neon) — see docs/LOCAL_SETUP.md",
  );
  process.exit(1);
}

console.log(`[rubai] Using Docker: ${docker}`);
const result = spawnSync(docker, ["compose", "up", "-d"], {
  cwd: root,
  stdio: "inherit",
  shell: true,
  env: dockerPathEnv(),
});

process.exit(result.status ?? 1);
