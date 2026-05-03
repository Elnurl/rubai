import type {
  ChatCompletion,
  ChatCompletionContentPart,
  ChatCompletionCreateParamsNonStreaming,
  ChatCompletionMessageParam,
} from "openai/resources/chat/completions";
import type { AnthropicClient } from "@workspace/integrations-anthropic-ai";

import {
  ANTHROPIC_MODEL_FAST,
  ANTHROPIC_MODEL_SMART,
  ANTHROPIC_MODEL_VISION,
  MODEL_FAST,
  MODEL_VISION,
} from "./aiConfig";

// Anthropic SDK does not expose its sub-resource type module via its
// `exports` map under TS's bundler resolution, so we derive the request
// param shape from the client method instead of importing it.
type MessageCreateParamsNonStreaming = Parameters<
  AnthropicClient["messages"]["create"]
>[0] & { stream?: false | null };
type MessageParam = MessageCreateParamsNonStreaming["messages"][number];
type ContentBlocks = Exclude<MessageParam["content"], string>;
type ContentBlock = ContentBlocks[number];
type TextBlockParam = Extract<ContentBlock, { type: "text" }>;
type ImageBlockParam = Extract<ContentBlock, { type: "image" }>;
type Tool = {
  name: string;
  description?: string;
  input_schema: { type: "object"; [k: string]: unknown };
};
type ToolUseBlock = { type: "tool_use"; input?: unknown };

/**
 * Failure-class detection for the OpenAI → Anthropic failover.
 *
 * Retry only on transient/server-side problems where a different
 * provider could plausibly succeed:
 *   - 429: rate / quota
 *   - 408: request timeout (provider-side)
 *   - 5xx: server error
 *   - SDK connection / timeout subclasses
 *   - low-level socket failures (ECONNRESET, etc.) — these often appear
 *     as `err.cause.code` when undici/fetch wraps them
 *   - `TypeError: fetch failed` style errors from the global fetch
 *
 * NEVER retry on:
 *   - 4xx (other than 408/429): bad input, auth — Anthropic will fail too
 *   - User-initiated AbortError / APIUserAbortError: client doesn't
 *     want a response
 */
const RETRYABLE_NAMES = new Set([
  "APIConnectionError",
  "APIConnectionTimeoutError",
  "APITimeoutError",
  "TimeoutError",
  "FetchError",
]);

const RETRYABLE_CODES = new Set([
  "ECONNRESET",
  "ETIMEDOUT",
  "ENOTFOUND",
  "ECONNREFUSED",
  "EAI_AGAIN",
  "EPIPE",
  "UND_ERR_SOCKET",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_HEADERS_TIMEOUT",
  "UND_ERR_BODY_TIMEOUT",
]);

function walkErrorChain(err: unknown): {
  names: string[];
  codes: string[];
  messages: string[];
} {
  const names: string[] = [];
  const codes: string[] = [];
  const messages: string[] = [];
  let cur: unknown = err;
  // Cap depth to avoid pathological cycles in malformed errors.
  for (let depth = 0; cur && typeof cur === "object" && depth < 5; depth++) {
    const e = cur as {
      name?: string;
      code?: string;
      message?: string;
      cause?: unknown;
    };
    if (typeof e.name === "string") names.push(e.name);
    if (typeof e.code === "string") codes.push(e.code);
    if (typeof e.message === "string") messages.push(e.message);
    cur = e.cause;
  }
  return { names, codes, messages };
}

export function isRetryableProviderError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { name?: string; status?: number; message?: string };

  // User abort — propagate, never retry. Check both undici and SDK names.
  if (e.name === "AbortError" || e.name === "APIUserAbortError") return false;

  // HTTP status from the SDK is the strongest signal when present.
  if (typeof e.status === "number") {
    if (e.status === 408 || e.status === 429) return true;
    if (e.status >= 500 && e.status < 600) return true;
    return false;
  }

  const { names, codes, messages } = walkErrorChain(err);
  if (names.some((n) => RETRYABLE_NAMES.has(n))) return true;
  if (codes.some((c) => RETRYABLE_CODES.has(c))) return true;
  // Global fetch surfaces network failures as `TypeError: fetch failed`
  // with the underlying socket error nested in `cause`. The codes loop
  // above usually catches the cause, but message-only failures get
  // covered here as a safety net.
  if (
    names.includes("TypeError") &&
    messages.some((m) => /fetch failed|network|socket hang up/i.test(m))
  )
    return true;
  return false;
}

export function pickAnthropicModel(openaiModel: string): string {
  if (openaiModel === MODEL_VISION) return ANTHROPIC_MODEL_VISION;
  if (openaiModel === MODEL_FAST) return ANTHROPIC_MODEL_FAST;
  return ANTHROPIC_MODEL_SMART;
}

/**
 * Convert one OpenAI `messages[i].content` value to the Anthropic
 * block-array shape. OpenAI lets `content` be either a string or an
 * array of typed parts; Anthropic wants either a string or an array
 * of blocks. We always produce blocks when the input is an array so
 * mixed text+image turns round-trip correctly.
 *
 * Image data URLs are decoded to Anthropic's `base64` source. Plain
 * https URLs use Anthropic's `url` source. Unknown content types
 * collapse to empty text rather than throwing — failover should
 * degrade gracefully rather than abort the whole request.
 */
