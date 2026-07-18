import http from "node:http";
import app from "./app";
import { logger } from "./lib/logger";
import { startPushScheduler } from "./lib/pushScheduler";
import { startWebhookRetryWorker } from "./lib/webhookRetryWorker";
import { runMigrations } from "@workspace/db";

// Default Node limit is 16KB; Supabase JWTs + proxy hop headers can exceed
// that and surface as HTTP 431 to mobile clients.
const MAX_HEADER_SIZE = 128 * 1024;

// ── Required env-var guard ─────────────────────────────────────────────────
// Fail fast at startup with a clear message rather than a cryptic runtime
// error buried in a route handler.
const REQUIRED_ENV: string[] = [
  "PORT",
  "DATABASE_URL",
  "SESSION_SECRET",
];

// Auth: either legacy HS256 secret OR project URL (JWKS / ECC signing keys).
if (
  !process.env["SUPABASE_JWT_SECRET"] &&
  !process.env["SUPABASE_URL"] &&
  !process.env["EXPO_PUBLIC_SUPABASE_URL"]
) {
  REQUIRED_ENV.push("SUPABASE_URL");
}

// Billing sync is optional until RevenueCat is fully wired for production.
// Warn loudly but do not block boot — MVP hosts often start without store keys.
if (process.env["NODE_ENV"] === "production") {
  for (const key of [
    "REVENUECAT_V2_SECRET_KEY",
    "REVENUECAT_WEBHOOK_SECRET",
  ] as const) {
    if (!process.env[key]) {
      logger.warn(
        { missing: key },
        "Production env missing optional RevenueCat key — billing sync disabled",
      );
    }
  }
}

const missingEnv = REQUIRED_ENV.filter((k) => !process.env[k]);
if (missingEnv.length > 0) {
  logger.error(
    { missing: missingEnv },
    "Missing required environment variables — refusing to start",
  );
  process.exit(1);
}

const rawPort = process.env["PORT"]!;
const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// ── Run DB migrations then start HTTP ─────────────────────────────────────
(async () => {
  try {
    logger.info("Running database migrations…");
    await runMigrations();
    logger.info("Database migrations complete");
  } catch (err) {
    logger.error({ err }, "Database migration failed — refusing to start");
    process.exit(1);
  }

  // Railway (and most PaaS) require binding to 0.0.0.0, not just localhost.
  const host = process.env["HOST"] ?? "0.0.0.0";
  const server = http.createServer({ maxHeaderSize: MAX_HEADER_SIZE }, app);
  server.listen(port, host, () => {
    logger.info({ port, host, maxHeaderSize: MAX_HEADER_SIZE }, "Server listening");
    startPushScheduler();
    startWebhookRetryWorker();
  });
  server.on("error", (err) => {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  });
})();
