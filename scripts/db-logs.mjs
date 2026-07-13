import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { resolveDockerBin } from "./find-docker.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const docker = resolveDockerBin();
if (!docker) process.exit(1);

const result = spawnSync(docker, ["compose", "logs", "-f", "postgres"], {
  cwd: root,
  stdio: "inherit",
  shell: true,
});
process.exit(result.status ?? 1);
