import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, usersTable, userStateTable } from "@workspace/db";
import {
  GetMeResponse,
  GetMeStateResponse,
  PutMeStateBody,
  PutMeStateResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";
import { indexUserGoalsAsync } from "../lib/embeddingsIndexer";

const router: IRouter = Router();

router.use(requireAuth);

router.get("/me", async (req, res): Promise<void> => {
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, req.userId!));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(
    GetMeResponse.parse({
      clerkUserId: user.clerkUserId,
      email: user.email,
      tier: user.tier,
    }),
  );
});

const EMPTY_STATE = {
  goals: [] as Array<Record<string, unknown>>,
  activeGoalId: null as string | null,
  accountPrefs: {} as Record<string, unknown>,
  pendingDraft: null as Record<string, unknown> | null,
  version: 0,
};

router.get("/me/state", async (req, res): Promise<void> => {
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, req.userId!));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  const [state] = await db
    .select()
    .from(userStateTable)
    .where(eq(userStateTable.userId, user.id));

  const payload = state
    ? {
        clerkUserId: user.clerkUserId,
        email: user.email,
        tier: user.tier,
        goals: (state.goals as Array<Record<string, unknown>>) ?? [],
        activeGoalId: state.activeGoalId,
        accountPrefs:
          (state.accountPrefs as Record<string, unknown>) ?? {},
        pendingDraft:
          (state.pendingDraft as Record<string, unknown> | null) ?? null,
        version: state.version,
      }
    : {
        clerkUserId: user.clerkUserId,
        email: user.email,
        tier: user.tier,
        ...EMPTY_STATE,
      };

  res.json(GetMeStateResponse.parse(payload));
});

router.put("/me/state", async (req, res): Promise<void> => {
  const parsed = PutMeStateBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn(
      { errors: parsed.error.message },
      "Invalid /me/state PUT body",
    );
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, req.userId!));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const { goals, activeGoalId, accountPrefs, pendingDraft, expectedVersion } =
    parsed.data;

  const buildSuccess = (
    row: typeof userStateTable.$inferSelect,
  ): unknown =>
    PutMeStateResponse.parse({
      clerkUserId: user.clerkUserId,
      email: user.email,
      tier: user.tier,
      goals: (row.goals as Array<Record<string, unknown>>) ?? [],
      activeGoalId: row.activeGoalId,
      accountPrefs: (row.accountPrefs as Record<string, unknown>) ?? {},
      pendingDraft:
        (row.pendingDraft as Record<string, unknown> | null) ?? null,
      version: row.version,
    });

  const buildConflict = (
    row: typeof userStateTable.$inferSelect | null,
  ): unknown => {
    const latestPayload = row
      ? {
          clerkUserId: user.clerkUserId,
          email: user.email,
          tier: user.tier,
          goals: (row.goals as Array<Record<string, unknown>>) ?? [],
          activeGoalId: row.activeGoalId,
          accountPrefs: (row.accountPrefs as Record<string, unknown>) ?? {},
          pendingDraft:
            (row.pendingDraft as Record<string, unknown> | null) ?? null,
          version: row.version,
        }
      : {
          clerkUserId: user.clerkUserId,
          email: user.email,
          tier: user.tier,
          ...EMPTY_STATE,
        };
    return {
      error: "Version conflict",
      latest: GetMeStateResponse.parse(latestPayload),
    };
  };

  // Atomic compare-and-swap: only update when version matches expectedVersion.
  // If expectedVersion > 0, we never insert — the row must already exist.
  if (expectedVersion > 0) {
    const [updated] = await db
      .update(userStateTable)
      .set({
        goals: goals as never,
        activeGoalId,
        accountPrefs: accountPrefs as never,
        pendingDraft: pendingDraft as never,
        version: sql`${userStateTable.version} + 1`,
      })
      .where(
        sql`${userStateTable.userId} = ${user.id} AND ${userStateTable.version} = ${expectedVersion}`,
      )
      .returning();

    if (updated) {
      // Fire-and-forget RAG indexing. The indexer is internally
      // idempotent and only re-embeds chunks whose text changed, so
      // calling on every successful PUT is cheap.
      indexUserGoalsAsync(req, user.id, updated.goals);
      res.json(buildSuccess(updated));
      return;
    }

    // CAS failed — fetch the latest row (or null if no row) and 409.
    const [current] = await db
      .select()
      .from(userStateTable)
      .where(eq(userStateTable.userId, user.id));
    req.log.info(
      {
        userId: user.id,
        expectedVersion,
        currentVersion: current?.version ?? null,
      },
      "Version conflict on /me/state PUT (update CAS failed)",
    );
    res.status(409).json(buildConflict(current ?? null));
    return;
  }

  // expectedVersion === 0 → first write. Insert atomically; on conflict (row
  // already exists from a concurrent writer), return 409 with the current row.
  const insertedRows = await db
    .insert(userStateTable)
    .values({
      userId: user.id,
      goals: goals as never,
      activeGoalId,
      accountPrefs: accountPrefs as never,
      pendingDraft: pendingDraft as never,
      version: 1,
    })
    .onConflictDoNothing({ target: userStateTable.userId })
    .returning();

  if (insertedRows.length > 0) {
    indexUserGoalsAsync(req, user.id, insertedRows[0]!.goals);
    res.json(buildSuccess(insertedRows[0]!));
    return;
  }

  const [current] = await db
    .select()
    .from(userStateTable)
    .where(eq(userStateTable.userId, user.id));
  req.log.info(
    {
      userId: user.id,
      expectedVersion,
      currentVersion: current?.version ?? null,
    },
    "Version conflict on /me/state PUT (insert race)",
  );
  res.status(409).json(buildConflict(current ?? null));
});

export default router;
