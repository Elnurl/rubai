import { and, count, eq, gte, notLike } from "drizzle-orm";
import type { NextFunction, Request, Response } from "express";

import { aiUsageTable, db, usersTable } from "@workspace/db";

import { logger } from "../lib/logger";

/**
 * Daily AI-turn quota, counted from the `ai_usage` table.
 *
 * What counts as ONE turn: a successful user-facing AI request (coach turn,
 * roadmap generation, daily plan). Internal calls that piggyback on a turn
 * are tagged in the route and EXCLUDED:
 *   - "%#tool"  — extra model rounds made by the coach agent loop
 *   - "%#embed" — embedding calls (RAG retrieval + indexing)
 * Without the exclusions a single agentic coach turn with two tool rounds
 * plus a RAG query would burn 4 quota units instead of 1.
 *
 * Premium: unlimited. On a DB failure the middleware fails OPEN (allows the
 * request) — availability beats strict enforcement for a coaching app — but
 * logs loudly so a broken quota check is visible in ops.
 */
const DAILY_LIMITS: Record<string, number> = {
  free: 20,
  pro: 100,
};

export async function requireAiQuota(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (!req.userId) {
    next();
    return;
  }

  try {
    const [user] = await db
      .select({ tier: usersTable.tier })
      .from(usersTable)
      .where(eq(usersTable.id, req.userId))
      .limit(1)
      .catch(() => [{ tier: "free" as string }]);

    const tier = user?.tier ?? "free";

    if (tier === "premium") {
      next();
      return;
    }

    const limit = DAILY_LIMITS[tier] ?? 20;

    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);

    const rows = await db
      .select({ value: count() })
      .from(aiUsageTable)
      .where(
        and(
          eq(aiUsageTable.userId, req.userId),
          gte(aiUsageTable.createdAt, todayStart),
          eq(aiUsageTable.status, "ok"),
          notLike(aiUsageTable.route, "%#tool"),
          notLike(aiUsageTable.route, "%#embed"),
        ),
      );

    const used = Number(rows[0]?.value ?? 0);

    if (used >= limit) {
      const tomorrow = new Date(todayStart);
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
      res.status(429).json({
        error: "quota_exceeded",
        tier,
        used,
        limit,
        resetAt: tomorrow.toISOString(),
      });
      return;
    }

    next();
  } catch (err) {
    logger.error(
      { err, userId: req.userId },
      "requireAiQuota check failed — failing open",
    );
    next();
  }
}