function convertContent(
  content: ChatCompletionMessageParam["content"],
): string | Array<TextBlockParam | ImageBlockParam> {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return String(content ?? "");
  const blocks: Array<TextBlockParam | ImageBlockParam> = [];
  for (const part of content as ChatCompletionContentPart[]) {
    if (part.type === "text") {
      blocks.push({ type: "text", text: part.text ?? "" });
      continue;
    }
    if (part.type === "image_url") {
      const url = part.image_url?.url ?? "";
      const dataUrl = /^data:([^;]+);base64,(.+)$/.exec(url);
      if (dataUrl) {
        const mediaType = dataUrl[1] as
          | "image/jpeg"
          | "image/png"
          | "image/gif"
          | "image/webp";
        blocks.push({
          type: "image",
          source: {
            type: "base64",
            media_type: mediaType,
            data: dataUrl[2] ?? "",
          },
        });
      } else if (url) {
        blocks.push({
          type: "image",
          source: { type: "url", url },
        });
      }
      continue;
    }
    // unknown / unsupported content part → skip silently
  }
  return blocks.length > 0 ? blocks : "";
}

/**
 * Translate an OpenAI ChatCompletion request to an Anthropic Messages
 * request. The two big shape differences handled here:
 *
 *   1. Anthropic requires `max_tokens` and rejects `max_completion_tokens`.
 *      We accept either name from the caller and clamp to the
 *      integration's 8192 ceiling.
 *   2. Anthropic has no native `response_format: json_schema`. We emulate
 *      strict JSON output by exposing the schema as a single tool and
 *      forcing `tool_choice` to it. The model's `tool_use.input` is the
 *      schema-shaped object, which we later JSON-stringify so the OpenAI
 *      callsite (which expects `choices[0].message.content` to be a JSON
 *      string) keeps working unchanged.
 *
 * `system` messages are concatenated and lifted out — Anthropic takes
 * them as a top-level field, not as an entry in `messages`.
 */
export function toAnthropicParams(
  params: ChatCompletionCreateParamsNonStreaming,
): MessageCreateParamsNonStreaming {
  const systemParts: string[] = [];
  const messages: MessageParam[] = [];
  for (const m of params.messages) {
    if (m.role === "system" || m.role === "developer") {
      const c =
        typeof m.content === "string"
          ? m.content
          : Array.isArray(m.content)
            ? m.content
                .map((p) => ("text" in p ? p.text : ""))
                .join("\n")
            : "";
      if (c) systemParts.push(c);
      continue;
    }
    if (m.role === "user" || m.role === "assistant") {
      const content = convertContent(m.content);
      if (content === "" || (Array.isArray(content) && content.length === 0))
        continue;
      messages.push({ role: m.role, content });
    }
    // 'tool' / 'function' messages are dropped — none of our routes use them
  }

  const requestedMax =
    (params as { max_completion_tokens?: number | null })
      .max_completion_tokens ??
    (params as { max_tokens?: number | null }).max_tokens ??
    4096;
  const maxTokens = Math.min(Math.max(requestedMax ?? 4096, 1), 8192);

  const out: MessageCreateParamsNonStreaming = {
    model: pickAnthropicModel(
      typeof params.model === "string" ? params.model : "",
    ),
    max_tokens: maxTokens,
    messages,
  };
  if (systemParts.length > 0) out.system = systemParts.join("\n\n");
  if (typeof params.temperature === "number")
    out.temperature = params.temperature;

  const rf = params.response_format;
  if (
    rf &&
    rf.type === "json_schema" &&
    rf.json_schema &&
    typeof rf.json_schema === "object"
  ) {
    const schema = (rf.json_schema as { schema?: unknown }).schema;
    if (schema && typeof schema === "object") {
      const tool: Tool = {
        name: "submit",
        description: "Return the structured result for the user.",
        input_schema: schema as Tool["input_schema"],
      };
      // SDK's Tool union spans tool / web-search / code / etc. variants;
      // cast through unknown so we don't have to redeclare every variant.
      out.tools = [tool] as unknown as MessageCreateParamsNonStreaming["tools"];
      out.tool_choice = { type: "tool", name: "submit" };
    }
  }
  return out;
}

/**
 * Build an OpenAI-shaped ChatCompletion from an Anthropic Messages
 * response so failover stays transparent to existing call sites that
 * read `completion.choices[0].message.content` and `completion.usage`.
 *
 * If the model used the forced tool_use (because the original request
 * carried a `response_format: json_schema`), the tool's `input` is
 * stringified. Otherwise text blocks are concatenated.
 */
export function fromAnthropicMessage(
  msg: {
    id?: string;
    model?: string;
    content: Array<{ type: string; text?: string; input?: unknown }>;
    stop_reason?: string | null;
    usage?: { input_tokens?: number; output_tokens?: number };
  },
  originalModel: string,
): ChatCompletion {
  let content = "";
  if (Array.isArray(msg.content)) {
    const toolBlock = msg.content.find(
      (b): b is ToolUseBlock => b.type === "tool_use",
    );
    if (toolBlock) {
      content = JSON.stringify(toolBlock.input ?? {});
    } else {
      content = msg.content
        .filter((b) => b.type === "text")
        .map((b) => b.text ?? "")
        .join("");
    }
  }
  const inputTokens = msg.usage?.input_tokens ?? 0;
  const outputTokens = msg.usage?.output_tokens ?? 0;
  return {
    id: msg.id ?? `chatcmpl_anthropic_${Date.now()}`,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: msg.model ?? originalModel,
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content,
          refusal: null,
        },
        finish_reason: msg.stop_reason === "tool_use" ? "stop" : "stop",
        logprobs: null,
      },
    ],
    usage: {
      prompt_tokens: inputTokens,
      completion_tokens: outputTokens,
      total_tokens: inputTokens + outputTokens,
    },
  } as unknown as ChatCompletion;
}
