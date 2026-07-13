import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

const WINDOWS_CANDIDATES = [
  "C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe",
  "C:\\Program Files\\Docker\\Docker\\docker.exe",
];

function probe(bin, env = process.env) {
  return (
    spawnSync(bin, ["version"], { stdio: "ignore", shell: true, env })
      .status === 0
  );
}

export function dockerPathEnv() {
  if (process.platform !== "win32") return process.env;
  const dockerBin = "C:\\Program Files\\Docker\\Docker\\resources\\bin";
  const pathKey = Object.keys(process.env).find(
    (k) => k.toLowerCase() === "path",
  );
  const current = pathKey ? process.env[pathKey] : "";
  if (current?.includes(dockerBin)) return process.env;
  return {
    ...process.env,
    [pathKey ?? "Path"]: `${dockerBin};${current ?? ""}`,
  };
}

export function resolveDockerBin() {
  const env = dockerPathEnv();

  if (process.platform === "win32") {
    for (const path of WINDOWS_CANDIDATES) {
      if (existsSync(path) && probe(path, env)) return path;
    }
  }

  if (probe("docker", env)) return "docker";

  for (const path of WINDOWS_CANDIDATES) {
    if (existsSync(path) && probe(path, env)) return path;
  }

  return null;
}
