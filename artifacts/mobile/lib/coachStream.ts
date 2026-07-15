import { fetch as expoFetch } from "expo/fetch";
import { getAuthToken, getBaseUrl } from "@workspace/api-client-react";
import type {
  CoachActionSuggestion,
  ProposedCoachAction,
} from "@workspace/api-client-react";

/**
 * Streaming consumer for POST /api/atlas/coach/stream.
 *
 * Why `expo/fetch` and not the global fetch?
 *   The React Native runtime that Expo SDK 54 ships does NOT support
 *   `Response.body` as a ReadableStream — `response.body` is `undefined`
 *   even when the server is producing chunks. `expo/fetch` is a WHATWG
 *   fetch polyfill that does expose a streaming body on iOS, Android,
 *   and (via passthrough to the platform fetch) on web. Using it
 *   uniformly keeps a single code path.
 *
 * Auth: this helper bypasses `customFetch`, so we manually read the
 * Clerk bearer token via `getAuthToken()` (the same getter the
 * generated React Query hooks use) and attach it as `Authorization`.
 */

export type CoachStreamRequest = {
  // Same request body shape as the non-streaming /coach endpoint —
  // typed as `unknown` here to avoid coupling to the generated client's
  // CoachRequest type (it changes frequently as the schema evolves).
  data: unknown;
};

export type CoachStreamFinal = {
  reply: string;
  suggestedReplies: string[];
  actionSuggestion: CoachActionSuggestion | null;
  memoryUpdate: { summary: string; newFacts: string[] } | null;
  proposedAction: ProposedCoachAction | null;
};

export type CoachStreamCallbacks = {
  /** Called for each batch of newly-decoded reply text. */
  onDelta: (text: string) => void;
  /** Called once with the structured response after the JSON object closes. */
  onFinal: (data: CoachStreamFinal) => void;
  /**
   * Optional: server progress hints (e.g. the agent is running tools
   * before answering). Safe to omit — purely informational.
   */
  onStatus?: (stage: string) => void;
};

type StreamEvent =
  | { type: "delta"; text: string }
  | ({ type: "final" } & CoachStreamFinal)
  | { type: "status"; stage: string }
  | { type: "error"; error: string }
  | { type: "done" };

/**
 * Open the streaming coach endpoint and pump events to the caller.
 *
 * Resolves when the `done` event has been received (or the stream
 * ended cleanly). Rejects with an Error if:
 *   - the HTTP response is non-2xx (the JSON error body is included)
 *   - the server emits an `error` event mid-stream
 *   - the stream terminates without a `final` event
 *
 * Pass an `AbortSignal` to cancel mid-stream (e.g. user navigates
 * away). The server-side request handler observes the disconnect and
 * stops billing OpenAI tokens.
 */
export async function streamCoachReply(
  payload: CoachStreamRequest,
  callbacks: CoachStreamCallbacks,
  signal?: AbortSignal,
): Promise<void> {
  const base = getBaseUrl() ?? "";
  const url = `${base}/api/atlas/coach/stream`;
  const token = await getAuthToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "text/event-stream",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await expoFetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(payload.data),
    signal,
  });

  if (!res.ok) {
    // Server still returns JSON for pre-stream errors (validation,
    // moderation, image size). Surface that detail when present.
    let detail = `HTTP ${res.status}`;
    try {
      const text = await res.text();
      if (text) {
        try {
          const parsed = JSON.parse(text) as { error?: string };
          if (parsed.error) detail = parsed.error;
        } catch {
          detail = text.slice(0, 200);
        }
      }
    } catch {
      // ignore
    }
    throw new Error(detail);
  }

  // expo/fetch exposes a WHATWG ReadableStream on res.body on all
  // platforms it supports. Bail early with a clear message if the
  // runtime is missing it (very old RN, unusual web target, etc.).
  const body = res.body;
  if (!body) {
    throw new Error("Streaming not supported in this runtime.");
  }

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let receivedFinal = false;
  let done = false;

  // Find the next SSE frame terminator. The spec allows "\n\n",
  // "\r\n\r\n", or "\r\r"; we accept all three so a fronting proxy that
  // rewrites line endings can't strand frames in the buffer.
  const findFrameEnd = (s: string): { idx: number; len: number } | null => {
    const candidates = [
      { token: "\r\n\r\n", len: 4 },
      { token: "\n\n", len: 2 },
      { token: "\r\r", len: 2 },
    ];
    let best: { idx: number; len: number } | null = null;
    for (const { token, len } of candidates) {
      const idx = s.indexOf(token);
      if (idx >= 0 && (best === null || idx < best.idx)) {
        best = { idx, len };
      }
    }
    return best;
  };

  // Walk newline-delimited SSE frames. A frame ends at "\n\n" and may
  // contain multiple "data:" lines (we only ever emit one per frame
  // server-side, but be defensive). Comment lines (":heartbeat") and
  // unknown event types are ignored.
  const consumeFrame = (frame: string) => {
    const lines = frame.split("\n");
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const raw = line.slice(5).trimStart();
      if (!raw) continue;
      let evt: StreamEvent;
      try {
        evt = JSON.parse(raw) as StreamEvent;
      } catch {
        continue;
      }
      if (evt.type === "delta") {
        callbacks.onDelta(evt.text);
      } else if (evt.type === "final") {
        receivedFinal = true;
        callbacks.onFinal({
          reply: evt.reply,
          suggestedReplies: evt.suggestedReplies,
          actionSuggestion: evt.actionSuggestion,
          memoryUpdate: evt.memoryUpdate,
          proposedAction: evt.proposedAction,
        });
      } else if (evt.type === "status") {
        callbacks.onStatus?.(evt.stage);
      } else if (evt.type === "error") {
        throw new Error(evt.error || "Coach stream failed");
      } else if (evt.type === "done") {
        done = true;
      }
    }
  };

  try {
    while (!done) {
      const { value, done: streamDone } = await reader.read();
      if (value) {
        buffer += decoder.decode(value, { stream: true });
        let frame: { idx: number; len: number } | null;
        while ((frame = findFrameEnd(buffer)) !== null) {
          const text = buffer.slice(0, frame.idx);
          buffer = buffer.slice(frame.idx + frame.len);
          consumeFrame(text);
          if (done) break;
        }
      }
      if (streamDone) {
        // Flush any trailing buffered frame the server may have written
        // without a terminating blank line (rare but possible if the
        // connection drops cleanly right after `done`).
        const tail = buffer.trim();
        if (tail.length > 0) consumeFrame(tail);
        break;
      }
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // already released or unsupported — fine
    }
  }

  if (!receivedFinal) {
    throw new Error("Coach stream ended without a final event.");
  }
}
