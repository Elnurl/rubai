import type { Request } from "express";
import rateLimit, {
  ipKeyGenerator,
  type RateLimitRequestHandler,
} from "express-rate-limit";

/**
 * Per-user rate limit for AI endpoints.
 *
 * Keys by the authenticated Auth user id when present (so multiple
 * devices for the same user share a budget) and falls back to the IP
 * address for unauthenticated callers — though in practice /atlas is
 * mounted behind requireAuth so the IP fallback should rarely be hit.
 *
 * The limit is generous enough not to interrupt normal usage but tight
 * enough to make a runaway loop or abusive script obvious.
 *
 * NOTE (scaling caveat): the default in-memory store is per-process.
 * If/when this service is scaled horizontally (multiple instances), the
 * limit becomes per-instance rather than global. At that point switch
 * to a shared store (e.g. `rate-limit-redis` against Upstash, or a
 * Postgres-backed store) so the budget is enforced across all replicas.
 */
function aiKeyGenerator(req: Request): string {
  // Prefer the resolved local user id (set by requireAuth); fall back to
  // the Auth user id from session claims, then to a (IPv6-safe) IP key.
  if (typeof req.userId === "number") return `user:${req.userId}`;
  if (typeof req.authUserId === "string") return `auth:${req.authUserId}`;
  return `ip:${ipKeyGenerator(req.ip ?? "unknown")}`;
}

export const aiRateLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 60_000, // 1 minute
  limit: 60, // 60 requests / user / minute across all /atlas/* routes
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: aiKeyGenerator,
  message: {
    error: "Rate limit exceeded",
    detail:
      "Too many AI requests in a short window. Please wait a minute and try again.",
  },
});

/**
 * Tighter per-user limit for the coach endpoints specifically. A coach
 * turn is the most expensive call we make (smart model + agent tool
 * rounds + RAG), and no human sends more than a few messages a minute —
 * anything past this is a runaway client loop or a script.
 */
export const coachRateLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 60_000,
  limit: 12, // 12 coach turns / user / minute
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: aiKeyGenerator,
  message: {
    error: "Rate limit exceeded",
    detail:
      "You're sending messages too quickly. Wait a moment and try again.",
  },
});
