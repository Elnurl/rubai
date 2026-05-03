import type { Request } from "express";
import { sql } from "drizzle-orm";

import { db } from "@workspace/db";

import { embedOne } from "./embeddings";
import { logger } from "./logger";

/**
 * Phase 2 RAG retrieval. Embeds the user's latest turn and pulls the
 * top-K nearest chunks from `embeddings` (cosine distance), scoped to
 * the requesting user. The result is a pre-formatted text block ready
 * to drop into the coach system prompt — never the raw vectors.
 *
 * Design notes:
 *   - We always filter by user_id. There is no cross-user retrieval.
 *   - We do NOT filter by goalId here. The active-goal context is
 *     already injected by buildCoachContext; semantic retrieval is
 *     allowed to surface a relevant chunk from another goal if it
 *     happens to be a closer match (rare, but useful for users with
 *     multiple goals).
 *   - We skip injection entirely when the top-K result set is smaller
 *     than MIN_RESULTS_FOR_INJECTION — for users with little indexed
 *     history the retrieval is more noise than signal and the
 *     buildCoachContext block is already comprehensive.
 *   - Distance threshold MAX_COSINE_DISTANCE drops irrelevant matches.
 *     pgvector cosine distance is in [0, 2]; ~0.4 is a reasonable
 *     "loosely related" cutoff for text-embedding-3-small in our
 *     domain (short coach text). Tuned empirically.
 *   - On any failure (embedding API down, DB error) we log and return
 *     null. Retrieval must never fail the coach turn.
 */

const DEFAULT_TOP_K = 6;
const MIN_RESULTS_FOR_INJECTION = 2;
const MAX_COSINE_DISTANCE = 0.45;
const MAX_CHARS_PER_CHUNK = 320;
// Hard latency budget for the entire retrieval pipeline (embedding API
// call + pgvector query). The coach turn is awaiting this inline before
// the LLM streaming/completion starts, so a slow OpenAI embeddings
// endpoint or DB hiccup must not stall user-visible response. On
// timeout we just skip injection — the coach still has buildCoachContext.
const RETRIEVAL_TIMEOUT_MS = 350;

type RetrievedChunk = {
  sourceText: string;
  contentType: string;
  goalId: string | null;
  distance: number;
};

export async function retrieveRelevantContext(
  req: Request,
  userId: number,
  queryText: string,
  opts: { topK?: number; timeoutMs?: number } = {},
): Promise<string | null> {
  const trimmed = queryText.trim();
  if (trimmed.length === 0) return null;

  const timeoutMs = opts.timeoutMs ?? RETRIEVAL_TIMEOUT_MS;
  const inner = retrieveInner(req, userId, trimmed, opts.topK ?? DEFAULT_TOP_K);
  const timeout = new Promise<null>((resolve) => {
    setTimeout(() => resolve(null), timeoutMs).unref?.();
  });
  const result = await Promise.race([inner, timeout]);
  if (result === null && (await isInnerStillPending(inner))) {
    req.log.info?.(
      { userId, timeoutMs },
      "RAG retrieval: timed out, skipping injection",
    );
  }
  return result;
}

// Tiny helper to surface whether the timeout fired vs the inner returned
// null on its own merits (both surface as `null` to the caller). Done by
// racing the same promise against a sentinel — by the time we re-await,
// the original promise has already resolved if the inner won.
async function isInnerStillPending(p: Promise<string | null>): Promise<boolean> {
  const sentinel = Symbol("pending");
  const winner = await Promise.race([
    p.then(() => "settled" as const),
    Promise.resolve(sentinel),
  ]);
  return winner === sentinel;
}

async function retrieveInner(
  req: Request,
  userId: number,
  trimmed: string,
  topK: number,
): Promise<string | null> {
  const t0 = Date.now();

  let vector: number[] | null = null;
  try {
    vector = await embedOne(req, trimmed);
  } catch (err) {
    logger.warn({ err, userId }, "RAG retrieval: embed query failed");
    return null;
  }
  if (!vector || vector.length === 0) return null;

  // pgvector accepts the text literal `[1,2,3]::vector`. We send it as a
  // bound parameter and cast in SQL so node-postgres treats it as text.
  const vecLiteral = `[${vector.join(",")}]`;

  let rows: RetrievedChunk[];
  try {
    const result = await db.execute<{
      source_text: string;
      content_type: string;
      goal_id: string | null;
      distance: number;
    }>(sql`
      SELECT
        source_text,
        content_type,
        goal_id,
        (embedding <=> ${vecLiteral}::vector)::float8 AS distance
      FROM embeddings
      WHERE user_id = ${userId}
      ORDER BY embedding <=> ${vecLiteral}::vector ASC
      LIMIT ${topK}
    `);
    // drizzle's db.execute returns either { rows } (pg) or an array
    // depending on driver. Normalize.
    const list = Array.isArray(result)
      ? (result as unknown as Array<{
          source_text: string;
          content_type: string;
          goal_id: string | null;
          distance: number;
        }>)
      : ((result as { rows?: unknown[] }).rows ?? []) as Array<{
          source_text: string;
          content_type: string;
          goal_id: string | null;
          distance: number;
        }>;
    rows = list.map((r) => ({
      sourceText: r.source_text,
      contentType: r.content_type,
      goalId: r.goal_id,
      distance: typeof r.distance === "number" ? r.distance : Number(r.distance),
    }));
  } catch (err) {
    logger.warn({ err, userId }, "RAG retrieval: vector query failed");
    return null;
  }

  const filtered = rows.filter(
    (r) =>
      Number.isFinite(r.distance) &&
      r.distance <= MAX_COSINE_DISTANCE &&
      r.sourceText.trim().length > 0,
  );
  if (filtered.length < MIN_RESULTS_FOR_INJECTION) {
    req.log.debug?.(
      {
        userId,
        latencyMs: Date.now() - t0,
        rawCount: rows.length,
        keptCount: filtered.length,
      },
      "RAG retrieval: below injection threshold",
    );
    return null;
  }

  const block = formatRetrievalBlock(filtered);
  req.log.info?.(
    {
      userId,
      latencyMs: Date.now() - t0,
      rawCount: rows.length,
      keptCount: filtered.length,
      topDistance: filtered[0]?.distance,
    },
    "RAG retrieval: injected",
  );
  return block;
}

export function formatRetrievalBlock(chunks: RetrievedChunk[]): string {
  const lines = chunks.map((c) => {
    const text = c.sourceText.length > MAX_CHARS_PER_CHUNK
      ? `${c.sourceText.slice(0, MAX_CHARS_PER_CHUNK).trimEnd()}…`
      : c.sourceText;
    return `- [${c.contentType}] ${text}`;
  });
  return lines.join("\n");
}
