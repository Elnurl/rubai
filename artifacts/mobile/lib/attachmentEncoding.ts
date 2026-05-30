/**
 * Lightweight encoding for rich attachment metadata stored inside ChatMessage.content.
 *
 * Format (if an attachment is present):
 *   {"_a":"IMG","_v":"<uri>"}\n<message text>
 *   {"_a":"FILE","_v":"<filename>"}\n<message text>
 *
 * The first line is a compact JSON header; everything after the first \n is
 * the user-visible message body. If no header is present the content is plain.
 *
 * The encoding is stripped before including messages in AI history so the
 * model never sees local file URIs.
 */

export type AttachMeta =
  | { kind: "IMG"; uri: string }
  | { kind: "FILE"; filename: string };

export function encodeImageAttachment(uri: string, message: string): string {
  return `{"_a":"IMG","_v":${JSON.stringify(uri)}}\n${message}`;
}

export function encodeFileAttachment(filename: string, message: string): string {
  return `{"_a":"FILE","_v":${JSON.stringify(filename)}}\n${message}`;
}

/** Returns null when content is plain (no attachment header). */
export function decodeAttachment(
  content: string,
): { meta: AttachMeta; message: string } | null {
  if (!content.startsWith('{"_a":')) return null;
  const nl = content.indexOf("\n");
  if (nl < 0) return null;
  try {
    const raw = JSON.parse(content.slice(0, nl)) as { _a: string; _v: string };
    if (raw._a === "IMG") {
      return { meta: { kind: "IMG", uri: raw._v }, message: content.slice(nl + 1) };
    }
    if (raw._a === "FILE") {
      return {
        meta: { kind: "FILE", filename: raw._v },
        message: content.slice(nl + 1),
      };
    }
    return null;
  } catch {
    return null;
  }
}

/** Strips the attachment header, returning only the message body. */
export function stripAttachmentMeta(content: string): string {
  return decodeAttachment(content)?.message ?? content;
}
