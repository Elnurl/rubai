import { and, eq, isNotNull, ne, or, sql } from "drizzle-orm";
import { Expo } from "expo-server-sdk";

import { db, usersTable, userStateTable } from "@workspace/db";

import { logger } from "./logger";

// One Expo client is reused across all sends. The SDK is a thin wrapper
// over fetch — no auth required for sending to ExponentPushToken[...] ids.
const expo = new Expo();

// Local hour at which we want to deliver the morning nudge. Anything in
// 7:00–9:59 local counts; the dedupe column ensures only one fires per
// local day.
const MORNING_HOUR_START = 7;
const MORNING_HOUR_END = 10;

// How often to wake the scheduler. One minute is plenty given we only
// need ~hourly granularity in practice.
const TICK_MS = 60_000;

/**
 * Returns the user's local date (YYYY-MM-DD) and local hour given their
 * tz offset (minutes east of UTC). Falls back to UTC when no offset is
 * stored.
 */
function localNow(tzOffsetMinutes: number | null): {
  isoDate: string;
  hour: number;
} {
  const offset = tzOffsetMinutes ?? 0;
  const local = new Date(Date.now() + offset * 60_000);
  // Use the UTC accessors after shifting — local accessors would re-apply
  // the server's own timezone.
  const y = local.getUTCFullYear();
  const m = String(local.getUTCMonth() + 1).padStart(2, "0");
  const d = String(local.getUTCDate()).padStart(2, "0");
  return { isoDate: `${y}-${m}-${d}`, hour: local.getUTCHours() };
}

/**
 * Pick a short, personal nudge body from the goal's recent completion
 * pattern. Mirrors the momentum lib on the client so the copy lines up
 * with what they see on the Today screen.
 */
function nudgeBodyForGoal(goal: {
  profile?: { goalStatement?: string };
  taskHistory?: Array<{ date: string; completed: boolean }>;
}): string {
  const history = goal.taskHistory ?? [];
  const recent = history.slice(-21);
  const total = recent.length;
  const done = recent.filter((h) => h.completed).length;
  const rate = total > 0 ? done / total : 0;

  if (total === 0) {
    return "First task of the day is the hardest — let's get one done.";
  }
  if (rate >= 0.85) {
    return "High-performance week — keep the streak alive today.";
  }
  if (rate >= 0.6) {
    return "Solid rhythm. One more clean day keeps the momentum.";
  }
  if (rate >= 0.3) {
    return "You're slipping a little — let's reset with one task right now.";
  }
  return "Time to get back on track. Pick the smallest task and start it.";
}

type GoalRow = {
  profile?: { goalStatement?: string };
  taskHistory?: Array<{ date: string; completed: boolean }>;
};

/**
 * Build the body for a user's morning push from their active goal. Falls
 * back to a generic line when the user has no goals yet.
 */
function buildMorningPush(state: {
  goals: GoalRow[];
  activeGoalId: string | null;
}): { title: string; body: string } {
  const active =
    state.goals.find(
      (g) => (g as { id?: string }).id === state.activeGoalId,
    ) ?? state.goals[0];
  if (!active) {
    return {
      title: "rubai",
      body: "Open the app and set your first goal — small starts compound.",
    };
  }
  return {
    title: "Good morning",
    body: nudgeBodyForGoal(active),
  };
}

/**
 * Single push send wrapper. Drops invalid tokens up front and logs but
 * does not throw on Expo errors so a bad token can't crash the tick.
 */
export async function sendPushTo(
  token: string,
  payload: { title: string; body: string },
): Promise<boolean> {
  if (!Expo.isExpoPushToken(token)) {
    logger.warn({ token }, "Skipping non-Expo push token");
    return false;
  }
  try {
    const tickets = await expo.sendPushNotificationsAsync([
      {
        to: token,
        sound: "default",
        title: payload.title,
        body: payload.body,
      },
    ]);
    const ticket = tickets[0];
    if (ticket?.status === "error") {
      logger.warn({ ticket }, "Expo push returned error ticket");
      return false;
    }
    return true;
  } catch (err) {
    logger.error({ err }, "Failed to send Expo push");
    return false;
  }
}

/**
 * Send a silent data-only push to poke the mobile client into re-checking
 * its subscription tier. Fires after a webhook updates the tier in the DB
 * so the change surfaces immediately without requiring an app restart.
 *
 * The push carries no audible sound and suppresses its banner in the mobile
 * notification handler (checked via data.type === "tier_changed"). On iOS,
 * _contentAvailable requests a brief background-processing window so the
 * app can call /me/sync-tier even when backgrounded.
 */
