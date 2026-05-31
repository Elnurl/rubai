import { and, desc, gte, eq } from "drizzle-orm";
import { db, behavioralEventsTable, userBehavioralStateTable } from "@workspace/db";
import type { UserBehavioralState } from "@workspace/db";

const WINDOW_DAYS = 14;
const MIN_EVENTS_FOR_FLOW = 3;
const FLOW_WINDOW_MINUTES = 60;

/**
 * Returns the current behavioral state for a user, or a sensible default
 * when no state exists yet. Reads the pre-computed row — does NOT recompute.
 */
export async function getBehavioralState(
  userId: number,
): Promise<UserBehavioralState> {
  const [state] = await db
    .select()
    .from(userBehavioralStateTable)
    .where(eq(userBehavioralStateTable.userId, userId))
    .limit(1);

  return (
    state ?? {
      userId,
      energyLevel: 0.5,
      moodScore: 0.0,
      cognitiveLoad: 0.5,
      procrastinationRisk: "low",
      flowDetected: false,
      peakHours: [],
      motivationType: "balanced",
      updatedAt: new Date(),
    }
  );
}

/**
 * Recomputes and upserts the behavioral state from raw events.
 * Called fire-and-forget after every significant user interaction.
 */
export async function recomputeBehavioralState(userId: number): Promise<void> {
  const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const events = await db
    .select()
    .from(behavioralEventsTable)
    .where(
      and(
        eq(behavioralEventsTable.userId, userId),
        gte(behavioralEventsTable.createdAt, since),
      ),
    )
    .orderBy(desc(behavioralEventsTable.createdAt))
    .limit(500);

  if (events.length === 0) return;

  // ── Energy level ──────────────────────────────────────────────
  // Ratio of task_completed to (task_completed + task_skipped) in window
  const completions = events.filter((e) => e.eventType === "task_completed").length;
  const skips = events.filter((e) => e.eventType === "task_skipped").length;
  const total = completions + skips;
  const energyLevel = total > 0 ? Math.min(1, completions / total) : 0.5;

  // ── Mood score ────────────────────────────────────────────────
  // Rolling average of sentimentScore on message_sent events
  const sentimentEvents = events.filter(
    (e) => e.eventType === "message_sent" && e.sentimentScore !== null,
  );
  const moodScore =
    sentimentEvents.length > 0
      ? sentimentEvents.reduce((sum, e) => sum + (e.sentimentScore ?? 0), 0) /
        sentimentEvents.length
      : 0.0;

  // ── Cognitive load ────────────────────────────────────────────
  // (tasks_created in window) × (1 - energyLevel) normalised to [0,1]
  const tasksCreated = events.filter((e) => e.eventType === "task_created").length;
  const rawLoad = Math.min(1, (tasksCreated / 30) * (1 - energyLevel * 0.5));
  const cognitiveLoad = parseFloat(rawLoad.toFixed(2));

  // ── Procrastination risk ──────────────────────────────────────
  // Average delayDays on completed/skipped tasks
  const delayedEvents = events.filter(
    (e) =>
      (e.eventType === "task_completed" || e.eventType === "task_skipped") &&
      typeof (e.metadata as Record<string, unknown>)?.delayDays === "number",
  );
  const avgDelay =
    delayedEvents.length > 0
      ? delayedEvents.reduce(
          (sum, e) =>
            sum + ((e.metadata as Record<string, unknown>)?.delayDays as number),
          0,
        ) / delayedEvents.length
      : 0;
  const procrastinationRisk: "low" | "medium" | "high" =
    avgDelay > 3 ? "high" : avgDelay > 1 ? "medium" : "low";

  // ── Flow detection ────────────────────────────────────────────
  // ≥3 task_completed events within the last FLOW_WINDOW_MINUTES
  const flowWindow = new Date(Date.now() - FLOW_WINDOW_MINUTES * 60 * 1000);
  const recentCompletions = events.filter(
    (e) => e.eventType === "task_completed" && e.createdAt >= flowWindow,
  ).length;
  const flowDetected = recentCompletions >= MIN_EVENTS_FOR_FLOW;

  // ── Peak hours ────────────────────────────────────────────────
  // Hours that have the most task_completed events
  const hourBuckets: Record<number, number> = {};
  events
    .filter((e) => e.eventType === "task_completed")
    .forEach((e) => {
      const h = (e.metadata as Record<string, unknown>)?.hourOfDay as number;
      if (typeof h === "number") {
        hourBuckets[h] = (hourBuckets[h] ?? 0) + 1;
      }
    });
  const peakHours = Object.entries(hourBuckets)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([h]) => parseInt(h, 10))
    .sort((a, b) => a - b);

  // ── Motivation type ───────────────────────────────────────────
  const msgEvents = events.filter((e) => e.eventType === "message_sent");
  const motivationType: string =
    procrastinationRisk === "low" && flowDetected
      ? "progress_driven"
      : procrastinationRisk === "high"
        ? "deadline_driven"
        : msgEvents.length > 20
          ? "social"
          : "balanced";

  await db
    .insert(userBehavioralStateTable)
    .values({
      userId,
      energyLevel,
      moodScore,
      cognitiveLoad,
      procrastinationRisk,
      flowDetected,
      peakHours,
      motivationType,
    })
    .onConflictDoUpdate({
      target: userBehavioralStateTable.userId,
      set: {
        energyLevel,
        moodScore,
        cognitiveLoad,
        procrastinationRisk,
        flowDetected,
        peakHours,
        motivationType,
        updatedAt: new Date(),
      },
    });
}

/**
 * Fire-and-forget analytics update. Never throws or blocks the caller.
 */
export function recomputeBehavioralStateAsync(userId: number): void {
  recomputeBehavioralState(userId).catch(() => {});
}
