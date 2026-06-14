import { Router, type IRouter } from "express";
import { timingSafeEqual } from "node:crypto";
import { db, webhookRetryQueueTable } from "@workspace/db";
import {
  processWebhookEvent,
  buildIdempotencyKey,
  type RcWebhookEvent,
} from "../lib/webhookProcessor";

const router: IRouter = Router();

// How long after an ACTIVE event's own timestamp we will still return 404
// (triggering a RevenueCat retry) when the user row doesn't exist yet.
// Within this window the missing row is most likely a sign-up race;
// outside it the clerkUserId is genuinely unknown and we stop retrying.
// Configurable via env so tests and ops can override without code changes.
const WEBHOOK_RACE_WINDOW_MS =
  Number(process.env["WEBHOOK_RACE_WINDOW_MS"] ?? "") || 5 * 60 * 1000; // 5 min

const ACTIVE_STATUSES = new Set([
  "INITIAL_PURCHASE",
  "RENEWAL",
  "PRODUCT_CHANGE",
  "NON_RENEWING_PURCHASE",
  "UNCANCELLATION",
]);

interface RcWebhookBody {
  event?: RcWebhookEvent;
}

router.get("/webhooks/revenuecat/health", (req, res) => {
  const webhookSecret = process.env["REVENUECAT_WEBHOOK_SECRET"];
  const isProduction = process.env["NODE_ENV"] === "production";
  const secretConfigured = Boolean(webhookSecret?.trim());

  if (isProduction) {
    if (!secretConfigured) {
      req.log?.error(
        "REVENUECAT_WEBHOOK_SECRET is unset in production — health check rejected",
      );
      res.status(503).json({ ok: false, error: "secret_not_configured" });
      return;
    }

    const authHeader = req.headers["authorization"] ?? "";
    const trimmedSecret = webhookSecret!.trim();
    const secretBuf = Buffer.from(trimmedSecret, "utf8");
    const headerBuf = Buffer.from(authHeader, "utf8");
    const valid =
      headerBuf.byteLength === secretBuf.byteLength &&
      timingSafeEqual(headerBuf, secretBuf);

    if (!valid) {
      req.log?.warn(
        { headerByteLength: headerBuf.byteLength },
        "RC webhook health: Authorization header does not match REVENUECAT_WEBHOOK_SECRET",
      );
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
  }

  req.log?.info({ secretConfigured }, "RC webhook health check OK");
  res.status(200).json({ ok: true, secretConfigured });
});

router.post("/webhooks/revenuecat", async (req, res) => {
  const webhookSecret = process.env["REVENUECAT_WEBHOOK_SECRET"];
  const isProduction = process.env["NODE_ENV"] === "production";

  if (isProduction && !webhookSecret) {
    // Startup guard in index.ts should have prevented this, but defend in
    // depth: never process unauthenticated tier changes in production.
    req.log?.error(
      "REVENUECAT_WEBHOOK_SECRET is unset in production — rejecting request",
    );
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  if (webhookSecret) {
    // RevenueCat sends the shared secret verbatim in the Authorization header
    // (no "Bearer " prefix). timingSafeEqual prevents timing-based attacks.
    const authHeader = req.headers["authorization"] ?? "";
    const trimmedSecret = webhookSecret.trim();
    const secretBuf = Buffer.from(trimmedSecret, "utf8");
    const headerBuf = Buffer.from(authHeader, "utf8");
    const valid =
      headerBuf.byteLength === secretBuf.byteLength &&
      timingSafeEqual(headerBuf, secretBuf);
    if (!valid) {
      req.log?.warn(
        {
          headerByteLength: headerBuf.byteLength,
          secretByteLength: secretBuf.byteLength,
          headerPrefix: authHeader.slice(0, 8) || "(empty)",
        },
        "RC webhook: Authorization header does not match REVENUECAT_WEBHOOK_SECRET — check that the secret in Replit matches the value shown in RevenueCat Project Settings → Integrations → Webhooks",
      );
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
  }

  const body = req.body as RcWebhookBody;
  const event = body?.event;

  if (!event?.type) {
    res.status(400).json({ error: "Missing event type" });
    return;
  }

  const clerkUserId =
    event.original_app_user_id ?? event.app_user_id ?? null;

  if (!clerkUserId) {
    res.status(200).json({ ok: true, skipped: "no_user_id" });
    return;
  }

  const isActive = ACTIVE_STATUSES.has(event.type);

  // ── Sign-up race window check ──────────────────────────────────────────
  // For active events we may need to 404 so RevenueCat retries while the
  // user row is being created.  We handle this BEFORE attempting the DB
  // transaction; processWebhookEvent will return user_not_found (non-
  // retryable) once the race window has passed.
  //
  // We do a quick user-existence check only in the race window path so we
  // can return 404 (prompting RC to retry) without going through the full
  // processor. Outside the window processWebhookEvent handles not-found
  // gracefully as a permanent skip.
  if (isActive) {
    const eventAgeMs =
      event.event_timestamp_ms != null
        ? Date.now() - event.event_timestamp_ms
        : 0;

    if (eventAgeMs <= WEBHOOK_RACE_WINDOW_MS) {
      // Delegate to processWebhookEvent; if it returns user_not_found we
      // return 404 here so RC keeps retrying within its own window.
      const result = await processWebhookEvent(event, req.log ?? console);

      if (result.ok) {
        req.log?.info(
          { clerkUserId, eventType: event.type },
          "RC webhook processed (inline)",
        );
        res.status(200).json({ ok: true });
        return;
      }

      if (!result.retryable && result.error === "user_not_found") {
        // User row doesn't exist yet and the event is fresh — return 404 so
        // RevenueCat retries within its own retry window.
        req.log?.warn(
          { clerkUserId, eventType: event.type, eventAgeMs },
          "RC webhook: user not found for recent active event — returning 404 to trigger RC retry",
        );
        res.status(404).json({ error: "user_not_found" });
        return;
      }

      if (!result.retryable) {
        // Some other permanent skip (unhandled event type, no user id, etc.)
        res.status(200).json({ ok: true, skipped: result.error });
        return;
      }

      // Retryable error (DB down) — try to enqueue so our worker retries.
      // If the enqueue itself fails (DB completely unavailable) return 500 so
      // RC keeps retrying while the database recovers.
      const enqueued = await enqueueEvent(event, req.log ?? console);
      if (enqueued) {
        req.log?.warn(
          { clerkUserId, eventType: event.type },
          "RC webhook: inline processing failed — queued for retry",
        );
        res.status(200).json({ ok: true, queued: true });
      } else {
        req.log?.error(
          { clerkUserId, eventType: event.type },
          "RC webhook: inline processing failed and could not enqueue — returning 500",
        );
        res.status(500).json({ error: "Internal error" });
      }
      return;
    }
  }

  // ── Outside race window (or inactive event) ────────────────────────────
  // Try inline processing first. If it fails with a retryable error, enqueue
  // the event so our background worker handles it — this prevents the
  // purchase from being silently dropped when RC's own retry window expires.
  const result = await processWebhookEvent(event, req.log ?? console);

  if (result.ok) {
    req.log?.info(
      { clerkUserId, eventType: event.type },
      "RC webhook processed (inline)",
    );
    res.status(200).json({ ok: true });
    return;
  }

  if (!result.retryable) {
    // Permanent skip: unknown user after race window, unhandled event type, etc.
    req.log?.warn(
      { clerkUserId, eventType: event.type, reason: result.error },
      "RC webhook: permanent skip",
    );
    res.status(200).json({ ok: true, skipped: result.error });
    return;
  }

  // Retryable failure — enqueue for the background worker and ack RC so it
  // doesn't exhaust its own limited retry budget.
  const enqueued = await enqueueEvent(event, req.log ?? console);
  if (enqueued) {
    req.log?.warn(
      { clerkUserId, eventType: event.type },
      "RC webhook: inline processing failed — queued for retry",
    );
    res.status(200).json({ ok: true, queued: true });
  } else {
    // Could not enqueue (DB completely unavailable) — return 500 so RC
    // keeps retrying while the database recovers.
    req.log?.error(
      { clerkUserId, eventType: event.type },
      "RC webhook: inline processing failed and could not enqueue — returning 500",
    );
    res.status(500).json({ error: "Internal error" });
  }
});

/**
 * Insert the event into the retry queue.  Uses ON CONFLICT DO NOTHING so
 * duplicate deliveries from RevenueCat are silently ignored.
 *
 * Returns true if the enqueue succeeded (row inserted or already existed),
 * false if the DB write itself failed.
 */
async function enqueueEvent(
  event: RcWebhookEvent,
  log: { warn?(obj: object, msg: string): void; error?(obj: object, msg: string): void },
): Promise<boolean> {
  const clerkUserId =
    event.original_app_user_id ?? event.app_user_id ?? null;
  const idempotencyKey = buildIdempotencyKey(event);

  try {
    await db
      .insert(webhookRetryQueueTable)
      .values({
        idempotencyKey,
        eventType: event.type,
        clerkUserId,
        payload: event as unknown as Record<string, unknown>,
      })
      .onConflictDoNothing();
    return true;
  } catch (err) {
    log.error?.(
      { err, idempotencyKey, eventType: event.type },
      "RC webhook: failed to enqueue event for retry",
    );
    return false;
  }
}

export default router;
