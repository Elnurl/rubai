/**
 * Background worker that retries failed RevenueCat webhook tier updates.
 *
 * When the inline DB transaction in the webhook handler fails, the raw event
 * is saved to `webhook_retry_queue`. This worker polls that table every
 * TICK_MS and re-runs the same processing logic with exponential back-off.
 *
 * Back-off schedule (attempt N = N-th retry after the initial failure):
 *   attempt 1 →  30 s
 *   attempt 2 →   1 min
 *   attempt 3 →   2 min
 *   attempt 4 →   4 min
 *   attempt 5 →   8 min
 *   attempt 6 →  16 min
 *   attempt 7 →  32 min
 *   attempt 8 →   1 h
 *   attempt 9 →   2 h
 *   attempt 10→   4 h  (or dead if MAX_ATTEMPTS reached)
 *
 * After MAX_ATTEMPTS the row is marked `dead` and a FATAL-level log is
 * emitted so ops can detect stuck purchases.
 *
 * Configuration (all via env, optional):
 *   WEBHOOK_RETRY_MAX_ATTEMPTS  — max attempts before dead (default 10)
 *   WEBHOOK_RETRY_TICK_MS       — poll interval in ms (default 30 000)
 */

import { and, eq, lte, sql } from "drizzle-orm";
import { db, webhookRetryQueueTable } from "@workspace/db";
import { logger } from "./logger";
import {
  processWebhookEvent,
  type RcWebhookEvent,
} from "./webhookProcessor";

const MAX_ATTEMPTS =
  Number(process.env["WEBHOOK_RETRY_MAX_ATTEMPTS"] ?? "") || 10;
const TICK_MS =
  Number(process.env["WEBHOOK_RETRY_TICK_MS"] ?? "") || 30_000;

/** Cap back-off at 4 hours. */
const MAX_BACKOFF_MS = 4 * 60 * 60 * 1_000;

/**
 * Compute the delay before the next attempt using capped exponential
 * back-off based on the number of attempts already made.
 *
 * attemptCount=0 → 30 s (first retry after the initial enqueue)
 * attemptCount=1 → 60 s
 * …
 */
function backoffMs(attemptCount: number): number {
  return Math.min(30_000 * Math.pow(2, attemptCount), MAX_BACKOFF_MS);
}

/**
 * Process a single pending queue entry.
 * Returns true if the row was resolved (done or dead), false if skipped.
 */
async function processEntry(id: number): Promise<boolean> {
  // Claim the row by atomically moving it from 'pending' → 'processing'.
  // If another worker beat us to it the UPDATE affects 0 rows and we skip.
  const claimed = await db
    .update(webhookRetryQueueTable)
    .set({ status: "processing", updatedAt: new Date() })
    .where(
      and(
        eq(webhookRetryQueueTable.id, id),
        eq(webhookRetryQueueTable.status, "pending"),
      ),
    )
    .returning({ id: webhookRetryQueueTable.id });

  if (claimed.length === 0) {
    return false; // already claimed or completed by another worker
  }

  // Re-fetch the full row now that we own it.
  const rows = await db
    .select()
    .from(webhookRetryQueueTable)
    .where(eq(webhookRetryQueueTable.id, id));

  const row = rows[0];
  if (!row) return false;

  const event = row.payload as RcWebhookEvent;

  const result = await processWebhookEvent(event, logger);

  if (result.ok) {
    await db
      .update(webhookRetryQueueTable)
      .set({ status: "done", updatedAt: new Date() })
      .where(eq(webhookRetryQueueTable.id, id));

    logger.info(
      {
        queueId: id,
        eventType: row.eventType,
        authUserId: row.authUserId,
        attemptCount: row.attemptCount + 1,
      },
      "webhook retry: event applied successfully",
    );
    return true;
  }

  // Processing failed — decide whether to retry or give up.
  const newAttemptCount = row.attemptCount + 1;

  if (!result.retryable || newAttemptCount >= MAX_ATTEMPTS) {
    // Permanent failure or exhausted retries → dead letter.
    await db
      .update(webhookRetryQueueTable)
      .set({
        status: "dead",
        attemptCount: newAttemptCount,
        lastError: result.error,
        updatedAt: new Date(),
      })
      .where(eq(webhookRetryQueueTable.id, id));

    logger.error(
      {
        queueId: id,
        eventType: row.eventType,
        authUserId: row.authUserId,
        attemptCount: newAttemptCount,
        maxAttempts: MAX_ATTEMPTS,
        lastError: result.error,
        retryable: result.retryable,
      },
      "webhook retry: event moved to dead-letter queue — manual intervention required",
    );

    // Emit a targeted alert when a purchase is lost because the subscriber
    // never signed up within the recovery window.  Ops should manually check
    // the RevenueCat dashboard for this subscriber and re-trigger the webhook
    // (or update the user's tier directly) once their account is confirmed.
    if (result.error === "user_not_found") {
      logger.error(
        {
          queueId: id,
          eventType: row.eventType,
          authUserId: row.authUserId,
        },
        "webhook retry: PURCHASE LOST — subscriber completed in-app purchase but never signed up within the recovery window; check RevenueCat dashboard for this subscriber and reconcile manually",
      );
    }

    return true;
  }

  // Schedule the next attempt with exponential back-off.
  const delay = backoffMs(newAttemptCount);
  const nextRetryAt = new Date(Date.now() + delay);

  await db
    .update(webhookRetryQueueTable)
    .set({
      status: "pending",
      attemptCount: newAttemptCount,
      lastError: result.error,
      nextRetryAt,
      updatedAt: new Date(),
    })
    .where(eq(webhookRetryQueueTable.id, id));

  logger.warn(
    {
      queueId: id,
      eventType: row.eventType,
      authUserId: row.authUserId,
      attemptCount: newAttemptCount,
      nextRetryAt: nextRetryAt.toISOString(),
      lastError: result.error,
    },
    "webhook retry: attempt failed — rescheduled with back-off",
  );

  return true;
}

