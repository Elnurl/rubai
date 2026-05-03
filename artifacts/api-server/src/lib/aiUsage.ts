import type { Request } from "express";
import type {
  ChatCompletion,
  ChatCompletionChunk,
  ChatCompletionCreateParamsNonStreaming,
  ChatCompletionCreateParamsStreaming,
} from "openai/resources/chat/completions";
import type { Stream } from "openai/streaming";
import { db, aiUsageTable } from "@workspace/db";
import { openai } from "@workspace/integrations-openai-ai-server";

import { logger } from "./logger";

/**
 * Wraps `openai.chat.completions.create` so every AI call is recorded in
 * the `ai_usage` table for cost monitoring and abuse detection.
 *
 * The DB write is best-effort — a failure to record usage must NEVER
 * block the user-facing AI response. We log internally and move on.
 *
 * Route is derived from the Express request (e.g. "/atlas/coach"),
 * which is sufficient to slice usage by endpoint.
 *
 * NOTE: this wrapper is non-streaming only. The OpenAI SDK's
 * `create(...)` overloads return `Stream<...>` when `stream: true`, and
 * token usage is not available on the same `usage` shape. If/when a
 * route needs streaming, add a sibling `trackedCreateStream` helper
 * that aggregates tokens from chunk metadata before recording.
 */
export async function trackedCreate(
  req: Request,
  params: ChatCompletionCreateParamsNonStreaming,
): Promise<ChatCompletion> {
  const start = Date.now();
  const userId = req.userId;
  const route = `${req.baseUrl ?? ""}${req.path ?? ""}` || "unknown";
  const model = typeof params.model === "string" ? params.model : "unknown";

  try {
    const completion = await openai.chat.completions.create(params);
    const latencyMs = Date.now() - start;

    if (userId) {
      const usage = completion.usage;
      void recordUsage({
        userId,
        route,
        model,
        inputTokens: usage?.prompt_tokens ?? null,
        outputTokens: usage?.completion_tokens ?? null,
        latencyMs,
        status: "ok",
        errorMessage: null,
      });
    }

    return completion;
  } catch (err) {
    const latencyMs = Date.now() - start;
    const message =
      err instanceof Error ? err.message : "Unknown OpenAI failure";

    if (userId) {
      void recordUsage({
        userId,
        route,
        model,
        inputTokens: null,
        outputTokens: null,
        latencyMs,
        status: "error",
        errorMessage: message.slice(0, 500),
      });
    }
    throw err;
  }
}

/**
 * Streaming sibling of `trackedCreate`. Yields each chunk to the caller
 * and records a single `ai_usage` row when the stream ends (or errors).
 *
 * Token usage is reported by OpenAI on the *last* chunk when the
 * `stream_options.include_usage` flag is set; we force it on so server
 * code never has to remember. Latency is measured wall-clock from
 * stream open to final chunk (not first byte) so dashboards stay
 * comparable to the non-streaming call path.
 *
 * Errors mid-stream still produce an "error" usage row before the
 * exception propagates, so partial-failure cost stays observable.
 */
export async function* trackedStream(
  req: Request,
  params: ChatCompletionCreateParamsStreaming,
): AsyncGenerator<ChatCompletionChunk, void, void> {
  const start = Date.now();
  const userId = req.userId;
  const route = `${req.baseUrl ?? ""}${req.path ?? ""}` || "unknown";
  const model = typeof params.model === "string" ? params.model : "unknown";

  let usage: ChatCompletionChunk["usage"] | null = null;
  let stream: Stream<ChatCompletionChunk> | null = null;

  try {
    stream = await openai.chat.completions.create({
      ...params,
      stream: true,
      stream_options: { include_usage: true, ...(params.stream_options ?? {}) },
    });

    for await (const chunk of stream) {
      if (chunk.usage) usage = chunk.usage;
      yield chunk;
    }

    if (userId) {
      void recordUsage({
        userId,
        route,
        model,
        inputTokens: usage?.prompt_tokens ?? null,
        outputTokens: usage?.completion_tokens ?? null,
        latencyMs: Date.now() - start,
        status: "ok",
        errorMessage: null,
      });
    }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown OpenAI failure";
    if (userId) {
      void recordUsage({
        userId,
        route,
        model,
        inputTokens: usage?.prompt_tokens ?? null,
        outputTokens: usage?.completion_tokens ?? null,
        latencyMs: Date.now() - start,
        status: "error",
        errorMessage: message.slice(0, 500),
      });
    }
    throw err;
  }
}

type RecordInput = {
  userId: number;
  route: string;
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
  latencyMs: number;
  status: "ok" | "error";
  errorMessage: string | null;
};

async function recordUsage(input: RecordInput): Promise<void> {
  try {
    await db.insert(aiUsageTable).values({
      userId: input.userId,
      route: input.route,
      model: input.model,
      inputTokens: input.inputTokens,
      outputTokens: input.outputTokens,
      latencyMs: input.latencyMs,
      status: input.status,
      errorMessage: input.errorMessage,
    });
  } catch (err) {
    logger.warn(
      { err, route: input.route, userId: input.userId },
      "Failed to record AI usage",
    );
  }
}
