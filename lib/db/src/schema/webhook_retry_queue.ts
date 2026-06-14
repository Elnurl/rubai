import {
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * Persistent retry queue for RevenueCat webhook events whose DB transaction
 * failed on first delivery (e.g. transient connection error).
 *
 * Flow:
 *  1. The webhook handler tries to apply the tier update inline.
 *  2. If the transaction fails it inserts a row here and returns HTTP 200
 *     so RevenueCat does NOT retry (we own the retry lifecycle from here).
 *  3. The background worker (`webhookRetryWorker`) polls every 30 s for
 *     rows with `status = 'pending'` and `next_retry_at <= now()`, runs the
 *     same processing logic, and either marks the row `done` or schedules a
 *     later attempt with exponential back-off.
 *  4. After `max_attempts` failures the row is moved to `dead` and a
 *     structured error log is emitted for ops to act on.
 *
 * `idempotency_key` is unique per (event_type, transaction_id/timestamp) so
 * duplicate deliveries from RC never produce a second queue entry.
 *
 * `status` values:
 *   pending    — awaiting next attempt
 *   processing — actively being worked (guards against concurrent workers)
 *   done       — successfully applied
 *   dead       — exhausted retries; requires manual intervention
 */
export const webhookRetryQueueTable = pgTable(
  "webhook_retry_queue",
  {
    id: serial("id").primaryKey(),
    /** Dedup key: "<event_type>:<transaction_id>" or "<event_type>:<clerk_user_id>:<event_timestamp_ms>" */
    idempotencyKey: text("idempotency_key").notNull(),
    eventType: text("event_type").notNull(),
    clerkUserId: text("clerk_user_id"),
    /** Full RcWebhookEvent JSON as received from RevenueCat. */
    payload: jsonb("payload").notNull(),
    /** pending | processing | done | dead */
    status: text("status").notNull().default("pending"),
    attemptCount: integer("attempt_count").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(10),
    /** When the worker should next attempt this row. */
    nextRetryAt: timestamp("next_retry_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    /** Human-readable error from the last failed attempt. */
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    idempotencyUniq: uniqueIndex("webhook_retry_queue_idempotency_key_uniq").on(
      table.idempotencyKey,
    ),
    statusNextRetryIdx: index("webhook_retry_queue_status_next_retry_idx").on(
      table.status,
      table.nextRetryAt,
    ),
  }),
);

export type WebhookRetryQueueRow =
  typeof webhookRetryQueueTable.$inferSelect;
