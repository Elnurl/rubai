import {
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { usersTable } from "./users";

/**
 * Append-only audit log for every `users.tier` change.
 *
 * A row is inserted whenever the resolved tier differs from the current
 * value — either via the RevenueCat webhook handler or the /me/sync-tier
 * endpoint. Rows are never updated or deleted so support can always
 * reconstruct the full transition history for a user.
 *
 * `triggered_by` is a short enum-like string:
 *   "webhook"   — change came from a RevenueCat webhook event
 *   "sync-tier" — change came from the mobile app's /me/sync-tier call
 *
 * `event_type` is the raw RevenueCat event type (e.g. "INITIAL_PURCHASE",
 * "EXPIRATION") when `triggered_by === "webhook"`, otherwise null.
 *
 * `metadata` holds extra context as a JSON object:
 *   webhook   → { provider, productId, storeTransactionId }
 *   sync-tier → {} (currently empty; reserved for future use)
 */
export const tierTransitionsTable = pgTable("tier_transitions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  fromTier: text("from_tier").notNull(),
  toTier: text("to_tier").notNull(),
  /** "webhook" | "sync-tier" */
  triggeredBy: text("triggered_by").notNull(),
  /** RevenueCat event type, e.g. "INITIAL_PURCHASE". Null for sync-tier. */
  eventType: text("event_type"),
  /** Extra structured context. */
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type TierTransition = typeof tierTransitionsTable.$inferSelect;
