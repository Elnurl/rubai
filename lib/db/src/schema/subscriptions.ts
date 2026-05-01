import {
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

import { usersTable } from "./users";

/**
 * Records the current and historical state of a user's paid subscription.
 *
 * NOTE: This table is intentionally generic so it can later be wired to
 * either RevenueCat (mobile in-app purchases on Apple / Google Play) or
 * Stripe (web subscriptions) without schema changes. Nothing currently
 * writes to this table — it exists so the database is ready when we add
 * payments. The user's effective entitlement is still mirrored to
 * `users.tier` for fast read-only checks on every request.
 *
 * `provider` examples: "revenuecat" | "stripe"
 * `status` examples:   "active" | "trialing" | "past_due" | "canceled" |
 *                      "expired" | "in_grace_period"
 */
export const subscriptionsTable = pgTable(
  "subscriptions",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    productId: text("product_id").notNull(),
    status: text("status").notNull(),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    storeTransactionId: text("store_transaction_id"),
    raw: jsonb("raw"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    // One active record per (provider, store transaction) so duplicate
    // webhook deliveries are idempotent.
    providerTxnUnique: uniqueIndex("subscriptions_provider_txn_uniq").on(
      table.provider,
      table.storeTransactionId,
    ),
  }),
);

export const insertSubscriptionSchema = createInsertSchema(
  subscriptionsTable,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type Subscription = typeof subscriptionsTable.$inferSelect;
export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;
