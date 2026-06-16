import { openai } from "@workspace/integrations-openai-ai-server";

import { logger } from "./logger";

/**
 * Centralised model selection + small AI-side helpers.
 *
 * Model names are env-driven so we can A/B test or swap to a new model
 * without a code change. Defaults match the previously-hardcoded values
 * in `routes/atlas.ts` so a missing env var is a no-op upgrade.
 *
 * `MODEL_SMART`  — high-reasoning roadmap / daily-plan / behavioural work
 * `MODEL_FAST`   — short conversational coach replies
 * `MODEL_VISION` — coach turns that include an inline image
 * `MODEL_MODERATION` — input safety classifier (cheap, used per-turn)
 */
export const MODEL_SMART = process.env.OPENAI_MODEL_SMART ?? "gpt-4o";
export const MODEL_FAST = process.env.OPENAI_MODEL_FAST ?? "gpt-4o-mini";
export const MODEL_VISION = process.env.OPENAI_MODEL_VISION ?? "gpt-4o";
export const MODEL_MODERATION =
  process.env.OPENAI_MODEL_MODERATION ?? "omni-moderation-latest";

/**
 * Anthropic equivalents used by the failover wrapper in `aiUsage.ts`.
 * When OpenAI returns a retryable error (429, 5xx, connection/timeout)
 * the request is replayed against Claude. Models are chosen to match
 * the latency / cost tier of the OpenAI counterpart so behaviour stays
 * comparable. Vision uses sonnet because haiku lacks rich image
 * reasoning and opus has parameter restrictions that complicate
 * pass-through.
 */
export const ANTHROPIC_MODEL_SMART =
  process.env.ANTHROPIC_MODEL_SMART ?? "claude-sonnet-4-6";
export const ANTHROPIC_MODEL_FAST =
  process.env.ANTHROPIC_MODEL_FAST ?? "claude-haiku-4-5";
export const ANTHROPIC_MODEL_VISION =
  process.env.ANTHROPIC_MODEL_VISION ?? "claude-sonnet-4-6";

export type ModelChoice = "smart" | "fast" | "auto" | undefined;

/**
 * Pick a coach model.
 *
 * - Explicit "smart"/"fast" honours the user's manual override.
 * - Explicit "auto" enables the heuristic: short, early-conversation
 *   turns get the fast model, anything else gets smart.
 * - `undefined` preserves the existing API contract (default = smart).
 *   The OpenAPI schema documents only `smart|fast`, so an unset
 *   `modelChoice` must keep behaving exactly as before. Auto-mode is
 *   opt-in and gated on a future schema bump.
 */
export function pickCoachModel(input: {
  choice: ModelChoice;
  userMessageLength: number;
  historyTurns: number;
  hasImage: boolean;
}): string {
  if (input.hasImage) return MODEL_VISION;
  if (input.choice === "fast") return MODEL_FAST;
  if (input.choice === "auto") {
    const isShort = input.userMessageLength <= 80;
    const isEarly = input.historyTurns <= 2;
    return isShort && isEarly ? MODEL_FAST : MODEL_SMART;
  }
  // "smart" or undefined → smart (matches existing API contract).
  return MODEL_SMART;
}

/**
 * Run text through OpenAI's moderation endpoint. Throws `ModerationError`
 * when the input is flagged so the caller can surface a clean 4xx
 * instead of feeding hostile content into the coach prompt.
 *
 * Failures of the moderation call itself (network, 5xx) are logged and
 * swallowed — we never want safety telemetry to take the coach down.
 */
export class ModerationError extends Error {
  readonly categories: string[];
  constructor(categories: string[]) {
    super(`Input flagged by moderation: ${categories.join(", ")}`);
    this.name = "ModerationError";
    this.categories = categories;
  }
}

/**
 * Hard cap on text we'll moderate in a single call. Inputs longer than
 * this are rejected by the caller (see `MAX_MODERATION_BYTES`) rather
 * than truncated — truncation would let harmful content past the
 * classifier while still reaching the generation model.
 */
export const MAX_MODERATION_CHARS = 8000;

export async function moderateOrThrow(text: string): Promise<void> {
  const trimmed = text.trim();
  if (trimmed.length === 0) return;
  if (trimmed.length > MAX_MODERATION_CHARS) {
    // Treat as flagged so the caller surfaces a clean 4xx. We deliberately
    // do NOT truncate-and-moderate; that would create a silent bypass.
    throw new ModerationError(["input_too_long"]);
  }
  try {
    const result = await openai.moderations.create({
      model: MODEL_MODERATION,
      input: trimmed,
    });
    const first = result.results[0];
    if (first?.flagged) {
      const categories = Object.entries(first.categories ?? {})
        .filter(([, v]) => v === true)
        .map(([k]) => k);
      throw new ModerationError(categories);
    }
  } catch (err) {
    if (err instanceof ModerationError) throw err;
    logger.warn({ err }, "moderation call failed; allowing through");
  }
}
