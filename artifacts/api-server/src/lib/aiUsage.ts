import type { Request } from "express";
import type {
  ChatCompletion,
  ChatCompletionChunk,
  ChatCompletionCreateParamsNonStreaming,
  ChatCompletionCreateParamsStreaming,
} from "openai/resources/chat/completions";
import type { Stream } from "openai/streaming";
import { db, aiUsageTable } from "@workspace/db";
import {
  getAnthropic,
  isAnthropicConfigured,
} from "@workspace/integrations-anthropic-ai";
import { openai } from "@workspace/integrations-openai-ai-server";

import {
  fromAnthropicMessage,
  isRetryableProviderError,
  toAnthropicParams,
} from "./aiFailover";
import { logger } from "./logger";

/**
 * Wraps `openai.chat.completions.create` so every AI call is recorded in
 * the `ai_usage` table for cost monitoring and abuse detection.
 *
 * On a *retryable* OpenAI failure (429, 5xx, connection/timeout) the
 * request is automatically replayed against Anthropic Claude via the
 * `aiFailover` translator. The original OpenAI error is still recorded
 * with status="error" before the failover attempt so we can monitor
 * provider health independently of end-user success rate.
 *
 * The DB write is best-effort — a failure to record usage must NEVER
 * block the user-facing AI response. We log internally and move on.
 *
 * Route is derived from the Express request (e.g. "/atlas/coach"),
 * which is sufficient to slice usage by endpoint.
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

    if (isRetryableProviderError(err) && isAnthropicConfigured()) {
      req.log.warn(
        { err, route, model },
        "OpenAI call failed with retryable error; failing over to Anthropic",
      );
      return callAnthropicWithUsage(req, params);
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
 * Failover policy: if the *open* of the OpenAI stream fails with a
 * retryable error, we fall back to a non-streaming Anthropic call and
 * synthesise a single delta + final chunk so the SSE client keeps
 * working. We deliberately do NOT fall back once chunks have started
 * arriving — the consumer would receive a corrupted concatenation of
 * two different model outputs.
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
  // openai SDK v6 widened the streaming return type with private brand
  // fields. Use the call-site return type via a const-init pattern so we
  // never need to pin a hand-rolled Stream<ChatCompletionChunk> type.
  let stream: Awaited<ReturnType<typeof openStream>> | null = null;
  async function openStream() {
    return openai.chat.completions.create({
      ...params,
      stream: true,
      stream_options: { include_usage: true, ...(params.stream_options ?? {}) },
    });
  }

  // ---- Phase 1: open the OpenAI stream. Failover is only safe here.
  try {
    stream = await openStream();
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown OpenAI failure";
    if (userId) {
      void recordUsage({
        userId,
        route,
        model,
        inputTokens: null,
        outputTokens: null,
        latencyMs: Date.now() - start,
        status: "error",
        errorMessage: message.slice(0, 500),
      });
    }
    if (isRetryableProviderError(err) && isAnthropicConfigured()) {
      req.log.warn(
        { err, route, model },
        "OpenAI stream open failed; failing over to Anthropic non-streaming",
      );
      yield* fallbackStreamFromAnthropic(req, params);
      return;
    }
    throw err;
  }

  // ---- Phase 2: drain. Once we've yielded a chunk we cannot fail over.
  // stream is non-null here: Phase 1 either assigned it or returned/threw.
  if (!stream) return;
  try {
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

/**
 * Replay an OpenAI ChatCompletion request against Anthropic. Records
 * its own `ai_usage` row tagged with the Anthropic model name and a
 * "(failover)" suffix so dashboards can split provider mix from
 * counter-party totals. Errors here propagate — failover does not
 * cascade further.
 */
async function callAnthropicWithUsage(
  req: Request,
  openaiParams: ChatCompletionCreateParamsNonStreaming,
): Promise<ChatCompletion> {
  const start = Date.now();
  const userId = req.userId;
  const route = `${req.baseUrl ?? ""}${req.path ?? ""}` || "unknown";
  const aParams = toAnthropicParams(openaiParams);
  const failoverModel = `${aParams.model} (failover)`;
  try {
    const msg = await getAnthropic().messages.create(aParams);
    const completion = fromAnthropicMessage(
      msg,
      typeof openaiParams.model === "string" ? openaiParams.model : "unknown",
    );
    if (userId) {
      void recordUsage({
        userId,
        route,
        model: failoverModel,
        inputTokens: completion.usage?.prompt_tokens ?? null,
        outputTokens: completion.usage?.completion_tokens ?? null,
        latencyMs: Date.now() - start,
        status: "ok",
        errorMessage: null,
      });
    }
    return completion;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown Anthropic failure";
    if (userId) {
      void recordUsage({
        userId,
        route,
        model: failoverModel,
        inputTokens: null,
        outputTokens: null,
        latencyMs: Date.now() - start,
        status: "error",
        errorMessage: message.slice(0, 500),
      });
    }
    throw err;
  }
}

/**
 * Streaming-mode fallback: call Anthropic non-streaming, then emit the
 * full content as a single delta chunk plus a terminating chunk. This
 * lets SSE consumers (the coach client) keep their existing chunk
 * parsing logic. The user sees the response appear all-at-once instead
 * of token-by-token during a failover, which is acceptable degradation.
 */
async function* fallbackStreamFromAnthropic(
  req: Request,
  params: ChatCompletionCreateParamsStreaming,
): AsyncGenerator<ChatCompletionChunk, void, void> {
  const nonStreamingParams: ChatCompletionCreateParamsNonStreaming = {
    ...params,
    stream: false,
  };
  // stream_options is invalid on non-streaming requests; strip if present.
  delete (nonStreamingParams as { stream_options?: unknown }).stream_options;

  const completion = await callAnthropicWithUsage(req, nonStreamingParams);
  const content = completion.choices[0]?.message?.content ?? "";
  const baseId = completion.id;
  const created = completion.created;
  const usedModel = completion.model;

  yield {
    id: baseId,
    object: "chat.completion.chunk",
    created,
    model: usedModel,
    choices: [
      {
        index: 0,
        delta: { role: "assistant", content },
        finish_reason: null,
        logprobs: null,
      },
    ],
  } as ChatCompletionChunk;

  yield {
    id: baseId,
    object: "chat.completion.chunk",
    created,
    model: usedModel,
    choices: [
      {
        index: 0,
        delta: {},
        finish_reason: "stop",
        logprobs: null,
      },
    ],
    usage: {
      prompt_tokens: completion.usage?.prompt_tokens ?? 0,
      completion_tokens: completion.usage?.completion_tokens ?? 0,
      total_tokens: completion.usage?.total_tokens ?? 0,
    },
  } as ChatCompletionChunk;
}

export type RecordInput = {
  userId: number;
  route: string;
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
  latencyMs: number;
  status: "ok" | "error";
  errorMessage: string | null;
};

export async function recordUsage(input: RecordInput): Promise<void> {
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