export async function sendTierChangedPushTo(
  token: string,
  newTier: string,
): Promise<boolean> {
  if (!Expo.isExpoPushToken(token)) {
    logger.warn({ token }, "Skipping non-Expo push token (tier-changed)");
    return false;
  }
  try {
    const tickets = await expo.sendPushNotificationsAsync([
      {
        to: token,
        // Omit sound — the UI update is the feedback.
        sound: undefined,
        // Friendly fallback body shown if the app is fully terminated and
        // the OS renders the notification natively.
        title: "Your plan was updated",
        body:
          newTier === "free"
            ? "Your subscription has ended."
            : `You're now on the ${newTier} plan.`,
        data: { type: "tier_changed", tier: newTier },
        // Ask iOS to wake the app briefly so it can sync in the background.
        _contentAvailable: true,
        priority: "normal",
      },
    ]);
    const ticket = tickets[0];
    if (ticket?.status === "error") {
      logger.warn({ ticket }, "Expo tier-changed push returned error ticket");
      return false;
    }
    return true;
  } catch (err) {
    logger.error({ err }, "Failed to send tier-changed push");
    return false;
  }
}

/**
 * Send the morning nudge to one user if they're in their local morning
 * window and haven't been nudged yet today. Returns true when a push
 * was actually delivered.
 */
async function maybeSendMorningNudge(user: {
  id: number;
  expoPushToken: string | null;
  tzOffsetMinutes: number | null;
  lastMorningNudgeDate: string | null;
}): Promise<boolean> {
  if (!user.expoPushToken) return false;
  const { isoDate, hour } = localNow(user.tzOffsetMinutes);
  if (hour < MORNING_HOUR_START || hour >= MORNING_HOUR_END) return false;
  if (user.lastMorningNudgeDate === isoDate) return false;

  // Pull the user's state to personalize the body. Skip silently if the
  // user has never synced state — they'd just get a generic message and
  // we'd rather wait until they have real goals.
  const [stateRow] = await db
    .select()
    .from(userStateTable)
    .where(eq(userStateTable.userId, user.id));
  if (!stateRow) return false;
  const goals = (stateRow.goals as GoalRow[]) ?? [];
  if (goals.length === 0) return false;

  const payload = buildMorningPush({
    goals,
    activeGoalId: stateRow.activeGoalId,
  });
  const ok = await sendPushTo(user.expoPushToken, payload);

  // Always record the attempt — if Expo rejected the token we don't want
  // to retry every minute for the rest of the day.
  await db
    .update(usersTable)
    .set({ lastMorningNudgeDate: isoDate })
    .where(eq(usersTable.id, user.id));
  return ok;
}

let started = false;

/**
 * Boot the in-process daily push scheduler. Idempotent — calling more
 * than once is a no-op so route hot-reloads don't double up timers.
 */
export function startPushScheduler(): void {
  if (started) return;
  started = true;

  const tick = async (): Promise<void> => {
    try {
      // Fetch users that have a token AND either have never been nudged
      // or were last nudged on a different date. Cheap enough to scan
      // hourly for an MVP user base.
      const candidates = await db
        .select({
          id: usersTable.id,
          expoPushToken: usersTable.expoPushToken,
          tzOffsetMinutes: usersTable.tzOffsetMinutes,
          lastMorningNudgeDate: usersTable.lastMorningNudgeDate,
        })
        .from(usersTable)
        .where(isNotNull(usersTable.expoPushToken));

      let sent = 0;
      for (const u of candidates) {
        if (await maybeSendMorningNudge(u)) sent += 1;
      }
      if (sent > 0) {
        logger.info({ sent, candidates: candidates.length }, "Sent morning push nudges");
      }
    } catch (err) {
      logger.error({ err }, "Push scheduler tick failed");
    }
  };

  // Fire once shortly after boot so a freshly-restarted server still
  // delivers the morning nudge for users who registered while it was
  // down. Then on the regular cadence.
  setTimeout(() => {
    void tick();
  }, 5_000);
  setInterval(() => {
    void tick();
  }, TICK_MS);
  logger.info({ tickMs: TICK_MS }, "Push scheduler started");
}

// Suppress "unused import" warnings for symbols kept around in case the
// scheduler logic grows.
void and;
void or;
void ne;
void sql;
