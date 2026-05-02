import type { BehavioralSnapshot } from "@workspace/api-client-react";

export type MomentumLevel = "fresh" | "high" | "good" | "ok" | "losing";

export type MomentumState = {
  level: MomentumLevel;
  message: string;
  icon: "sun" | "trending-up" | "activity" | "alert-circle" | "zap";
};

export function computeMomentum(snapshot: BehavioralSnapshot): MomentumState {
  const completed = snapshot.completedTaskTitles?.length ?? 0;
  const missed = snapshot.missedTaskTitles?.length ?? 0;
  const totalTouched = completed + missed;
  const streak = snapshot.currentStreakDays ?? 0;
  const rate = snapshot.completionRate ?? 0;

  if (totalTouched === 0) {
    return {
      level: "fresh",
      message: "Your first day — let's set the tone.",
      icon: "sun",
    };
  }
  if (rate >= 0.85 && streak >= 3) {
    return {
      level: "high",
      message: "High-performance week — strong discipline detected.",
      icon: "zap",
    };
  }
  if (rate >= 0.6) {
    return {
      level: "good",
      message: "Great consistency — keep it going.",
      icon: "trending-up",
    };
  }
  if (rate >= 0.3) {
    return {
      level: "ok",
      message: "Building momentum — stay with it.",
      icon: "activity",
    };
  }
  return {
    level: "losing",
    message: "You're losing momentum — let's get back on track.",
    icon: "alert-circle",
  };
}
