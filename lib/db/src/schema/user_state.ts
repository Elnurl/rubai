import {
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

import { usersTable } from "./users";

export const userStateTable = pgTable("user_state", {
  userId: integer("user_id")
    .primaryKey()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  goals: jsonb("goals").notNull().default([]),
  activeGoalId: text("active_goal_id"),
  accountPrefs: jsonb("account_prefs").notNull().default({}),
  pendingDraft: jsonb("pending_draft"),
  version: integer("version").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertUserStateSchema = createInsertSchema(userStateTable).omit({
  updatedAt: true,
});

export type UserState = typeof userStateTable.$inferSelect;
export type InsertUserState = z.infer<typeof insertUserStateSchema>;