/**
 * How long a row is allowed to stay in `processing` before we assume the
 * worker that claimed it crashed mid-flight and reclaim it as `pending`.
 * Configurable via WEBHOOK_RETRY_STALE_PROCESSING_MS (default: 10 minutes).
 */
const STALE_PROCESSING_MS =
  Number(process.env["WEBHOOK_RETRY_STALE_PROCESSING_MS"] ?? "") ||
  10 * 60_000;

/**
 * Reclaim rows that have been stuck in `processing` for longer than
 * STALE_PROCESSING_MS. This handles crashes or DB errors that occurred
 * after a row was claimed but before it was marked done/pending/dead.
 */
async function reclaimStaleProcessingRows(): Promise<void> {
  const staleThreshold = new Date(Date.now() - STALE_PROCESSING_MS);
  const reclaimed = await db
    .update(webhookRetryQueueTable)
    .set({
      status: "pending",
      nextRetryAt: new Date(), // retry immediately
      lastError: "reclaimed after stale processing timeout",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(webhookRetryQueueTable.status, "processing"),
        lte(webhookRetryQueueTable.updatedAt, staleThreshold),
      ),
    )
    .returning({ id: webhookRetryQueueTable.id });

  if (reclaimed.length > 0) {
    logger.warn(
      { count: reclaimed.length, staleThresholdMs: STALE_PROCESSING_MS },
      "webhook retry worker: reclaimed stale processing rows",
    );
  }
}

/**
 * One scheduler tick: reclaim stale rows then find all rows due for retry
 * and process them sequentially to avoid overloading the DB during an
 * outage recovery.
 */
async function tick(): Promise<void> {
  // Reclaim any rows stranded in 'processing' by a previous crashed worker.
  await reclaimStaleProcessingRows();

  // Find IDs of rows that are due — do not SELECT the full payload here to
  // keep the query lightweight. `processEntry` re-fetches the full row.
  const due = await db
    .select({ id: webhookRetryQueueTable.id })
    .from(webhookRetryQueueTable)
    .where(
      and(
        eq(webhookRetryQueueTable.status, "pending"),
        lte(webhookRetryQueueTable.nextRetryAt, sql`now()`),
      ),
    );

  if (due.length === 0) return;

  logger.info(
    { count: due.length },
    "webhook retry worker: processing due entries",
  );

  for (const { id } of due) {
    try {
      await processEntry(id);
    } catch (err) {
      // Unexpected error in processEntry itself (e.g. can't reach DB to
      // update status). Log and move on so one broken row doesn't stall the
      // rest of the batch.
      logger.error(
        { err, queueId: id },
        "webhook retry worker: unexpected error processing entry",
      );
    }
  }
}

let started = false;

/**
 * Start the webhook retry background worker. Idempotent — safe to call
 * multiple times; only the first call has any effect.
 */
export function startWebhookRetryWorker(): void {
  if (started) return;
  started = true;

  // Run once shortly after startup to pick up any entries that accumulated
  // while the server was down.
  setTimeout(() => {
    void tick().catch((err) =>
      logger.error({ err }, "webhook retry worker: initial tick failed"),
    );
  }, 10_000);

  setInterval(() => {
    void tick().catch((err) =>
      logger.error({ err }, "webhook retry worker: tick failed"),
    );
  }, TICK_MS);

  logger.info(
    { tickMs: TICK_MS, maxAttempts: MAX_ATTEMPTS },
    "webhook retry worker started",
  );
}
