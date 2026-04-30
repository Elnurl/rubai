import { useCallback, useEffect } from "react";
import { useAtlasEvolveRoadmap } from "@workspace/api-client-react";

import { useAtlas } from "@/providers/AtlasProvider";
import type { RoadmapEvolutionEntry } from "@/types/atlas";

const AUTO_MIN_REFLECTIONS_SINCE = 3;
const AUTO_MIN_DAYS_SINCE = 3;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export type EvolveResult = {
  changed: boolean;
  summary?: string;
};

// Per-goal in-flight map shared across all hook instances. Both Today and
// Roadmap mount this hook, and a manual tap can race the self-driving auto
// trigger; coalescing by goal id means each goal has at most one evolution in
// flight at a time, regardless of who asked. By design, a manual tap fired
// during an in-flight auto evolve will receive the auto result rather than
// kicking off a second request.
const inFlightByGoal = new Map<string, Promise<EvolveResult | null>>();

export function useEvolveRoadmap() {
  const {
    activeGoalId,
    activeProfile,
    activeRoadmap,
    activeBehavioral,
    activeBehavioralProfile,
    activeReflections,
    activeCurrentWeek,
    activeLastEvolvedAt,
    applyRoadmapEvolution,
  } = useAtlas();

  const mutation = useAtlasEvolveRoadmap();
  const { mutateAsync } = mutation;

  const evolve = useCallback(
    async (trigger: "manual" | "auto"): Promise<EvolveResult | null> => {
      if (!activeGoalId || !activeProfile || !activeRoadmap) return null;
      // Pin the target goal at request-start. If the user switches goals while
      // the AI call is in flight, the result still applies to the goal that
      // asked for it — never the new active goal.
      const targetGoalId = activeGoalId;
      const sourceRoadmap = activeRoadmap;
      const existing = inFlightByGoal.get(targetGoalId);
      if (existing) return existing;

      const promise = (async (): Promise<EvolveResult | null> => {
        const res = await mutateAsync({
          data: {
            profile: activeProfile,
            currentRoadmap: sourceRoadmap,
            behavioral: activeBehavioral,
            learnedProfile: activeBehavioralProfile,
            recentReflections: activeReflections.slice(-20),
            currentWeek: activeCurrentWeek,
            trigger,
          },
        });
        const entry: RoadmapEvolutionEntry = {
          evolvedAt: res.evolvedAt,
          trigger,
          changeSummary: res.changeSummary,
          rationale: res.rationale,
          phaseChanges: res.phaseChanges,
        };
        if (res.hasChanged) {
          await applyRoadmapEvolution(targetGoalId, res.evolvedRoadmap, entry);
        } else {
          await applyRoadmapEvolution(targetGoalId, sourceRoadmap, entry);
        }
        return { changed: res.hasChanged, summary: res.changeSummary };
      })();

      inFlightByGoal.set(targetGoalId, promise);
      try {
        return await promise;
      } finally {
        inFlightByGoal.delete(targetGoalId);
      }
    },
    [
      activeGoalId,
      activeProfile,
      activeRoadmap,
      activeBehavioral,
      activeBehavioralProfile,
      activeReflections,
      activeCurrentWeek,
      applyRoadmapEvolution,
      mutateAsync,
    ],
  );

  const shouldAutoEvolve = useCallback((): boolean => {
    if (!activeRoadmap || !activeBehavioralProfile) return false;
    const reflectionsAfter = activeLastEvolvedAt
      ? activeReflections.filter(
          (r) => new Date(r.reflectedAt).getTime() > new Date(activeLastEvolvedAt).getTime(),
        ).length
      : activeReflections.length;
    if (reflectionsAfter < AUTO_MIN_REFLECTIONS_SINCE) return false;
    if (activeLastEvolvedAt) {
      const daysSince =
        (Date.now() - new Date(activeLastEvolvedAt).getTime()) / ONE_DAY_MS;
      if (daysSince < AUTO_MIN_DAYS_SINCE) return false;
    }
    return true;
  }, [
    activeRoadmap,
    activeBehavioralProfile,
    activeReflections,
    activeLastEvolvedAt,
  ]);

  const maybeAutoEvolve = useCallback(async (): Promise<EvolveResult | null> => {
    if (!shouldAutoEvolve()) return null;
    return evolve("auto");
  }, [shouldAutoEvolve, evolve]);

  // Self-driving: whenever the inputs that decide eligibility settle to a new
  // value (post-render, post-state-flush), give auto-evolution a chance. This
  // sidesteps stale-closure bugs from firing inside an async .then() right after
  // a setState call. Heavy guards inside `evolve` (per-goal in-flight map) and
  // `shouldAutoEvolve` (reflection count, day window) keep this idempotent and
  // safe across re-renders or screens.
  useEffect(() => {
    void maybeAutoEvolve();
  }, [
    maybeAutoEvolve,
    activeGoalId,
    activeReflections.length,
    activeBehavioralProfile?.updatedAt,
    activeLastEvolvedAt,
  ]);

  return {
    evolve,
    maybeAutoEvolve,
    shouldAutoEvolve,
    isEvolving: mutation.isPending,
  };
}
