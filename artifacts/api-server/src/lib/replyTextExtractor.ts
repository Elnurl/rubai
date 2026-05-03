/**
 * Streaming JSON `reply` field extractor.
 *
 * The coach endpoint streams a structured JSON object that always
 * begins with a `"reply": "..."` string. We want to surface the reply
 * text to the client as it arrives, character-by-character, *without*
 * waiting for the full JSON object to close.
 *
 * Approach: a tiny incremental scanner that tracks three states —
 *   "scan"      — looking for the literal `"reply":"`
 *   "in_string" — inside the reply string, decoding JSON escapes as
 *                 they arrive and emitting decoded characters
 *   "done"      — closing quote has been seen; subsequent input is
 *                 ignored (the structured fields parsed at end-of-stream)
 *
 * Robustness rules:
 *  - Unicode escapes (`\uXXXX`) may be split across `feed()` calls. We
 *    keep the leading backslash buffered until we have all 5 trailing
 *    chars to avoid emitting a half-decoded codepoint.
 *  - Surrogate pairs from the model produce two `\uXXXX` escapes back
 *    to back; we emit each high/low surrogate code unit and let
 *    JavaScript glue them at consumer side. (Same shape as JSON.parse.)
 *  - The class is single-pass, intentionally not re-entrant.
 */
export class ReplyTextExtractor {
  private buffer = "";
  private state: "scan" | "in_string" | "done" = "scan";
  private escape = false;

  /**
   * Push one stream chunk in and receive any newly-decoded reply text.
   * Returns "" when the chunk only contained scaffolding around the
   * `reply` field or when the field has already closed.
   */
  feed(chunk: string): string {
    this.buffer += chunk;
    let emitted = "";

    if (this.state === "scan") {
      // Allow whitespace between key, colon and opening quote so the
      // model's exact formatting can't break us.
      const m = this.buffer.match(/"reply"\s*:\s*"/);
      if (!m || m.index === undefined) return emitted;
      this.buffer = this.buffer.slice(m.index + m[0].length);
      this.state = "in_string";
    }

    if (this.state === "in_string") {
      let i = 0;
      while (i < this.buffer.length) {
        const c = this.buffer[i];

        if (this.escape) {
          if (c === "u") {
            // Need exactly 4 hex chars after \u; if not all here yet,
            // wait for the next chunk by re-buffering the leading
            // backslash + the partial escape AND clearing `escape` so
            // the next feed() restarts the escape state machine
            // cleanly. Leaving `escape=true` would cause the rebuffered
            // backslash to be decoded as a literal `\\` on the next
            // pass, corrupting any following unicode/emoji.
            if (i + 5 > this.buffer.length) {
              this.buffer = "\\" + this.buffer.slice(i);
              this.escape = false;
              return emitted;
            }
            const hex = this.buffer.slice(i + 1, i + 5);
            const code = Number.parseInt(hex, 16);
            if (Number.isFinite(code)) {
              emitted += String.fromCharCode(code);
            }
            i += 5;
            this.escape = false;
            continue;
          }
          const decoded =
            c === "n" ? "\n"
            : c === "t" ? "\t"
            : c === "r" ? "\r"
            : c === "b" ? "\b"
            : c === "f" ? "\f"
            : c === "\"" ? "\""
            : c === "\\" ? "\\"
            : c === "/" ? "/"
            : c;
          emitted += decoded;
          this.escape = false;
          i += 1;
          continue;
        }

        if (c === "\\") {
          this.escape = true;
          i += 1;
          continue;
        }
        if (c === "\"") {
          this.state = "done";
          this.buffer = "";
          return emitted;
        }
        emitted += c;
        i += 1;
      }
      this.buffer = "";
      return emitted;
    }

    return emitted;
  }
}
