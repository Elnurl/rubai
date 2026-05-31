import {
  index,
  integer,
  jsonb,
  pgTable,
  real,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { usersTable } from "./users";

/**
 * Fine-grained behavioral event log — one row per user interaction.
 *
 * event_type examples:
 *   "message_sent"     — coach turn initiated
 *   "task_completed"   — user checked off a task
 *   "task_skipped"     — user marked task as skipped / reflected missed
 *   "task_created"     — new daily plan generated
 *   "coach_opened"     — coach screen entered
 *   "goal_viewed"      — goal/roadmap screen entered
 *
 * metadata is intentionally schemaless so we can enrich individual types
 * without migrations:
 *   { hourOfDay, dayOfWeek, sentimentScore, messageLength,
 *     taskId, taskTitle, completionSpeedMinutes, delayDays }
 */
export const behavioralEventsTable = pgTable(
  "behavioral_events",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    eventType: text("event_type").notNull(),
    sentimentScore: real("sentiment_score"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    userIdx: index("beh_events_user_idx").on(table.userId),
    createdAtIdx: index("beh_events_created_idx").on(table.createdAt),
    typeIdx: index("beh_events_type_idx").on(table.eventType),
    userCreatedIdx: index("beh_events_user_created_idx").on(
      table.userId,
      table.createdAt,
    ),
  }),
);

export type BehavioralEvent = typeof behavioralEventsTable.$inferSelect;
export type InsertBehavioralEvent =
  typeof behavioralEventsTable.$inferInsert;
