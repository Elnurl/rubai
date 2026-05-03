import { sql } from "drizzle-orm";
import {
  customType,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { usersTable } from "./users";

/**
 * pgvector column type. Drizzle has no first-class vector support yet, so
 * we wrap it with `customType`. The dimension is fixed at 1536 to match
 * OpenAI `text-embedding-3-small`. If we ever swap models we either keep
 * this table at 1536 (and project larger embeddings down) or add a sibling
 * table — do NOT change the dimension in place; the pgvector index is tied
 * to it.
 *
 * The driver value is sent as the pgvector text literal `[1,2,3]` because
 * `node-postgres` doesn't know about the `vector` type. On read we get
 * back a string and parse it.
 */
const vector = (name: string, dimensions: number) =>
  customType<{
    data: number[];
    driverData: string;
    config: { dimensions: number };
  }>({
    dataType() {
      return `vector(${dimensions})`;
    },
    toDriver(value: number[]): string {
      if (!Array.isArray(value)) {
        throw new TypeError("vector column expects number[]");
      }
      if (value.length !== dimensions) {
        throw new RangeError(
          `vector column expects ${dimensions} dimensions, got ${value.length}`,
        );
      }
      return `[${value.join(",")}]`;
    },
    fromDriver(value: string): number[] {
      // pgvector returns "[1,2,3]" as text. Strip brackets, split, parse.
      if (typeof value !== "string") return value as unknown as number[];
      const inner = value.slice(1, -1);
      if (inner.length === 0) return [];
      return inner.split(",").map(Number);
    },
  })(name);

/**
 * RAG corpus. One row per indexable chunk of user-generated text.
 *
 * `contentType` distinguishes the source so the retriever can filter
 * (e.g. weight reflections higher than coach summaries):
 *   - 'message'         : a single chat turn (currently unused; reserved)
 *   - 'reflection'      : user note attached to a completed/skipped task
 *   - 'learned_profile' : insight derived from cumulative behaviour
 *   - 'coach_memory'    : explicit fact the coach decided to remember
 *   - 'plan'            : a specific daily plan task description
 *   - 'evolution'       : roadmap-evolution summary
 *
 * `contentId` is a stable string key chosen by the indexer (e.g.
 * `goal:<goalId>:reflection:<idx>`). Combined with `userId` and
 * `contentType` it forms the upsert key — re-running the indexer is
 * idempotent.
 *
 * `goalId` is denormalised so retrieval can scope to the active goal
 * without joining back to `user_state`.
 */
export const embeddingsTable = pgTable(
  "embeddings",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    goalId: text("goal_id"),
    contentType: text("content_type").notNull(),
    contentId: text("content_id").notNull(),
    sourceText: text("source_text").notNull(),
    embedding: vector("embedding", 1536).notNull(),
    metadata: jsonb("metadata").notNull().default({}),
    model: text("model").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    // Idempotency: re-indexing the same source must update in place.
    uniqueSource: uniqueIndex("embeddings_user_type_content_uq").on(
      table.userId,
      table.contentType,
      table.contentId,
    ),
    // Retrieval is always filtered by user, usually by goal+type as well.
    userGoalTypeIdx: index("embeddings_user_goal_type_idx").on(
      table.userId,
      table.goalId,
      table.contentType,
    ),
    // Cosine-similarity HNSW index. Built with sql`` because Drizzle
    // doesn't model pgvector ops yet.
    embeddingIdx: index("embeddings_vec_hnsw_idx")
      .using("hnsw", sql`embedding vector_cosine_ops`),
  }),
);

export type EmbeddingRow = typeof embeddingsTable.$inferSelect;
export type InsertEmbedding = typeof embeddingsTable.$inferInsert;
