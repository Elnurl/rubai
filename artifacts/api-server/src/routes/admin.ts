import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { desc, eq } from "drizzle-orm";
import { db, usersTable, tierTransitionsTable } from "@workspace/db";

const router: IRouter = Router();

// ── Admin key middleware ───────────────────────────────────────────────────
// All /admin/* routes require X-Admin-Key matching the ADMIN_API_KEY env var.
// Returns 401 when the header is missing and 403 when it doesn't match so
// that callers can distinguish "no key supplied" from "wrong key".
function requireAdminKey(req: Request, res: Response, next: NextFunction): void {
  const adminKey = process.env.ADMIN_API_KEY;
  if (!adminKey) {
    req.log.warn("ADMIN_API_KEY is not configured; rejecting admin request");
    res.status(503).json({ error: "Admin API is not configured on this server" });
    return;
  }
  const supplied = req.headers["x-admin-key"];
  if (!supplied) {
    res.status(401).json({ error: "Missing X-Admin-Key header" });
    return;
  }
  if (supplied !== adminKey) {
    res.status(403).json({ error: "Invalid admin key" });
    return;
  }
  next();
}

router.use("/admin", requireAdminKey);

// GET /admin/users/:clerkUserId/tier-history
// Returns the full tier-transition history for any user, identified by their
// Clerk user ID. Intended for support staff answering billing questions without
// requiring the user to be present or the support agent to have DB access.
router.get(
  "/admin/users/:clerkUserId/tier-history",
  async (req: Request, res: Response): Promise<void> => {
    const clerkUserId = req.params["clerkUserId"] as string;

    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.clerkUserId, clerkUserId));

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const rawLimit = parseInt(String(req.query.limit ?? "50"), 10);
    const limit = Number.isNaN(rawLimit)
      ? 50
      : Math.min(100, Math.max(1, rawLimit));

    const rows = await db
      .select({
        id: tierTransitionsTable.id,
        fromTier: tierTransitionsTable.fromTier,
        toTier: tierTransitionsTable.toTier,
        triggeredBy: tierTransitionsTable.triggeredBy,
        eventType: tierTransitionsTable.eventType,
        createdAt: tierTransitionsTable.createdAt,
      })
      .from(tierTransitionsTable)
      .where(eq(tierTransitionsTable.userId, user.id))
      .orderBy(desc(tierTransitionsTable.createdAt))
      .limit(limit);

    const transitions = rows.map((r) => ({
      id: r.id,
      fromTier: r.fromTier,
      toTier: r.toTier,
      triggeredBy: r.triggeredBy,
      eventType: r.eventType ?? null,
      createdAt: r.createdAt.toISOString(),
    }));

    req.log.info(
      { clerkUserId, userId: user.id, count: transitions.length },
      "Admin tier-history lookup"
    );

    res.json({ transitions, total: transitions.length });
  }
);

export default router;
