import type { Request } from "express";
import type OpenAI from "openai";
import { trackedCreate } from "./aiUsage.js";

export type StrictJsonErrorKind =
  | "refusal"
  | "empty"
  | "parse"
  | "validation";

export class StrictJsonError extends Error {
  readonly kind: StrictJsonErrorKind;
  readonly details?: unknown;

  constructor(kind: StrictJsonErrorKind, message: string, details?: unknown) {
    super(message);
    this.name = "StrictJsonError";
    this.kind = kind;
    this.details = details;
  }
}

export interface StrictJsonValidator<T> {
  parse: (raw: unknown) => T;
}

export function parseAndValidate<T>(
  content: string | null | undefined,
  refusal: string | null | undefined,
  validator: StrictJsonValidator<T>,
): T {
  if (typeof refusal === "string" && refusal.trim().length > 0) {
    throw new StrictJsonError(
      "refusal",
      "Model refused to comply with the request",
      { refusal },
    );
  }
  if (!content || content.trim().length === 0) {
    throw new StrictJsonError("empty", "Empty model response");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (err) {
    throw new StrictJsonError("parse", "Invalid JSON in model response", {
      err: (err as Error).message,
      snippet: content.slice(0, 200),
    });
  }
  try {
    return validator.parse(parsed);
  } catch (err) {
    throw new StrictJsonError(
      "validation",
      "Model output failed schema validation",
      { err: (err as Error).message },
    );
  }
}

type ChatParams = OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming;

function withRetryAddendum(
  params: ChatParams,
  err: StrictJsonError,
): ChatParams {
  // Surface concrete validation/parse details (e.g. Zod issue paths) so the
  // model knows what to fix, not just that something was wrong.
  let detailHint = err.message;
  if (err.details && typeof err.details === "object") {
    const d = err.details as { err?: string; snippet?: string };
    if (d.err) detailHint = d.err;
  }
  const addendum: OpenAI.Chat.Completions.ChatCompletionMessageParam = {
    role: "system",
    content:
      "Your previous response could not be parsed or validated against the required schema. " +
      "Respond ONLY with strictly valid JSON that exactly matches the response_format schema. " +
      "No prose, no markdown fences, no commentary. " +
      `Failure (${err.kind}): ${detailHint.slice(0, 320)}`,
  };
  return { ...params, messages: [...params.messages, addendum] };
}

export interface StrictJsonOptions {
  maxRetries?: number;
}

export async function strictJsonCompletion<T>(
  req: Request,
  params: ChatParams,
  validator: StrictJsonValidator<T>,
  opts: StrictJsonOptions = {},
): Promise<T> {
  const maxRetries = opts.maxRetries ?? 1;
  let lastErr: StrictJsonError | null = null;
  let currentParams = params;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const completion = await trackedCreate(req, currentParams);
    const choice = completion.choices[0];
    const message = choice?.message;
    try {
      return parseAndValidate(
        message?.content ?? null,
        (message as { refusal?: string | null } | undefined)?.refusal ?? null,
        validator,
      );
    } catch (err) {
      if (!(err instanceof StrictJsonError)) throw err;
      // Refusals are intentional and never retried.
      if (err.kind === "refusal") throw err;
      lastErr = err;
      req.log.warn(
        { kind: err.kind, attempt, details: err.details },
        "strictJsonCompletion attempt failed",
      );
      if (attempt < maxRetries) {
        currentParams = withRetryAddendum(params, err);
      }
    }
  }
  throw lastErr ?? new StrictJsonError("empty", "strictJsonCompletion exhausted retries");
}
