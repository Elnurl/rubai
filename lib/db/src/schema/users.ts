import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  clerkUserId: text("clerk_user_id").notNull().unique(),
  email: text("email"),
  tier: text("tier").notNull().default("free"),
  // Expo push token captured on app open. Null on web or when permission
  // hasn't been granted. Used by the daily nudge scheduler.
  expoPushToken: text("expo_push_token"),
  // Minutes east of UTC at the time the device registered. Lets the
  // scheduler send nudges in the user's local morning regardless of where
  // the server runs.
  tzOffsetMinutes: integer("tz_offset_minutes"),
  // ISO date (YYYY-MM-DD) of the most recent morning nudge in the user's
  // local timezone. Used to dedupe — at most one morning nudge per day.
  lastMorningNudgeDate: text("last_morning_nudge_date"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type User = typeof usersTable.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
