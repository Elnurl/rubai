import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type {
  BehavioralSnapshot,
  ChatMessage,
  DailyPlan,
  GoalType,
  Roadmap,
  UserProfile,
} from "@workspace/api-client-react";
import {
  STORAGE_KEYS,
  TaskHistoryEntry,
  clearAllAtlas,
  loadJson,
  removeKey,
  saveJson,
  todayISO,
} from "@/lib/storage";

type StoredDailyPlan = {
  plan: DailyPlan;
  generatedAt: string;
};

export type AtlasState = {
  loaded: boolean;
  profile: UserProfile | null;
  roadmap: Roadmap | null;
  dailyPlan: StoredDailyPlan | null;
  onboardingHistory: ChatMessage[];
  coachHistory: ChatMessage[];
  taskHistory: TaskHistoryEntry[];
  startDate: string | null;
  pendingGoalType: GoalType | null;
  pendingCustomGoalTitle: string | null;
  behavioral: BehavioralSnapshot;
  currentWeek: number;
};

type AtlasContextValue = AtlasState & {
  setPendingGoalType: (g: GoalType | null) => Promise<void>;
  setPendingCustomGoalTitle: (t: string | null) => Promise<void>;
  setOnboardingHistory: (h: ChatMessage[]) => Promise<void>;
  setProfile: (p: UserProfile | null) => Promise<void>;
  setRoadmap: (r: Roadmap | null) => Promise<void>;
  setDailyPlan: (p: DailyPlan | null) => Promise<void>;
  recordTask: (entry: TaskHistoryEntry) => Promise<void>;
  appendCoachMessage: (msg: ChatMessage) => Promise<void>;
  setCoachHistory: (h: ChatMessage[]) => Promise<void>;
  resetAll: () => Promise<void>;
};

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

  // Streak: count consecutive days back from today where any task completed
  const dayMap = new Map<string, boolean>();
  for (const entry of history) {
    if (entry.completed) {
      dayMap.set(entry.date, true);
    }
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
  const days = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(1, Math.floor(days / 7) + 1);
}

