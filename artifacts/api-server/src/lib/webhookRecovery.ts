/**
 * Webhook recovery helpers.
 *
 * When a RevenueCat purchase webhook arrives before the buyer's user row has
 * been created (sign-up race), the event is enqueued in `webhook_retry_queue`
 * with lastError = "user_not_found".  The background worker keeps retrying
 * with exponential back-off, but it can only succeed once the user row exists.
 *
 * `replayWebhookEventsForUser` is called fire-and-forget after a new user row
 * is created so that any queued purchase events are immediately re-scheduled
 * for the next worker tick — bypassing the remaining back-off wait.
 */

import { and, eq, inArray } from "drizzle-orm";
import { db, webhookRetryQueueTable } from "@workspace/db";
import { logger } from "./logger";

/**
 * Reset any pending or dead "user_not_found" webhook retry queue entries for
 * the given authUserId so the background worker picks them up on the next
 * tick.  Safe to call even when no such entries exist.
 *
 * @param authUserId  The Auth user ID of the newly created user row.
 */
export async function replayWebhookEventsForUser(
  authUserId: string,
): Promise<void> {
  const replayed = await db
    .update(webhookRetryQueueTable)
    .set({
      status: "pending",
      attemptCount: 0,
      nextRetryAt: new Date(),
      lastError: "replayed_after_user_creation",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(webhookRetryQueueTable.authUserId, authUserId),
        inArray(webhookRetryQueueTable.status, ["pending", "dead"]),
        eq(webhookRetryQueueTable.lastError, "user_not_found"),
      ),
    )
    .returning({ id: webhookRetryQueueTable.id });

  if (replayed.length > 0) {
    logger.info(
      {
        authUserId,
        count: replayed.length,
        ids: replayed.map((r) => r.id),
      },
      "webhook recovery: replayed pending/dead user_not_found entries after user creation",
    );
  }
}
