/**
 * Shared RevenueCat webhook processing logic used by both the inline webhook
 * handler and the background retry worker.
 *
 * Separating this from the route keeps the retry worker free of Express
 * request types and makes the core logic unit-testable in isolation.
 */

import { eq } from "drizzle-orm";
import {
  db,
  usersTable,
  subscriptionsTable,
  tierTransitionsTable,
} from "@workspace/db";
import {
  RC_ENTITLEMENT_PRO,
  RC_ENTITLEMENT_PREMIUM,
  tierFromEntitlements,
  tierFromProductId,
  type ActiveTier,
} from "./rcEntitlements";
import { sendTierChangedPushTo } from "./pushScheduler";

// Suppress "unused import" lint warnings — kept for completeness.
void RC_ENTITLEMENT_PRO;
void RC_ENTITLEMENT_PREMIUM;

export interface RcWebhookEvent {
  type: string;
  app_user_id?: string;
  original_app_user_id?: string;
  product_id?: string;
  store?: string;
  transaction_id?: string;
  expiration_at_ms?: number | null;
  entitlement_ids?: string[];
  event_timestamp_ms?: number | null;
}

/** Minimal logger interface accepted by processWebhookEvent. */
export interface EventLogger {
  info(obj: object, msg: string): void;
  warn(obj: object, msg: string): void;
  error(obj: object, msg: string): void;
}

export type ProcessResult =
  | { ok: true }
  | { ok: false; retryable: boolean; error: string };

const ACTIVE_STATUSES = new Set([
  "INITIAL_PURCHASE",
  "RENEWAL",
  "PRODUCT_CHANGE",
  "NON_RENEWING_PURCHASE",
  "UNCANCELLATION",
]);

const INACTIVE_STATUSES = new Set([
  "CANCELLATION",
  "EXPIRATION",
  "BILLING_ISSUE",
  "SUBSCRIBER_ALIAS",
]);

/**
 * Apply a RevenueCat webhook event to the database: upsert the subscription
 * row, update `users.tier`, and append a `tier_transitions` row when the
 * tier actually changes.
 *
 * Returns `{ ok: true }` on success.
 * Returns `{ ok: false, retryable: true, error }` for transient DB errors
 * that should be retried.
 * Returns `{ ok: false, retryable: false, error }` for permanent failures
 * (unknown event type, no user, etc.) that should NOT be retried.
 */
export async function processWebhookEvent(
  event: RcWebhookEvent,
  log: EventLogger,
): Promise<ProcessResult> {
  const isActive = ACTIVE_STATUSES.has(event.type);
  const isInactive = INACTIVE_STATUSES.has(event.type);

  if (!isActive && !isInactive) {
    return { ok: false, retryable: false, error: "unhandled_event_type" };
  }

  const clerkUserId =
    event.original_app_user_id ?? event.app_user_id ?? null;

  if (!clerkUserId) {
    return { ok: false, retryable: false, error: "no_user_id" };
  }

  const productId = event.product_id ?? "";
  const storeTransactionId = event.transaction_id ?? null;
  const provider = event.store?.toLowerCase() ?? "revenuecat";

  try {
    const user = await db.query.usersTable.findFirst({
      where: eq(usersTable.clerkUserId, clerkUserId),
    });

    if (!user) {
      log.warn(
        { clerkUserId, eventType: event.type },
        "processWebhookEvent: user not found — will not retry",
      );
      return { ok: false, retryable: false, error: "user_not_found" };
    }

    const status = isActive ? "active" : "canceled";
    const currentPeriodEnd = event.expiration_at_ms
      ? new Date(event.expiration_at_ms)
      : null;

    let newTier: ActiveTier = "free";
    if (isActive) {
      const entitlements = event.entitlement_ids ?? [];
      newTier =
        entitlements.length > 0
          ? tierFromEntitlements(entitlements)
          : tierFromProductId(productId);
    }

    const tierChanged = user.tier !== newTier;

    await db.transaction(async (tx) => {
      if (productId && storeTransactionId) {
        await tx
          .insert(subscriptionsTable)
          .values({
            userId: user.id,
            provider,
            productId,
            status,
            currentPeriodEnd,
            storeTransactionId,
            raw: event as unknown as Record<string, unknown>,
          })
          .onConflictDoUpdate({
            target: [
              subscriptionsTable.provider,
              subscriptionsTable.storeTransactionId,
            ],
            set: {
              status,
              currentPeriodEnd,
              raw: event as unknown as Record<string, unknown>,
              updatedAt: new Date(),
            },
          });
      }

      await tx
        .update(usersTable)
        .set({
          tier: newTier,
          updatedAt: new Date(),
        })
        .where(eq(usersTable.id, user.id));

      if (tierChanged) {
        await tx.insert(tierTransitionsTable).values({
          userId: user.id,
          fromTier: user.tier,
          toTier: newTier,
          triggeredBy: "webhook",
          eventType: event.type,
          metadata: {
            provider,
            productId: productId || null,
            storeTransactionId: storeTransactionId || null,
          },
        });
      }
    });

    log.info(
      { clerkUserId, eventType: event.type, provider, newTier, tierChanged },
      "processWebhookEvent: tier update applied",
    );

    // Fire-and-forget push notification — errors are swallowed so a bad
    // push token never causes the webhook processing to fail/retry.
    if (user.expoPushToken) {
      void sendTierChangedPushTo(user.expoPushToken, newTier).catch(() => {});
    }

    return { ok: true };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    log.error(
      { err, clerkUserId, eventType: event.type },
      "processWebhookEvent: DB transaction failed — retryable",
    );
    return { ok: false, retryable: true, error: errorMsg };
  }
}

/**
 * Build a stable idempotency key for a RevenueCat event so that duplicate
 * webhook deliveries map to the same queue row and are never double-applied.
 *
 * Priority:
 *   1. transaction_id  (most specific; unique per store transaction)
 *   2. event_timestamp_ms + clerkUserId  (fallback for events without a txn id)
 *   3. clerkUserId alone  (last resort)
 */
export function buildIdempotencyKey(event: RcWebhookEvent): string {
  const clerkUserId =
    event.original_app_user_id ?? event.app_user_id ?? "unknown";

  if (event.transaction_id) {
    return `${event.type}:txn:${event.transaction_id}`;
  }
  if (event.event_timestamp_ms != null) {
    return `${event.type}:${clerkUserId}:${event.event_timestamp_ms}`;
  }
  return `${event.type}:${clerkUserId}`;
}
