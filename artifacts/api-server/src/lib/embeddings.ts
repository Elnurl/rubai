import type { Request } from "express";

import { openai } from "@workspace/integrations-openai-ai-server";

import { recordUsage } from "./aiUsage";
import { logger } from "./logger";

/**
 * OpenAI embedding model used for the RAG corpus.
 *
 * Why text-embedding-3-small:
 *   - 1536 dimensions, matches the `embeddings.embedding` column.
 *   - $0.02 per 1M tokens — cheap enough to re-index aggressively.
 *   - Top-tier MTEB score among small models; sufficient for short
 *     coach-related text where we're matching semantic intent, not
 *     fine-grained nuance.
 *
 * If we ever bump to `text-embedding-3-large` (3072 dim) we MUST add a
 * separate column / table — pgvector indexes are dimension-locked.
 *
 * No Anthropic failover here: Anthropic does not expose embeddings, and
 * OpenAI's embeddings endpoint has very high availability. If it's down
 * we just skip indexing for that batch — retrieval simply has slightly
 * stale data.
 */
export const EMBEDDING_MODEL =
  process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small";
export const EMBEDDING_DIM = 1536;

// text-embedding-3-small accepts ~8191 tokens per input. We clamp to a
// safe character count rather than counting tokens — it's coarse but
// avoids a tokenizer dependency. A typical reflection or memory fact is
// well under this.
const MAX_INPUT_CHARS = 8000;

// OpenAI accepts up to 2048 inputs per request, but we use a much
// smaller batch so a single failure doesn't lose too much work.
const BATCH_SIZE = 96;

/**
 * Embed a batch of texts. Returns embeddings in input order. On failure
 * the entire call returns `null` for each text in the failing batch
 * (other batches succeed independently) — callers should treat null as
 * "skip this chunk for now, try again next index pass".
 */
export async function embedTexts(
  req: Request,
  texts: string[],
): Promise<Array<number[] | null>> {
  const out: Array<number[] | null> = new Array(texts.length).fill(null);
  if (texts.length === 0) return out;
  const userId = req.userId ?? null;
  const route = `${req.baseUrl ?? ""}${req.path ?? ""}` || "embeddings";

  for (let start = 0; start < texts.length; start += BATCH_SIZE) {
    const slice = texts.slice(start, start + BATCH_SIZE);
    const inputs = slice.map((t) => clampForEmbedding(t));
    const t0 = Date.now();
    try {
      const resp = await openai.embeddings.create({
        model: EMBEDDING_MODEL,
        input: inputs,
      });
      const latencyMs = Date.now() - t0;
      for (let i = 0; i < resp.data.length; i++) {
        out[start + i] = resp.data[i]!.embedding as unknown as number[];
      }
      if (userId) {
        void recordUsage({
          userId,
          route,
          model: EMBEDDING_MODEL,
          inputTokens: resp.usage?.prompt_tokens ?? null,
          outputTokens: 0,
          latencyMs,
          status: "ok",
          errorMessage: null,
        });
      }
    } catch (err) {
      const latencyMs = Date.now() - t0;
      const message =
        err instanceof Error ? err.message : "Unknown embedding failure";
      logger.warn(
        { err, route, userId, batchStart: start, batchSize: slice.length },
        "Embedding batch failed; chunks will be skipped this pass",
      );
      if (userId) {
        void recordUsage({
          userId,
          route,
          model: EMBEDDING_MODEL,
          inputTokens: null,
          outputTokens: 0,
          latencyMs,
          status: "error",
          errorMessage: message.slice(0, 500),
        });
      }
      // Leave slots null; callers skip them.
    }
  }
  return out;
}

export async function embedOne(
  req: Request,
  text: string,
): Promise<number[] | null> {
  const [v] = await embedTexts(req, [text]);
  return v ?? null;
}

function clampForEmbedding(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length <= MAX_INPUT_CHARS) return trimmed;
  // Take head + tail so we keep both context bookends if the middle is
  // long. Coach text rarely hits this, so a simple split is fine.
  const head = trimmed.slice(0, MAX_INPUT_CHARS - 2000);
  const tail = trimmed.slice(-2000);
  return `${head}\n…\n${tail}`;
}
