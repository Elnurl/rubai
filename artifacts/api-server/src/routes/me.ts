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
import {
  logBehavioralEvent,
  type BehavioralEventType,
} from "../lib/behavioralEvents";
import { recomputeBehavioralStateAsync } from "../lib/behavioralAnalytics";

// ── Task-history diff helper ───────────────────────────────────────────────
// Extracts a flat Map of `${goalId}:${taskId}:${date}` → completed boolean
// from a raw goals JSONB array so we can diff old vs new on every PUT.
type TaskKey = string;
type CompletionMap = Map<
  TaskKey,
  { completed: boolean; taskTitle: string; taskId: string }
>;

function buildCompletionMap(goals: unknown): CompletionMap {
  const map: CompletionMap = new Map();
  if (!Array.isArray(goals)) return map;
  for (const goal of goals) {
    if (!goal || typeof goal !== "object") continue;
    const g = goal as Record<string, unknown>;
    const goalId = typeof g.id === "string" ? g.id : "";
    const history = Array.isArray(g.taskHistory) ? g.taskHistory : [];
    for (const entry of history) {
      if (!entry || typeof entry !== "object") continue;
      const e = entry as Record<string, unknown>;
      const taskId = typeof e.taskId === "string" ? e.taskId : "";
      const date = typeof e.date === "string" ? e.date : "";
      const completed = e.completed === true;
      const taskTitle = typeof e.taskTitle === "string" ? e.taskTitle : "";
      if (taskId && date) {
        map.set(`${goalId}:${taskId}:${date}`, {
          completed,
          taskTitle,
          taskId,
        });
      }
    }
  }
  return map;
}

function diffAndLogTaskEvents(
  userId: number,
  oldGoals: unknown,
  newGoals: unknown,
): void {
  const oldMap = buildCompletionMap(oldGoals);
  const newMap = buildCompletionMap(newGoals);
  let changed = false;

  for (const [key, newVal] of newMap) {
    const oldVal = oldMap.get(key);
    // Only log when completion status changed (not first-time creates, which
    // are just stub entries with completed: false from the mobile side).
    if (oldVal === undefined) continue;
    if (oldVal.completed === newVal.completed) continue;

    const eventType: BehavioralEventType = newVal.completed
      ? "task_completed"
      : "task_skipped";

    logBehavioralEvent(userId, eventType, {
      taskId: newVal.taskId,
      taskTitle: newVal.taskTitle,
    });
    changed = true;
  }

  if (changed) {
    recomputeBehavioralStateAsync(userId);
  }
}

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
    // Read the current row first so we can:
    //   (a) diff task history to emit behavioral events on success
    //   (b) return it immediately on CAS failure without a second round-trip
    const [currentRow] = await db
      .select()
      .from(userStateTable)
      .where(eq(userStateTable.userId, user.id));

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
      // Fire-and-forget RAG indexing.
      indexUserGoalsAsync(req, user.id, updated.goals);
      // Fire-and-forget behavioral event diff: detect task_completed /
      // task_skipped transitions and trigger state recompute.
      diffAndLogTaskEvents(user.id, currentRow?.goals ?? [], goals);
      res.json(buildSuccess(updated));
      return;
    }

    // CAS failed — return the pre-fetched current row (no extra round-trip).
    req.log.info(
      {
        userId: user.id,
        expectedVersion,
        currentVersion: currentRow?.version ?? null,
      },
      "Version conflict on /me/state PUT (update CAS failed)",
    );
    res.status(409).json(buildConflict(currentRow ?? null));
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