export function AtlasProvider({ children }: { children: React.ReactNode }) {
  const [loaded, setLoaded] = useState(false);
  const [profile, setProfileState] = useState<UserProfile | null>(null);
  const [roadmap, setRoadmapState] = useState<Roadmap | null>(null);
  const [dailyPlan, setDailyPlanState] = useState<StoredDailyPlan | null>(null);
  const [onboardingHistory, setOnboardingHistoryState] = useState<ChatMessage[]>([]);
  const [coachHistory, setCoachHistoryState] = useState<ChatMessage[]>([]);
  const [taskHistory, setTaskHistoryState] = useState<TaskHistoryEntry[]>([]);
  const [startDate, setStartDateState] = useState<string | null>(null);
  const [pendingGoalType, setPendingGoalTypeState] = useState<GoalType | null>(null);
  const [pendingCustomGoalTitle, setPendingCustomGoalTitleState] = useState<string | null>(
    null,
  );

  useEffect(() => {
    (async () => {
      const [p, r, dp, oh, ch, th, sd, pg, pct] = await Promise.all([
        loadJson<UserProfile>(STORAGE_KEYS.profile),
        loadJson<Roadmap>(STORAGE_KEYS.roadmap),
        loadJson<StoredDailyPlan>(STORAGE_KEYS.dailyPlan),
        loadJson<ChatMessage[]>(STORAGE_KEYS.onboardingHistory),
        loadJson<ChatMessage[]>(STORAGE_KEYS.coachHistory),
        loadJson<TaskHistoryEntry[]>(STORAGE_KEYS.taskHistory),
        loadJson<string>(STORAGE_KEYS.startDate),
        loadJson<GoalType>(STORAGE_KEYS.pendingGoalType),
        loadJson<string>(STORAGE_KEYS.pendingCustomGoalTitle),
      ]);
      setProfileState(p);
      setRoadmapState(r);
      setDailyPlanState(dp);
      setOnboardingHistoryState(oh ?? []);
      setCoachHistoryState(ch ?? []);
      setTaskHistoryState(th ?? []);
      setStartDateState(sd);
      setPendingGoalTypeState(pg);
      setPendingCustomGoalTitleState(pct);
      setLoaded(true);
    })();
  }, []);

  const behavioral = useMemo(() => computeBehavioral(taskHistory), [taskHistory]);
  const currentWeek = useMemo(() => computeCurrentWeek(startDate), [startDate]);

  const setProfile = useCallback(async (p: UserProfile | null) => {
    setProfileState(p);
    if (p) {
      await saveJson(STORAGE_KEYS.profile, p);
      if (!startDate) {
        const today = todayISO();
        setStartDateState(today);
        await saveJson(STORAGE_KEYS.startDate, today);
      }
    } else {
      await removeKey(STORAGE_KEYS.profile);
    }
  }, [startDate]);

  const setRoadmap = useCallback(async (r: Roadmap | null) => {
    setRoadmapState(r);
    if (r) await saveJson(STORAGE_KEYS.roadmap, r);
    else await removeKey(STORAGE_KEYS.roadmap);
  }, []);

  const setDailyPlan = useCallback(async (p: DailyPlan | null) => {
    if (p) {
      const stored: StoredDailyPlan = { plan: p, generatedAt: new Date().toISOString() };
      setDailyPlanState(stored);
      await saveJson(STORAGE_KEYS.dailyPlan, stored);
    } else {
      setDailyPlanState(null);
      await removeKey(STORAGE_KEYS.dailyPlan);
    }
  }, []);

  const setOnboardingHistory = useCallback(async (h: ChatMessage[]) => {
    setOnboardingHistoryState(h);
    await saveJson(STORAGE_KEYS.onboardingHistory, h);
  }, []);

  const setCoachHistory = useCallback(async (h: ChatMessage[]) => {
    setCoachHistoryState(h);
    await saveJson(STORAGE_KEYS.coachHistory, h);
  }, []);

  const appendCoachMessage = useCallback(async (msg: ChatMessage) => {
    setCoachHistoryState((prev) => {
      const next = [...prev, msg].slice(-30);
      void saveJson(STORAGE_KEYS.coachHistory, next);
      return next;
    });
  }, []);

  const recordTask = useCallback(async (entry: TaskHistoryEntry) => {
    setTaskHistoryState((prev) => {
      const filtered = prev.filter(
        (e) => !(e.taskId === entry.taskId && e.date === entry.date),
      );
      const next = [...filtered, entry].slice(-200);
      void saveJson(STORAGE_KEYS.taskHistory, next);
      return next;
    });
  }, []);

  const setPendingGoalType = useCallback(async (g: GoalType | null) => {
    setPendingGoalTypeState(g);
    if (g) await saveJson(STORAGE_KEYS.pendingGoalType, g);
    else await removeKey(STORAGE_KEYS.pendingGoalType);
  }, []);

  const setPendingCustomGoalTitle = useCallback(async (t: string | null) => {
    setPendingCustomGoalTitleState(t);
    if (t) await saveJson(STORAGE_KEYS.pendingCustomGoalTitle, t);
    else await removeKey(STORAGE_KEYS.pendingCustomGoalTitle);
  }, []);

  const resetAll = useCallback(async () => {
    await clearAllAtlas();
    setProfileState(null);
    setRoadmapState(null);
    setDailyPlanState(null);
    setOnboardingHistoryState([]);
    setCoachHistoryState([]);
    setTaskHistoryState([]);
    setStartDateState(null);
    setPendingGoalTypeState(null);
    setPendingCustomGoalTitleState(null);
  }, []);

  const value: AtlasContextValue = {
    loaded,
    profile,
    roadmap,
    dailyPlan,
    onboardingHistory,
    coachHistory,
    taskHistory,
    startDate,
    pendingGoalType,
    pendingCustomGoalTitle,
    behavioral,
    currentWeek,
    setPendingGoalType,
    setPendingCustomGoalTitle,
    setOnboardingHistory,
    setProfile,
    setRoadmap,
    setDailyPlan,
    recordTask,
    appendCoachMessage,
    setCoachHistory,
    resetAll,
  };

  return <AtlasContext.Provider value={value}>{children}</AtlasContext.Provider>;
}

export function useAtlas() {
  const ctx = useContext(AtlasContext);
  if (!ctx) throw new Error("useAtlas must be used within AtlasProvider");
  return ctx;
}
