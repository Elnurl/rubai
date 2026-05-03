import crypto from "node:crypto";

/**
 * Tiny in-process LRU cache for `/daily-plan` responses.
 *
 * Why in-process: the daily plan is fully a function of the user's
 * profile + roadmap + week + date + (optional) calendar context. The
 * client regenerates on date change, on goal switch, and on explicit
 * pull-to-refresh. The cache key encodes all of these inputs, so a hit
 * is byte-equivalent to a fresh generation.
 *
 * Why not Redis: zero ops surface for now; one server replica per
 * deployment. If we scale horizontally we move this to Redis behind the
 * same `getCached` / `setCached` interface — call sites don't change.
 *
 * Eviction: simple LRU with a hard cap. Entries also self-expire after
 * `MAX_AGE_MS` so stale plans for inactive users don't pin memory.
 */
const MAX_ENTRIES = 2000;
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24h — daily plans are date-keyed

/**
 * Bump this version whenever the prompt, response schema, or model
 * defaults for the cached endpoint change. It's mixed into every cache
 * key so old entries become unreachable instead of serving stale
 * outputs that no longer match the live generation contract.
 */
export const CACHE_VERSION = "v1";

type Entry = { value: string; expiresAt: number };

const store = new Map<string, Entry>();

export function hashKey(parts: Record<string, unknown>): string {
  // Stable stringify by sorting keys so insertion order can't shift the
  // hash and cause spurious cache misses. CACHE_VERSION is included so
  // a prompt/schema bump invalidates everything atomically.
  const withVersion: Record<string, unknown> = { ...parts, __v: CACHE_VERSION };
  const ordered = Object.keys(withVersion)
    .sort()
    .reduce<Record<string, unknown>>((acc, k) => {
      acc[k] = withVersion[k];
      return acc;
    }, {});
  return crypto
    .createHash("sha1")
    .update(JSON.stringify(ordered))
    .digest("hex");
}

export function getCached<T>(key: string): T | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    store.delete(key);
    return null;
  }
  // LRU bump: re-insert to move to the end of iteration order.
  store.delete(key);
  store.set(key, entry);
  // Always return a fresh deserialized copy so callers can mutate the
  // result without poisoning the cached value across requests.
  return JSON.parse(entry.value) as T;
}

export function setCached(key: string, value: unknown): void {
  if (store.size >= MAX_ENTRIES) {
    // Evict the oldest (first-inserted) entry. Map iteration order is
    // insertion order, so the first key is also the LRU.
    const oldest = store.keys().next().value;
    if (oldest !== undefined) store.delete(oldest);
  }
  // Serialize on write so the stored value is detached from the
  // caller's reference graph.
  store.set(key, {
    value: JSON.stringify(value),
    expiresAt: Date.now() + MAX_AGE_MS,
  });
}

export function invalidate(key: string): void {
  store.delete(key);
}

/** Test/diagnostics helper — not used in normal request paths. */
export function _size(): number {
  return store.size;
}
