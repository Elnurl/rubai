import type { Request } from "express";
import { and, desc, gte, inArray, eq } from "drizzle-orm";
import type {
  ChatCompletionCreateParamsNonStreaming,
  ChatCompletionMessageParam,
  ChatCompletionMessageToolCall,
  ChatCompletionTool,
} from "openai/resources/chat/completions";

import { db, behavioralEventsTable } from "@workspace/db";

import { trackedCreate } from "./aiUsage";
import { logger } from "./logger";
import { searchUserEmbeddings } from "./ragRetrieval";
import {
  parseAndValidate,
  StrictJsonError,
  type StrictJsonValidator,
} from "./strictJson";

/**
 * Tool-calling agent loop for the coach.
 *
 * The coach model can call server-side READ tools before producing its
 * structured reply:
 *
 *   - search_memory      — semantic pgvector search over everything we've
 *                          indexed for this user (reflections, coach memory,
 *                          plans, learned profile, evolutions).
 *   - get_task_history   — completed/skipped/created task events from the
 *                          behavioral log, beyond the few reflections the
 *                          client sends inline.
 *
 * WRITE operations (add/edit/remove tasks, roadmap edits, calendar) stay on
 * the existing `proposedAction` path: the model returns a structured action
 * and the mobile app applies it instantly with Undo. Tools here are
 * deliberately read-only so a hallucinated call can never corrupt state.
 *
 * Loop budget: at most MAX_TOOL_ROUNDS tool rounds per user turn. Extra
 * model calls made by the loop are tagged "#tool" in ai_usage so the daily
 * quota still counts each USER turn once (see requireAiQuota).
 */

export const MAX_TOOL_ROUNDS = 3;

/** Max chars of tool output fed back to the model per call. */
const MAX_TOOL_RESULT_CHARS = 4000;

const TASK_EVENT_TYPES = [
  "task_completed",
  "task_skipped",
  "task_created",
] as const;

