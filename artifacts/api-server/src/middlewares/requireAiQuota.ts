import { and, count, eq, gte } from "drizzle-orm";
import type { NextFunction, Request, Response } from "express";

import { aiUsageTable, db, usersTable } from "@workspace/db";

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
  } catch {
    next();
  }
}
