import app from "./app";
import { logger } from "./lib/logger";
import { startPushScheduler } from "./lib/pushScheduler";
import { runMigrations } from "@workspace/db";

// ── Required env-var guard ─────────────────────────────────────────────────
// Fail fast at startup with a clear message rather than a cryptic runtime
// error buried in a route handler.
const REQUIRED_ENV: string[] = [
  "PORT",
  "DATABASE_URL",
  "CLERK_SECRET_KEY",
  "SESSION_SECRET",
  "REVENUECAT_V2_SECRET_KEY",
];

// In production, REVENUECAT_WEBHOOK_SECRET must be set so the webhook
// handler can authenticate incoming events.  Without it, any caller could
// send fake subscription events and change a user's tier.
if (process.env["NODE_ENV"] === "production") {
  REQUIRED_ENV.push("REVENUECAT_WEBHOOK_SECRET");
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

  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }

    logger.info({ port }, "Server listening");
    startPushScheduler();
  });
})();
