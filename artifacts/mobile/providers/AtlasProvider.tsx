import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  BehavioralProfile,
  BehavioralSnapshot,
  ChatMessage,
  CoachMemory,
  CurrentPhaseSnapshot,
  DailyPlan,
  IntakeAnswer,
  IntakeQuestion,
  ReflectionEntry,
  Roadmap,
  UserProfile,
} from "@workspace/api-client-react";
import {
  STORAGE_KEYS,
  TaskHistoryEntry,
  clearAllAtlas,
  clearV1Storage,
  loadJson,
  makeId,
  readV1ForMigration,
  removeKey,
  saveJson,
  todayISO,
} from "@/lib/storage";
import {
  DEFAULT_ACCOUNT,
  DEFAULT_SUBSCRIPTION,
  type AccountPrefs,
  type Goal,
  type IntakeDraft,
  type RoadmapEvolutionEntry,
  type StoredDailyPlan,
  type Subscription,
  type SubscriptionTier,
  tierGoalLimit,
} from "@/types/atlas";

const EMPTY_BEHAVIORAL: BehavioralSnapshot = {
  completedTaskTitles: [],
  missedTaskTitles: [],
  currentStreakDays: 0,
  completionRate: 0,
  recentNotes: [],
};

type AtlasState = {
  loaded: boolean;
  goals: Goal[];
  activeGoalId: string | null;
  subscription: Subscription;
  account: AccountPrefs;
  pendingDraft: IntakeDraft | null;
};

type GoalUpdater = (goal: Goal) => Goal;

type AtlasContextValue = AtlasState & {
  activeGoal: Goal | null;
  activeProfile: UserProfile | null;
  activeRoadmap: Roadmap | null;
  activeDailyPlan: StoredDailyPlan | null;
  activeCoachHistory: ChatMessage[];
  activeTaskHistory: TaskHistoryEntry[];
  activeReflections: ReflectionEntry[];
  activeBehavioralProfile: BehavioralProfile | null;
  activeRoadmapEvolutions: RoadmapEvolutionEntry[];
  activeLastEvolvedAt: string | null;
  activeCoachMemory: CoachMemory | null;
  activeBehavioral: BehavioralSnapshot;
  activeCurrentWeek: number;
  activeCurrentPhase: CurrentPhaseSnapshot | null;
  goalLimit: number;
  canAddMoreGoals: boolean;

  createGoal: (profile: UserProfile) => Promise<Goal>;
  removeGoal: (goalId: string) => Promise<void>;
  setActiveGoal: (goalId: string) => Promise<void>;

  updateGoal: (goalId: string, updater: GoalUpdater) => Promise<void>;
  updateActiveGoal: (updater: GoalUpdater) => Promise<void>;
  setActiveRoadmap: (roadmap: Roadmap | null) => Promise<void>;
  setRoadmapForGoal: (goalId: string, roadmap: Roadmap | null) => Promise<void>;
  setActiveDailyPlan: (plan: DailyPlan | null) => Promise<void>;
  recordActiveTask: (entry: TaskHistoryEntry) => Promise<void>;
  recordActiveReflection: (entry: ReflectionEntry) => Promise<void>;
  setActiveBehavioralProfile: (profile: BehavioralProfile | null) => Promise<void>;
  applyRoadmapEvolution: (
    goalId: string,
    evolvedRoadmap: Roadmap,
    entry: RoadmapEvolutionEntry,
  ) => Promise<void>;
  setActiveCoachHistory: (history: ChatMessage[]) => Promise<void>;
  appendActiveCoachMessage: (msg: ChatMessage) => Promise<void>;
  setActiveCoachMemory: (memory: CoachMemory | null) => Promise<void>;
  applyCoachMemoryUpdate: (update: {
    summary: string;
    newFacts: string[];
  }) => Promise<void>;

  setPendingDraft: (draft: IntakeDraft | null) => Promise<void>;
  updatePendingAnswers: (answers: IntakeAnswer[]) => Promise<void>;
  attachPendingQuestions: (
    questions: IntakeQuestion[],
    introMessage: string,
  ) => Promise<void>;
  attachPendingProfile: (profile: UserProfile, followUp?: string) => Promise<void>;

  updateSubscription: (tier: SubscriptionTier) => Promise<void>;
  updateAccount: (prefs: Partial<AccountPrefs>) => Promise<void>;

  resetAll: () => Promise<void>;
};