export const COACH_AGENT_TOOLS: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "search_memory",
      description:
        "Semantic search over everything you know about this user: past reflections, remembered facts, plan tasks, learned profile insights, roadmap evolutions. Use when the user references something not in the current context (an old struggle, a past week, 'that thing I told you'), or when checking a pattern before advising.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              "What to look for, phrased in the user's language (e.g. 'sleep problems', 'why they skip morning tasks').",
          },
          top_k: {
            type: "integer",
            description: "How many results to return (1-12). Default 6.",
          },
        },
        required: ["query"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_task_history",
      description:
        "Fetch the user's task completion history from the server log: which tasks they completed, skipped, or were assigned recently. Use when discussing consistency, streaks, workload, or 'how am I doing' — the inline context only carries the last few reflections, this returns the full recent record.",
      parameters: {
        type: "object",
        properties: {
          days: {
            type: "integer",
            description: "How many days back to look (1-60). Default 14.",
          },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
];

/** Addendum appended to the coach system prompt when tools are enabled. */
export const COACH_AGENT_TOOLS_PROMPT = `
TOOLS: You can call server-side tools BEFORE answering when they would make your reply concretely better:
- search_memory — semantic recall of this user's past reflections, facts, plans and insights. Use it instead of guessing about their past.
- get_task_history — the real record of completed/skipped tasks. Use it before making claims about their consistency or progress.
Call a tool only when the current context is insufficient. After tool results arrive, answer normally in the required JSON format. Never mention tool names to the user.`;

type SearchMemoryArgs = { query?: unknown; top_k?: unknown };
type TaskHistoryArgs = { days?: unknown };

/**
 * Execute one coach tool call. Always resolves to a JSON string — errors
 * are returned as `{ error }` payloads so the model can degrade gracefully
 * instead of the whole turn failing.
 */
export async function executeCoachTool(
  req: Request,
  userId: number,
  name: string,
  argsJson: string,
): Promise<string> {
  let args: unknown = {};
  try {
    args = argsJson.trim().length > 0 ? JSON.parse(argsJson) : {};
  } catch {
    return JSON.stringify({ error: "invalid tool arguments (not JSON)" });
  }

  try {
    if (name === "search_memory") {
      const a = args as SearchMemoryArgs;
      const query = typeof a.query === "string" ? a.query.trim() : "";
      if (!query) return JSON.stringify({ error: "query is required" });
      const topK = clampInt(a.top_k, 1, 12, 6);
      const rows = await searchUserEmbeddings(req, userId, query, topK);
      const results = rows.map((r) => ({
        type: r.contentType,
        text: truncate(r.sourceText, 400),
        relevance: Number((1 - r.distance / 2).toFixed(3)),
      }));
      return clampResult(JSON.stringify({ results }));
    }

    if (name === "get_task_history") {
      const a = args as TaskHistoryArgs;
      const days = clampInt(a.days, 1, 60, 14);
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const rows = await db
        .select({
          eventType: behavioralEventsTable.eventType,
          metadata: behavioralEventsTable.metadata,
          createdAt: behavioralEventsTable.createdAt,
        })
        .from(behavioralEventsTable)
        .where(
          and(
            eq(behavioralEventsTable.userId, userId),
            inArray(behavioralEventsTable.eventType, [...TASK_EVENT_TYPES]),
            gte(behavioralEventsTable.createdAt, since),
          ),
        )
        .orderBy(desc(behavioralEventsTable.createdAt))
        .limit(200);

      const counts = { completed: 0, skipped: 0, created: 0 };
      const events = rows.map((r) => {
        if (r.eventType === "task_completed") counts.completed += 1;
        else if (r.eventType === "task_skipped") counts.skipped += 1;
        else if (r.eventType === "task_created") counts.created += 1;
        const meta = (r.metadata ?? {}) as { taskTitle?: string };
        return {
          date: r.createdAt.toISOString().slice(0, 10),
          event: r.eventType.replace("task_", ""),
          task: meta.taskTitle ? truncate(meta.taskTitle, 80) : undefined,
        };
      });
      return clampResult(
        JSON.stringify({ days, counts, events: events.slice(0, 80) }),
      );
    }

    return JSON.stringify({ error: `unknown tool: ${name}` });
  } catch (err) {
    logger.warn({ err, userId, tool: name }, "coach tool execution failed");
    return JSON.stringify({ error: "tool execution failed" });
  }
}

/**
 * Non-streaming agent loop: runs up to MAX_TOOL_ROUNDS tool rounds, then
 * parses + validates the final structured JSON reply. Mirrors
 * `strictJsonCompletion` semantics (one retry on parse/validation failure,
 * refusals never retried) with tool support layered in.
 */
export async function coachAgentCompletion<T>(
  req: Request,
  params: ChatCompletionCreateParamsNonStreaming,
  validator: StrictJsonValidator<T>,
  opts: { enableTools?: boolean } = {},
): Promise<T> {
  const userId = req.userId;
  let messages: ChatCompletionMessageParam[] = [...params.messages];
  let retried = false;

  for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
    const toolsEnabled =
      (opts.enableTools ?? true) &&
      round < MAX_TOOL_ROUNDS &&
      typeof userId === "number";
    const completion = await trackedCreate(
      req,
      {
        ...params,
        messages,
        ...(toolsEnabled
          ? { tools: COACH_AGENT_TOOLS, tool_choice: "auto" as const }
          : {}),
      },
      { routeTag: round > 0 ? "#tool" : undefined },
    );

    const message = completion.choices[0]?.message;
    const toolCalls = (message?.tool_calls ?? []).filter(
      (c): c is ChatCompletionMessageToolCall & { type: "function" } =>
        c.type === "function",
    );

    if (toolCalls.length > 0 && toolsEnabled) {
      messages = [
        ...messages,
        {
          role: "assistant",
          content: message?.content ?? null,
          tool_calls: message?.tool_calls,
        } as ChatCompletionMessageParam,
      ];
      for (const call of toolCalls) {
        const result = await executeCoachTool(
          req,
          userId!,
          call.function.name,
          call.function.arguments ?? "{}",
        );
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: result,
        });
      }
      continue;
    }

    try {
      return parseAndValidate(
        message?.content ?? null,
        (message as { refusal?: string | null } | undefined)?.refusal ?? null,
        validator,
      );
    } catch (err) {
      if (!(err instanceof StrictJsonError)) throw err;
      if (err.kind === "refusal") throw err;
      if (retried) throw err;
      retried = true;
      req.log.warn(
        { kind: err.kind, details: err.details },
        "coachAgentCompletion parse failed; retrying once",
      );
      messages = [
        ...messages,
        {
          role: "system",
          content:
            "Your previous response could not be parsed or validated against the required schema. " +
            "Respond ONLY with strictly valid JSON that exactly matches the response_format schema. " +
            "No prose, no markdown fences, no commentary.",
        },
      ];
      // Do not consume a tool round for the retry.
      round -= 1;
    }
  }

  throw new StrictJsonError("empty", "coachAgentCompletion exhausted rounds");
}

function clampInt(
  value: unknown,
  min: number,
  max: number,
  fallback: number,
): number {
  const n = typeof value === "number" ? Math.floor(value) : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max).trimEnd()}…` : s;
}

function clampResult(s: string): string {
  return s.length > MAX_TOOL_RESULT_CHARS
    ? `${s.slice(0, MAX_TOOL_RESULT_CHARS)}…`
    : s;
}
