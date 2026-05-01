import {
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

import { usersTable } from "./users";

/**
 * Per-call record of every OpenAI request the server makes on behalf of a
 * user. This is the source of truth for cost monitoring, abuse detection,
 * and per-user usage limits / soft caps.
 *
 * `route` examples: "atlas.coach" | "atlas.daily-plan" | "atlas.roadmap"
 * `status` examples: "ok" | "error" | "rate_limited"
 *
 * Token columns are nullable because some failure modes (network errors,
 * client cancellation) won't return a token count.
 */
export const aiUsageTable = pgTable(
  "ai_usage",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    route: text("route").notNull(),
    model: text("model").notNull(),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    latencyMs: integer("latency_ms"),
    status: text("status").notNull(),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    userIdx: index("ai_usage_user_idx").on(table.userId),
    createdAtIdx: index("ai_usage_created_idx").on(table.createdAt),
    routeIdx: index("ai_usage_route_idx").on(table.route),
  }),
);

export const insertAiUsageSchema = createInsertSchema(aiUsageTable).omit({
  id: true,
  createdAt: true,
});

export type AiUsage = typeof aiUsageTable.$inferSelect;
export type InsertAiUsage = z.infer<typeof insertAiUsageSchema>;
