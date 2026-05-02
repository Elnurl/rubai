import type { TaskHistoryEntry } from "@/lib/storage";
import type { AwardId, EarnedAward, Goal } from "@/types/atlas";

export type AwardDef = {
  id: AwardId;
  title: string;
  subtitle: string;
  icon: "zap" | "award" | "star" | "check-circle" | "trending-up";
};

export const AWARD_DEFS: AwardDef[] = [
  {
    id: "streak_3",
    title: "3-day streak",
    subtitle: "Three days of momentum.",
    icon: "zap",
  },
  {
    id: "streak_7",
    title: "7-day streak",
    subtitle: "A full week of showing up.",
    icon: "zap",
  },
  {
    id: "streak_14",
    title: "14-day streak",
    subtitle: "Two weeks of consistency.",
    icon: "trending-up",
  },
  {
    id: "streak_30",
    title: "30-day streak",
    subtitle: "A month of discipline.",
    icon: "award",
  },
  {
    id: "full_day",
    title: "Full task day",
    subtitle: "Every task on today's plan, done.",
    icon: "check-circle",
  },
  {
    id: "week_perfect",
    title: "Perfect week",
    subtitle: "Seven straight days at 100%.",
    icon: "star",
  },
];

export function getAwardDef(id: AwardId): AwardDef | undefined {
  return AWARD_DEFS.find((a) => a.id === id);
}

// Group history by ISO day. Each day record has total tracked tasks and how
// many were completed.
function dayMap(history: TaskHistoryEntry[]): Map<string, { total: number; completed: number }> {
  const m = new Map<string, { total: number; completed: number }>();
  for (const h of history) {
    const day = m.get(h.date) ?? { total: 0, completed: 0 };
    day.total += 1;
    if (h.completed) day.completed += 1;
    m.set(h.date, day);
  }
  return m;
}

// Streak = consecutive days back from `today` (inclusive) with at least one
// completed task. Mirrors AtlasProvider.computeBehavioral so award + streak
// pill stay in sync.
function streakFromHistory(history: TaskHistoryEntry[], today: string): number {
  const completedDays = new Set<string>();
  for (const h of history) {
    if (h.completed) completedDays.add(h.date);
  }
  let streak = 0;
  const cursor = new Date(today + "T00:00:00");
  while (true) {
    const iso = cursor.toISOString().slice(0, 10);
    if (completedDays.has(iso)) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

// Returns the set of award IDs the goal has *currently* earned, derived from
// its history and today's plan. Used to compute newly-earned awards by diffing
// against the persisted list.
export function deriveEarnedAwardIds(goal: Goal, today: string): Set<AwardId> {
  const earned = new Set<AwardId>();
  const history = goal.taskHistory ?? [];
  const days = dayMap(history);
  const streak = streakFromHistory(history, today);

  if (streak >= 3) earned.add("streak_3");
  if (streak >= 7) earned.add("streak_7");
  if (streak >= 14) earned.add("streak_14");
  if (streak >= 30) earned.add("streak_30");

  // Full task day — every task on today's plan has a completed entry today.
  const todaysPlan = goal.dailyPlan?.plan;
  if (todaysPlan && todaysPlan.date === today && todaysPlan.tasks.length > 0) {
    const completedToday = new Set(
      history.filter((h) => h.date === today && h.completed).map((h) => h.taskId),
    );
    const allDone = todaysPlan.tasks.every((t) => completedToday.has(t.id));
    if (allDone) earned.add("full_day");
  }

  // Perfect week — last 7 calendar days (today inclusive) each had at least
  // one tracked task and zero misses.
  const cursor = new Date(today + "T00:00:00");
  let perfect = true;
  for (let i = 0; i < 7; i += 1) {
    const iso = cursor.toISOString().slice(0, 10);
    const d = days.get(iso);
    if (!d || d.total === 0 || d.completed < d.total) {
      perfect = false;
      break;
    }
    cursor.setDate(cursor.getDate() - 1);
  }
  if (perfect) earned.add("week_perfect");

  return earned;
}

// Returns awards earned *now* but not previously persisted.
export function evaluateNewAwards(goal: Goal, today: string): EarnedAward[] {
  const already = new Set((goal.earnedAwards ?? []).map((a) => a.id));
  const current = deriveEarnedAwardIds(goal, today);
  const fresh: EarnedAward[] = [];
  const now = new Date().toISOString();
  for (const id of current) {
    if (!already.has(id)) {
      fresh.push({ id, earnedAt: now, earnedOn: today });
    }
  }
  return fresh;
}