export class GoalLimitError extends Error {
  constructor(public limit: number) {
    super(`Goal limit reached: ${limit}`);
    this.name = "GoalLimitError";
  }
}

const AtlasContext = createContext<AtlasContextValue | undefined>(undefined);

function computeBehavioral(history: TaskHistoryEntry[]): BehavioralSnapshot {
  const today = todayISO();
  const recent = history.filter((h) => {
    const date = new Date(h.date);
    const diffMs = Date.now() - date.getTime();
    return diffMs <= 1000 * 60 * 60 * 24 * 14;
  });
  const completed = recent.filter((h) => h.completed);
  const missed = recent.filter((h) => !h.completed);
  const completionRate =
    recent.length > 0 ? completed.length / recent.length : 0;

  const dayMap = new Map<string, boolean>();
  for (const entry of history) {
    if (entry.completed) dayMap.set(entry.date, true);
  }
  let streak = 0;
  const cursor = new Date(today + "T00:00:00");
  while (true) {
    const iso = cursor.toISOString().slice(0, 10);
    if (dayMap.get(iso)) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }

  return {
    completedTaskTitles: completed.slice(-12).map((h) => h.taskTitle),
    missedTaskTitles: missed.slice(-12).map((h) => h.taskTitle),
    currentStreakDays: streak,
    completionRate,
    recentNotes: [],
  };
}

