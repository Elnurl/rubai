import {
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

import { usersTable } from "./users";

/**
 * Generic event log for product analytics and basic operational visibility.
 *
 * Use this for events the owner cares about as a SaaS operator: sign-ups,
 * sign-ins, key feature usage, subscription state changes, etc. It is
 * intentionally schemaless via the `payload` jsonb column so we can add
 * new event types without migrations.
 *
 * Examples of `event_type`:
 *   "user.signed_up", "user.signed_in", "goal.created",
 *   "ai.coach_call", "subscription.activated"
 *
 * For high-volume per-AI-call usage data prefer `ai_usage` (which has
 * structured token/latency columns); reserve this table for lower-volume
 * business events that benefit from a flexible payload.
 */
export const analyticsEventsTable = pgTable(
  "analytics_events",
  {
    id: serial("id").primaryKey(),
    // Nullable so we can also log events that happen before a user is
    // created (e.g. "auth.failed_signup_attempt").
    userId: integer("user_id").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    eventType: text("event_type").notNull(),
    payload: jsonb("payload"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    eventTypeIdx: index("analytics_events_type_idx").on(table.eventType),
    createdAtIdx: index("analytics_events_created_idx").on(table.createdAt),
    userIdx: index("analytics_events_user_idx").on(table.userId),
  }),
);

export const insertAnalyticsEventSchema = createInsertSchema(
  analyticsEventsTable,
).omit({
  id: true,
  createdAt: true,
});

export type AnalyticsEvent = typeof analyticsEventsTable.$inferSelect;
export type InsertAnalyticsEvent = z.infer<typeof insertAnalyticsEventSchema>;
