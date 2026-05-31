import {
  boolean,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { usersTable } from "./users";

/**
 * Real-time behavioral state per user. Computed from `behavioral_events`
 * by the analytics engine and re-used by the Behavioral Orchestration layer
 * to shape AI model selection, tone, and depth for every coach turn.
 *
 * Updated asynchronously (fire-and-forget) after every state mutation;
 * read synchronously at the start of each coach request.
 *
 * Fields:
 *   energyLevel      [0.0 – 1.0]  recent completion velocity
 *   moodScore        [-1.0 – 1.0] rolling sentiment across messages
 *   cognitiveLoad    [0.0 – 1.0]  active task density × recency
 *   procrastinationRisk  "low" | "medium" | "high"
 *   flowDetected     rapid consecutive completions signal flow state
 *   peakHours        sorted list of hours (0–23) with highest completion rate
 *   motivationType   "deadline_driven" | "progress_driven" | "social" | "balanced"
 */
export const userBehavioralStateTable = pgTable("user_behavioral_state", {
  userId: integer("user_id")
    .primaryKey()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  energyLevel: real("energy_level").notNull().default(0.5),
  moodScore: real("mood_score").notNull().default(0.0),
  cognitiveLoad: real("cognitive_load").notNull().default(0.5),
  procrastinationRisk: text("procrastination_risk").notNull().default("low"),
  flowDetected: boolean("flow_detected").notNull().default(false),
  peakHours: jsonb("peak_hours").notNull().default([]),
  motivationType: text("motivation_type").notNull().default("balanced"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type UserBehavioralState =
  typeof userBehavioralStateTable.$inferSelect;
export type InsertUserBehavioralState =
  typeof userBehavioralStateTable.$inferInsert;
