import type { Request, Response, NextFunction } from "express";
import { getAuth } from "@clerk/express";
import { eq } from "drizzle-orm";
import { db, usersTable, analyticsEventsTable } from "@workspace/db";

declare global {
  namespace Express {
    interface Request {
      userId?: number;
      clerkUserId?: string;
    }
  }
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const auth = getAuth(req);
  const clerkUserId = auth?.userId;
  if (!clerkUserId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const sessionClaims = (auth?.sessionClaims ?? {}) as {
      email?: string;
      primary_email_address?: string;
      email_address?: string;
    };
    const email =
      sessionClaims.email ??
      sessionClaims.primary_email_address ??
      sessionClaims.email_address ??
      null;

    const [existing] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.clerkUserId, clerkUserId));

    let row = existing;
    if (!row) {
      const [created] = await db
        .insert(usersTable)
        .values({ clerkUserId, email: email ?? null })
        .returning();
      row = created;
      req.log.info({ clerkUserId, userId: row.id }, "Provisioned new user");
      // Best-effort: log a sign-up event for product analytics. A failure
      // here must never block the auth flow.
      void db
        .insert(analyticsEventsTable)
        .values({
          userId: row.id,
          eventType: "user.signed_up",
          payload: { clerkUserId, email: email ?? null },
        })
        .catch((err) =>
          req.log.warn({ err }, "Failed to record user.signed_up event"),
        );
    } else if (email && email !== row.email) {
      const [updated] = await db
        .update(usersTable)
        .set({ email })
        .where(eq(usersTable.id, row.id))
        .returning();
      row = updated;
    }

    req.userId = row.id;
    req.clerkUserId = clerkUserId;
    next();
  } catch (err) {
    req.log.error({ err }, "requireAuth failed");
    res.status(500).json({ error: "Auth resolution failed" });
  }
}
