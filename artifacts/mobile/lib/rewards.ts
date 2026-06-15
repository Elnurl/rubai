import type { Feather } from "@expo/vector-icons";
import type React from "react";

import type { Goal } from "@/types/atlas";

export type RewardKind = "phase" | "grand";

export type RewardEmblem = {
  key: string;
  title: string;
  focus: string;
  icon: React.ComponentProps<typeof Feather>["name"];
  color: string;
  locked: boolean;
  kind: RewardKind;
  /** 1-based phase position for phase emblems, null for the grand emblem. */
  phaseNumber: number | null;
  /** Week the phase ends — used to show the unlock requirement when locked. */
  unlockWeek: number | null;
};

export type GoalRewards = {
  goalId: string;
  goalTitle: string;
  emblems: RewardEmblem[];
  unlockedCount: number;
  totalCount: number;
};

// Decorative emblem palette — purely visual, independent of the theme tokens so
// the unlockable collection feels colorful and varied.
const EMBLEM_PALETTE = [
  "#0E7C5A",
  "#C68A12",
  "#3B6FB4",
  "#B4456F",
  "#7E4FB4",
  "#1E9AA0",
  "#D2691E",
  "#4F8F3B",
];

const PHASE_ICONS: React.ComponentProps<typeof Feather>["name"][] = [
  "star",
  "zap",
  "target",
  "compass",
  "feather",
  "sun",
  "anchor",
  "aperture",
];

const GRAND_COLOR = "#C68A12";

// Mirror of AtlasProvider.computeCurrentWeek so reward unlock state stays in
// sync with the roadmap's own phase status without importing provider internals.
export function currentWeekFor(startDate: string | null): number {
  if (!startDate) return 1;
  const start = new Date(startDate + "T00:00:00");
  if (isNaN(start.getTime())) return 1;
  const now = new Date();
  const days = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(1, Math.floor(days / 7) + 1);
}

function goalDisplayTitle(goal: Goal): string {
  return (
    goal.profile?.customGoalTitle ??
    goal.profile?.goalType ??
    "Goal"
  );
}

/**
 * Derives the visual reward collection for a single goal. A phase emblem
 * unlocks once the goal's current week passes that phase's end week (the same
 * rule the roadmap screen uses for its "DONE" chip), and the grand emblem
 * unlocks once every phase is complete.
 */
export function deriveGoalRewards(goal: Goal): GoalRewards {
  const phases = goal.roadmap?.phases ?? [];
  const currentWeek = currentWeekFor(goal.startDate);

  const emblems: RewardEmblem[] = phases.map((p, i) => ({
    key: `${goal.id}:phase:${p.id}`,
    title: p.title,
    focus: p.focus,
    icon: PHASE_ICONS[i % PHASE_ICONS.length],
    color: EMBLEM_PALETTE[i % EMBLEM_PALETTE.length],
    locked: !(currentWeek > p.endWeek),
    kind: "phase",
    phaseNumber: i + 1,
    unlockWeek: p.endWeek,
  }));

  const lastEnd = phases.length
    ? Math.max(...phases.map((p) => p.endWeek))
    : 0;
  const allPhasesDone = phases.length > 0 && currentWeek > lastEnd;

  emblems.push({
    key: `${goal.id}:grand`,
    title: goalDisplayTitle(goal),
    focus: "",
    icon: "award",
    color: GRAND_COLOR,
    locked: !allPhasesDone,
    kind: "grand",
    phaseNumber: null,
    unlockWeek: lastEnd || null,
  });

  const unlockedCount = emblems.filter((e) => !e.locked).length;

  return {
    goalId: goal.id,
    goalTitle: goalDisplayTitle(goal),
    emblems,
    unlockedCount,
    totalCount: emblems.length,
  };
}

export function deriveAllRewards(goals: Goal[]): GoalRewards[] {
  return goals
    .filter((g) => (g.roadmap?.phases?.length ?? 0) > 0)
    .map(deriveGoalRewards);
}