function computeCurrentWeek(startDate: string | null): number {
  if (!startDate) return 1;
  const start = new Date(startDate + "T00:00:00");
  const now = new Date();
  const days = Math.floor(
    (now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
  );
  return Math.max(1, Math.floor(days / 7) + 1);
}

async function migrateV1ToGoal(): Promise<Goal | null> {
  const v1 = await readV1ForMigration();
  if (!v1?.profile) return null;
  const profile = v1.profile as UserProfile;
  const goal: Goal = {
    id: makeId("goal"),
    createdAt: new Date().toISOString(),
    startDate: v1.startDate ?? todayISO(),
    profile,
    roadmap: (v1.roadmap as Roadmap | null) ?? null,
    dailyPlan: (v1.dailyPlan as StoredDailyPlan | null) ?? null,
    coachHistory: (v1.coachHistory as ChatMessage[] | null) ?? [],
    taskHistory: (v1.taskHistory as TaskHistoryEntry[] | null) ?? [],
    reflections: [],
    behavioralProfile: null,
    roadmapEvolutions: [],
    lastEvolvedAt: null,
    coachMemory: null,
  };
  await clearV1Storage();
  return goal;
}

// Backfill any newer optional fields on goals stored before they existed so
// the rest of the provider can rely on them being defined.
function ensureGoalShape(goal: Goal): Goal {
  const needsPhase1 =
    !goal.reflections || goal.behavioralProfile === undefined;
  const needsPhase2 =
    !goal.roadmapEvolutions || goal.lastEvolvedAt === undefined;
  const needsPhase3 = goal.coachMemory === undefined;
  if (!needsPhase1 && !needsPhase2 && !needsPhase3) return goal;
  return {
    ...goal,
    reflections: goal.reflections ?? [],
    behavioralProfile: goal.behavioralProfile ?? null,
    roadmapEvolutions: goal.roadmapEvolutions ?? [],
    lastEvolvedAt: goal.lastEvolvedAt ?? null,
    coachMemory: goal.coachMemory ?? null,
  };
}

export function AtlasProvider({ children }: { children: React.ReactNode }) {
  const [loaded, setLoaded] = useState(false);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [activeGoalId, setActiveGoalId] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<Subscription>(DEFAULT_SUBSCRIPTION);
  const [account, setAccount] = useState<AccountPrefs>(DEFAULT_ACCOUNT);
  const [pendingDraft, setPendingDraftState] = useState<IntakeDraft | null>(null);

  // Refs always reflect the latest state so callbacks avoid stale-closure bugs
  // when chained synchronously across awaits (e.g. createGoal then setActiveRoadmap).
  const goalsRef = useRef<Goal[]>([]);
  const activeIdRef = useRef<string | null>(null);
  const subscriptionRef = useRef<Subscription>(DEFAULT_SUBSCRIPTION);

  // Initial load + v1 migration
  useEffect(() => {
    (async () => {
      const [storedGoals, storedActive, storedSub, storedAcc, storedDraft, migratedFlag] =
        await Promise.all([
          loadJson<Goal[]>(STORAGE_KEYS.goals),
          loadJson<string>(STORAGE_KEYS.activeGoalId),
          loadJson<Subscription>(STORAGE_KEYS.subscription),
          loadJson<AccountPrefs>(STORAGE_KEYS.account),
          loadJson<IntakeDraft>(STORAGE_KEYS.pendingDraft),
          loadJson<boolean>(STORAGE_KEYS.migrated),
        ]);

      let goalsList = (storedGoals ?? []).map(ensureGoalShape);
      let active = storedActive ?? null;

      if (goalsList.length === 0 && !migratedFlag) {
        const migrated = await migrateV1ToGoal();
        if (migrated) {
          goalsList = [migrated];
          active = migrated.id;
          await saveJson(STORAGE_KEYS.goals, goalsList);
          await saveJson(STORAGE_KEYS.activeGoalId, active);
        }
        await saveJson(STORAGE_KEYS.migrated, true);
      }

      if (active && !goalsList.find((g) => g.id === active)) {
        active = goalsList[0]?.id ?? null;
      }
      if (!active && goalsList.length > 0) {
        active = goalsList[0].id;
      }

      goalsRef.current = goalsList;
      activeIdRef.current = active;
      const sub = storedSub ?? DEFAULT_SUBSCRIPTION;
      subscriptionRef.current = sub;

      setGoals(goalsList);
      setActiveGoalId(active);
      setSubscription(sub);
      setAccount(storedAcc ?? DEFAULT_ACCOUNT);
      setPendingDraftState(storedDraft ?? null);
      setLoaded(true);
    })();
  }, []);

  // Keep refs in sync with state on every commit.
  useEffect(() => {
    goalsRef.current = goals;
  }, [goals]);
  useEffect(() => {
    activeIdRef.current = activeGoalId;
  }, [activeGoalId]);
  useEffect(() => {
    subscriptionRef.current = subscription;
  }, [subscription]);

  const persistGoals = useCallback(async (next: Goal[]) => {
    goalsRef.current = next;
    setGoals(next);
    await saveJson(STORAGE_KEYS.goals, next);
  }, []);

  const persistActive = useCallback(async (id: string | null) => {
    activeIdRef.current = id;
    setActiveGoalId(id);
    if (id) await saveJson(STORAGE_KEYS.activeGoalId, id);
    else await removeKey(STORAGE_KEYS.activeGoalId);
  }, []);

  const activeGoal = useMemo(
    () => goals.find((g) => g.id === activeGoalId) ?? null,
    [goals, activeGoalId],
  );

  const activeBehavioral = useMemo(
    () => (activeGoal ? computeBehavioral(activeGoal.taskHistory) : EMPTY_BEHAVIORAL),
    [activeGoal],
  );

  const activeCurrentWeek = useMemo(
    () => computeCurrentWeek(activeGoal?.startDate ?? null),
    [activeGoal],
  );

  // Locate the phase whose week range contains the current week. Phases are
  // 1-indexed and inclusive on both ends; weeks beyond the final phase clamp
  // to the last phase so the coach still has a "where am I" anchor.
  const activeCurrentPhase = useMemo<CurrentPhaseSnapshot | null>(() => {
    const phases = activeGoal?.roadmap?.phases;
    if (!phases || phases.length === 0) return null;
    const week = activeCurrentWeek;
    const found =
      phases.find((p) => week >= p.startWeek && week <= p.endWeek) ??
      phases[phases.length - 1];
    if (!found) return null;
    return {
      id: found.id,
      title: found.title,
      focus: found.focus,
      startWeek: found.startWeek,
      endWeek: found.endWeek,
      weekIntoPhase: Math.max(1, week - found.startWeek + 1),
    };
  }, [activeGoal, activeCurrentWeek]);

  const goalLimit = tierGoalLimit(subscription.tier);
  const canAddMoreGoals = goals.length < goalLimit;

  const createGoal = useCallback(
    async (profile: UserProfile): Promise<Goal> => {
      // Provider-level limit guard (defense-in-depth on top of UI gating).
      const currentGoals = goalsRef.current;
      const currentLimit = tierGoalLimit(subscriptionRef.current.tier);
      if (currentGoals.length >= currentLimit) {
        throw new GoalLimitError(currentLimit);
      }
      const goal: Goal = {
        id: makeId("goal"),
        createdAt: new Date().toISOString(),
        startDate: todayISO(),
        profile,
        roadmap: null,
        dailyPlan: null,
        coachHistory: [],
        taskHistory: [],
        reflections: [],
        behavioralProfile: null,
        roadmapEvolutions: [],
        lastEvolvedAt: null,
        coachMemory: null,
      };
      const next = [...currentGoals, goal];
      await persistGoals(next);
      await persistActive(goal.id);
      return goal;
    },
    [persistGoals, persistActive],
  );

  const removeGoal = useCallback(
    async (goalId: string) => {
      const next = goalsRef.current.filter((g) => g.id !== goalId);
      await persistGoals(next);
      if (activeIdRef.current === goalId) {
        await persistActive(next[0]?.id ?? null);
      }
    },
    [persistGoals, persistActive],
  );

  const setActiveGoal = useCallback(
    async (goalId: string) => {
      if (!goalsRef.current.find((g) => g.id === goalId)) return;
      await persistActive(goalId);
    },
    [persistActive],
  );

  const updateGoal = useCallback(
    async (goalId: string, updater: GoalUpdater) => {
      const next = goalsRef.current.map((g) => (g.id === goalId ? updater(g) : g));
      await persistGoals(next);
    },
    [persistGoals],
  );

  const updateActiveGoal = useCallback(
    async (updater: GoalUpdater) => {
      const id = activeIdRef.current;
      if (!id) return;
      await updateGoal(id, updater);
    },
    [updateGoal],
  );

  const setRoadmapForGoal = useCallback(
    async (goalId: string, roadmap: Roadmap | null) => {
      await updateGoal(goalId, (g) => ({ ...g, roadmap }));
    },
    [updateGoal],
  );

  const setActiveRoadmap = useCallback(
    async (roadmap: Roadmap | null) => {
      const id = activeIdRef.current;
      if (!id) return;
      await setRoadmapForGoal(id, roadmap);
    },
    [setRoadmapForGoal],
  );

  const setActiveDailyPlan = useCallback(
    async (plan: DailyPlan | null) => {
      const stored: StoredDailyPlan | null = plan
        ? { plan, generatedAt: new Date().toISOString() }
        : null;
      await updateActiveGoal((g) => ({ ...g, dailyPlan: stored }));
    },
    [updateActiveGoal],
  );

  const recordActiveTask = useCallback(
    async (entry: TaskHistoryEntry) => {
      await updateActiveGoal((g) => {
        const filtered = g.taskHistory.filter(
          (e) => !(e.taskId === entry.taskId && e.date === entry.date),
        );
        return { ...g, taskHistory: [...filtered, entry].slice(-200) };
      });
    },
    [updateActiveGoal],
  );

  const recordActiveReflection = useCallback(
    async (entry: ReflectionEntry) => {
      await updateActiveGoal((g) => {
        // Replace any existing reflection for the same task on the same day,
        // and mirror reasonTag/note onto the matching task history entry so
        // the AI sees both signals together.
        const reflections = g.reflections.filter(
          (r) => !(r.taskId === entry.taskId && r.date === entry.date),
        );
        const taskHistory = g.taskHistory.map((e) =>
          e.taskId === entry.taskId && e.date === entry.date
            ? {
                ...e,
                reasonTag: entry.reasonTag ?? e.reasonTag,
                note: entry.note ?? e.note,
                reflectedAt: entry.reflectedAt,
              }
            : e,
        );
        return {
          ...g,
          reflections: [...reflections, entry].slice(-50),
          taskHistory,
        };
      });
    },
    [updateActiveGoal],
  );

  const setActiveBehavioralProfile = useCallback(
    async (profile: BehavioralProfile | null) => {
      await updateActiveGoal((g) => ({ ...g, behavioralProfile: profile }));
    },
    [updateActiveGoal],
  );

  const applyRoadmapEvolution = useCallback(
    async (
      goalId: string,
      evolvedRoadmap: Roadmap,
      entry: RoadmapEvolutionEntry,
    ) => {
      // Route the write through `updateGoal(goalId, ...)` so a mid-flight goal
      // switch can't land an evolution on the wrong goal — the caller pins the
      // target by capturing `activeGoalId` at request start.
      await updateGoal(goalId, (g) => ({
        ...g,
        roadmap: evolvedRoadmap,
        // Most recent first, cap at 10 historical entries.
        roadmapEvolutions: [entry, ...g.roadmapEvolutions].slice(0, 10),
        lastEvolvedAt: entry.evolvedAt,
      }));
    },
    [updateGoal],
  );

  const setActiveCoachHistory = useCallback(
    async (history: ChatMessage[]) => {
      await updateActiveGoal((g) => ({ ...g, coachHistory: history.slice(-30) }));
    },
    [updateActiveGoal],
  );

  const appendActiveCoachMessage = useCallback(
    async (msg: ChatMessage) => {
      await updateActiveGoal((g) => ({
        ...g,
        coachHistory: [...g.coachHistory, msg].slice(-30),
      }));
    },
    [updateActiveGoal],
  );

  const setActiveCoachMemory = useCallback(
    async (memory: CoachMemory | null) => {
      await updateActiveGoal((g) => ({ ...g, coachMemory: memory }));
    },
    [updateActiveGoal],
  );

  const applyCoachMemoryUpdate = useCallback(
    async (update: { summary: string; newFacts: string[] }) => {
      await updateActiveGoal((g) => {
        const existing = g.coachMemory;
        const existingFacts = existing?.facts ?? [];
        // Dedupe new facts case-insensitively against what we already know,
        // then keep the most recent 20 across the merged list.
        const seen = new Set(existingFacts.map((f) => f.toLowerCase()));
        const incoming = (update.newFacts ?? [])
          .map((f) => f.trim())
          .filter((f) => f.length > 0)
          .filter((f) => {
            const k = f.toLowerCase();
            if (seen.has(k)) return false;
            seen.add(k);
            return true;
          });
        const facts = [...existingFacts, ...incoming].slice(-20);
        const merged: CoachMemory = {
          summary: update.summary,
          facts,
          updatedAt: new Date().toISOString(),
        };
        return { ...g, coachMemory: merged };
      });
    },
    [updateActiveGoal],
  );

  const setPendingDraft = useCallback(async (draft: IntakeDraft | null) => {
    setPendingDraftState(draft);
    if (draft) await saveJson(STORAGE_KEYS.pendingDraft, draft);
    else await removeKey(STORAGE_KEYS.pendingDraft);
  }, []);

  const updatePendingAnswers = useCallback(async (answers: IntakeAnswer[]) => {
    setPendingDraftState((prev) => {
      if (!prev) return prev;
      const next = { ...prev, answers };
      void saveJson(STORAGE_KEYS.pendingDraft, next);
      return next;
    });
  }, []);

  const attachPendingQuestions = useCallback(
    async (questions: IntakeQuestion[], introMessage: string) => {
      setPendingDraftState((prev) => {
        if (!prev) return prev;
        const next: IntakeDraft = {
          ...prev,
          questions,
          introMessage,
          stage: "answering",
        };
        void saveJson(STORAGE_KEYS.pendingDraft, next);
        return next;
      });
    },
    [],
  );

  const attachPendingProfile = useCallback(
    async (profile: UserProfile, followUp?: string) => {
      setPendingDraftState((prev) => {
        if (!prev) return prev;
        const next: IntakeDraft = {
          ...prev,
          synthesizedProfile: profile,
          followUp,
          stage: "ready_to_generate",
        };
        void saveJson(STORAGE_KEYS.pendingDraft, next);
        return next;
      });
    },
    [],
  );

  const updateSubscription = useCallback(async (tier: SubscriptionTier) => {
    const next: Subscription = { tier, startedAt: new Date().toISOString() };
    subscriptionRef.current = next;
    setSubscription(next);
    await saveJson(STORAGE_KEYS.subscription, next);
  }, []);

  const updateAccount = useCallback(async (prefs: Partial<AccountPrefs>) => {
    setAccount((prev) => {
      const next = { ...prev, ...prefs };
      void saveJson(STORAGE_KEYS.account, next);
      return next;
    });
  }, []);

  const resetAll = useCallback(async () => {
    await clearAllAtlas();
    goalsRef.current = [];
    activeIdRef.current = null;
    subscriptionRef.current = DEFAULT_SUBSCRIPTION;
    setGoals([]);
    setActiveGoalId(null);
    setSubscription(DEFAULT_SUBSCRIPTION);
    setAccount(DEFAULT_ACCOUNT);
    setPendingDraftState(null);
  }, []);

  const value: AtlasContextValue = {
    loaded,
    goals,
    activeGoalId,
    subscription,
    account,
    pendingDraft,
    activeGoal,
    activeProfile: activeGoal?.profile ?? null,
    activeRoadmap: activeGoal?.roadmap ?? null,
    activeDailyPlan: activeGoal?.dailyPlan ?? null,
    activeCoachHistory: activeGoal?.coachHistory ?? [],
    activeTaskHistory: activeGoal?.taskHistory ?? [],
    activeReflections: activeGoal?.reflections ?? [],
    activeBehavioralProfile: activeGoal?.behavioralProfile ?? null,
    activeRoadmapEvolutions: activeGoal?.roadmapEvolutions ?? [],
    activeLastEvolvedAt: activeGoal?.lastEvolvedAt ?? null,
    activeCoachMemory: activeGoal?.coachMemory ?? null,
    activeBehavioral,
    activeCurrentWeek,
    activeCurrentPhase,
    goalLimit,
    canAddMoreGoals,
    createGoal,
    removeGoal,
    setActiveGoal,
    updateGoal,
    updateActiveGoal,
    setActiveRoadmap,
    setRoadmapForGoal,
    setActiveDailyPlan,
    recordActiveTask,
    recordActiveReflection,
    setActiveBehavioralProfile,
    applyRoadmapEvolution,
    setActiveCoachHistory,
    appendActiveCoachMessage,
    setActiveCoachMemory,
    applyCoachMemoryUpdate,
    setPendingDraft,
    updatePendingAnswers,
    attachPendingQuestions,
    attachPendingProfile,
    updateSubscription,
    updateAccount,
    resetAll,
  };

  return <AtlasContext.Provider value={value}>{children}</AtlasContext.Provider>;
}

export function useAtlas() {
  const ctx = useContext(AtlasContext);
  if (!ctx) throw new Error("useAtlas must be used within AtlasProvider");
  return ctx;
}
