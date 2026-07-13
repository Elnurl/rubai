import { existsSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";

const ua = process.env.npm_config_user_agent ?? "";
if (!ua.includes("pnpm/")) {
  console.error("Use pnpm instead of npm/yarn. Install: npm install -g pnpm");
  process.exit(1);
}

for (const lock of ["package-lock.json", "yarn.lock"]) {
  const path = resolve(process.cwd(), lock);
  if (existsSync(path)) {
    try {
      unlinkSync(path);
    } catch {
      // ignore
    }
  }
}
