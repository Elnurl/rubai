import { execSync } from "node:child_process";

/**
 * Best-effort release of a TCP port before starting a dev server.
 * Works on Windows, macOS, and Linux without extra dependencies.
 */
export function killPort(port) {
  const n = Number(port);
  if (!Number.isInteger(n) || n <= 0 || n > 65535) {
    throw new Error(`Invalid port: ${port}`);
  }

  if (process.platform === "win32") {
    try {
      const out = execSync(`netstat -ano | findstr :${n}`, {
        encoding: "utf8",
        stdio: ["pipe", "pipe", "ignore"],
      });
      const pids = new Set();
      for (const line of out.split(/\r?\n/)) {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && /^\d+$/.test(pid) && pid !== "0") pids.add(pid);
      }
      for (const pid of pids) {
        try {
          execSync(`taskkill /PID ${pid} /F`, { stdio: "ignore" });
        } catch {
          // process may already be gone
        }
      }
    } catch {
      // nothing listening
    }
    return;
  }

  try {
    execSync(`lsof -ti tcp:${n} | xargs kill -9 2>/dev/null || true`, {
      shell: true,
      stdio: "ignore",
    });
  } catch {
    // nothing listening
  }
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, "/")}`) {
  const port = process.argv[2] ?? "5000";
  killPort(port);
}
