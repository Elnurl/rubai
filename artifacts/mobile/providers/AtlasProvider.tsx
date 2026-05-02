import { useAuth } from "@clerk/expo";
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
  MeStateConflictResponse,
  MeStateRequest,
  MeStateResponse,
  ReflectionEntry,
  Roadmap,
  UserProfile,
} from "@workspace/api-client-react";
import { ApiError, getMeState, putMeState } from "@workspace/api-client-react";
import {
  TaskHistoryEntry,
  clearAllAtlas,
  clearLegacyV2Snapshot,
  clearUserCache,
  getMigratedFlag,
  loadLegacyV2Goals,
  loadUserCache,
  makeId,
  saveUserCache,
  setMigratedFlag,
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

type SyncStatus = "idle" | "loading" | "syncing" | "conflict" | "error";

type AtlasState = {
  loaded: boolean;
  goals: Goal[];
  activeGoalId: string | null;
  subscription: Subscription;
  account: AccountPrefs;
  pendingDraft: IntakeDraft | null;
  tier: string;
  syncStatus: SyncStatus;
  syncMessage: string | null;
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

  // Tier is now server-controlled. This becomes a no-op locally; kept for
  // compatibility with any callsites that still reference it.
  updateSubscription: (tier: SubscriptionTier) => Promise<void>;
  updateAccount: (prefs: Partial<AccountPrefs>) => Promise<void>;

  resetAll: () => Promise<void>;
  signOut: () => Promise<void>;
  dismissSyncMessage: () => void;
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

// Backfill any newer optional fields on goals stored before they existed so
// the rest of the provider can rely on them being defined. Also runs on goals
// loaded from the cloud, since older clients may have pushed sparser blobs.
function ensureGoalShape(goal: Goal): Goal {
  return {
    ...goal,
    reflections: goal.reflections ?? [],
    behavioralProfile: goal.behavioralProfile ?? null,
    roadmapEvolutions: goal.roadmapEvolutions ?? [],
    lastEvolvedAt: goal.lastEvolvedAt ?? null,
    coachMemory: goal.coachMemory ?? null,
  };
}

function tierToSubscription(tier: string): Subscription {
  // The local Subscription type is the Phase 3 union; we coerce unknown values
  // back to the default so the UI never crashes on a future server tier.
  const known: SubscriptionTier[] = ["free", "pro", "premium"];
  const safeTier = (known as readonly string[]).includes(tier)
    ? (tier as SubscriptionTier)
    : DEFAULT_SUBSCRIPTION.tier;
  return { tier: safeTier, startedAt: new Date(0).toISOString() };
}

function pickAccountPrefs(blob: unknown): AccountPrefs {
  if (!blob || typeof blob !== "object") return DEFAULT_ACCOUNT;
  const b = blob as Partial<AccountPrefs>;
  return {
    notificationsEnabled:
      typeof b.notificationsEnabled === "boolean"
        ? b.notificationsEnabled
        : DEFAULT_ACCOUNT.notificationsEnabled,
    performanceUpdates:
      typeof b.performanceUpdates === "boolean"
        ? b.performanceUpdates
        : DEFAULT_ACCOUNT.performanceUpdates,
    reminderTime:
      typeof b.reminderTime === "string"
        ? b.reminderTime
        : DEFAULT_ACCOUNT.reminderTime,
  };
}

export function AtlasProvider({ children }: { children: React.ReactNode }) {
  const { isLoaded: clerkLoaded, isSignedIn, userId, signOut: clerkSignOut } =
    useAuth();

  const [loaded, setLoaded] = useState(false);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [activeGoalId, setActiveGoalId] = useState<string | null>(null);
  const [tier, setTier] = useState<string>(DEFAULT_SUBSCRIPTION.tier);
  const [account, setAccount] = useState<AccountPrefs>(DEFAULT_ACCOUNT);
  const [pendingDraft, setPendingDraftState] = useState<IntakeDraft | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  // Refs always reflect the latest state so callbacks avoid stale-closure bugs
  // when chained synchronously across awaits (e.g. createGoal then setActiveRoadmap).
  const goalsRef = useRef<Goal[]>([]);
  const activeIdRef = useRef<string | null>(null);
  const accountRef = useRef<AccountPrefs>(DEFAULT_ACCOUNT);
  const pendingDraftRef = useRef<IntakeDraft | null>(null);

  // Server-side concurrency cursor. Set after every successful GET/PUT.
  const versionRef = useRef<number>(0);
  // Active Clerk user the in-memory state belongs to. Used to detect
  // identity flips and avoid pushing one user's data under another's session.
  const ownerRef = useRef<string | null>(null);
  // Coalesce push requests: if a push is in-flight we just mark dirty and the
  // running loop will fire one more PUT after the current one resolves.
  const pushInFlightRef = useRef(false);
  const pushDirtyRef = useRef(false);
  // Quiet pushes during the initial boot/hydrate sequence so adopting server
  // state doesn't immediately echo it back as a write.
  const suppressPushRef = useRef(true);

  // Latest-tier ref so writeCacheSnapshot can stay reference-stable. If we
  // closed over `tier` directly, the useCallback would change identity every
  // time tier flipped, which would re-trigger the boot effect mid-flight,
  // cancel the in-flight async work, and leave the user stuck on the splash.
  const tierRef = useRef<string>(DEFAULT_SUBSCRIPTION.tier);

  // Keep refs in sync with state on every commit.
  useEffect(() => {
    goalsRef.current = goals;
  }, [goals]);
  useEffect(() => {
    activeIdRef.current = activeGoalId;
  }, [activeGoalId]);
  useEffect(() => {
    accountRef.current = account;
  }, [account]);
  useEffect(() => {
    pendingDraftRef.current = pendingDraft;
  }, [pendingDraft]);
  useEffect(() => {
    tierRef.current = tier;
  }, [tier]);

  // ----- Server adoption helpers ---------------------------------------

  const adoptServerState = useCallback(
    (state: MeStateResponse) => {
      const nextGoals = (state.goals as unknown as Goal[]).map(ensureGoalShape);
      goalsRef.current = nextGoals;
      activeIdRef.current = state.activeGoalId;
      accountRef.current = pickAccountPrefs(state.accountPrefs);
      pendingDraftRef.current = (state.pendingDraft as IntakeDraft | null) ?? null;
      versionRef.current = state.version;

      setGoals(nextGoals);
      setActiveGoalId(state.activeGoalId);
      setAccount(accountRef.current);
      setPendingDraftState(pendingDraftRef.current);
      setTier(state.tier);
    },
    [],
  );

  const writeCacheSnapshot = useCallback(async (clerkUserId: string) => {
    await saveUserCache(clerkUserId, {
      goals: goalsRef.current,
      activeGoalId: activeIdRef.current,
      accountPrefs: accountRef.current,
      pendingDraft: pendingDraftRef.current,
      version: versionRef.current,
      tier: tierRef.current,
    });
  }, []);

  // ----- Push loop ------------------------------------------------------

  const doPushOnce = useCallback(async () => {
    const owner = ownerRef.current;
    if (!owner) return;

    const body: MeStateRequest = {
      goals: goalsRef.current as unknown as MeStateRequest["goals"],
      activeGoalId: activeIdRef.current,
      accountPrefs: accountRef.current as unknown as MeStateRequest["accountPrefs"],
      pendingDraft:
        (pendingDraftRef.current as unknown as MeStateRequest["pendingDraft"]) ??
        null,
      expectedVersion: versionRef.current,
    };

    // After every await, re-check that the active owner is unchanged. A
    // late response from user A's PUT must NOT mutate React state under
    // user B's session (sign-out, account switch).
    const stillOwner = (): boolean => ownerRef.current === owner;

    try {
      const res = await putMeState(body);
      if (!stillOwner()) return;
      versionRef.current = res.version;
      setTier(res.tier);
      setSyncStatus("idle");
      setSyncMessage(null);
      await writeCacheSnapshot(owner);
    } catch (err) {
      if (!stillOwner()) return;
      if (err instanceof ApiError && err.status === 409) {
        const conflict = err.data as MeStateConflictResponse | null;
        if (conflict?.latest) {
          adoptServerState(conflict.latest);
          await writeCacheSnapshot(owner);
          if (!stillOwner()) return;
        } else {
          // Fall back to a fresh GET if the body wasn't shaped as expected.
          try {
            const latest = await getMeState();
            if (!stillOwner()) return;
            adoptServerState(latest);
            await writeCacheSnapshot(owner);
            if (!stillOwner()) return;
          } catch {
            if (!stillOwner()) return;
          }
        }
        // Drop the locally-queued change since the server version moved.
        pushDirtyRef.current = false;
        setSyncStatus("conflict");
        setSyncMessage(
          "Synced from another device. Your latest local edits were replaced.",
        );
        return;
      }
      // Network / 5xx / auth errors: leave local state in place; surface a
      // soft message and let the next mutation retry.
      setSyncStatus("error");
      setSyncMessage("Couldn't reach the cloud. Changes will sync when you're back online.");
      // eslint-disable-next-line no-console
      if (__DEV__) console.warn("[atlas] push failed", err);
    }
  }, [adoptServerState, writeCacheSnapshot]);

  const schedulePush = useCallback(() => {
    // Suppress during boot/hydrate — the UI is gated on `loaded=false` for
    // the duration of the boot sequence so no user mutation can reach this
    // path. The check is defensive belt-and-braces.
    if (suppressPushRef.current) return;
    if (!ownerRef.current) return;
    pushDirtyRef.current = true;
    if (pushInFlightRef.current) return;
    pushInFlightRef.current = true;
    setSyncStatus("syncing");
    void (async () => {
      try {
        while (pushDirtyRef.current) {
          pushDirtyRef.current = false;
          await doPushOnce();
        }
      } finally {
        pushInFlightRef.current = false;
      }
    })();
  }, [doPushOnce]);

  // ----- Boot / hydrate sequence ---------------------------------------

  // When Clerk reports a fresh signed-in user, adopt their cloud state. When
  // they sign out (or a different user signs in) reset in-memory state.
  useEffect(() => {
    if (!clerkLoaded) return;

    if (!isSignedIn || !userId) {
      // Sign-out (or pre-sign-in). Wipe in-memory state so the next user
      // doesn't see leftovers, but keep AsyncStorage caches around.
      suppressPushRef.current = true;
      ownerRef.current = null;
      goalsRef.current = [];
      activeIdRef.current = null;
      accountRef.current = DEFAULT_ACCOUNT;
      pendingDraftRef.current = null;
      versionRef.current = 0;
      setGoals([]);
      setActiveGoalId(null);
      setAccount(DEFAULT_ACCOUNT);
      setPendingDraftState(null);
      setTier(DEFAULT_SUBSCRIPTION.tier);
      setSyncStatus("idle");
      setSyncMessage(null);
      setLoaded(true);
      return;
    }

    // Signed-in. If the owner already matches we're already booted; nothing
    // to do (this guards against effect re-runs from Clerk re-emitting the
    // same identity).
    if (ownerRef.current === userId) return;

    let cancelled = false;
    suppressPushRef.current = true;
    ownerRef.current = userId;
    setLoaded(false);
    setSyncStatus("loading");
    setSyncMessage(null);

    // Safety net: under no circumstances should the user sit on the splash
    // forever. If the boot async work hasn't flipped `loaded` within 10s
    // (slow network, hung fetch, surprise re-render race, etc.) we force the
    // UI past the splash so they can at least see the app and retry. Cleared
    // on success in the boot work below.
    const safetyTimer = setTimeout(() => {
      if (cancelled) return;
      // eslint-disable-next-line no-console
      if (__DEV__) {
        console.warn(
          "[atlas] boot safety timeout fired — forcing loaded=true",
        );
      }
      setSyncStatus("error");
      setSyncMessage("Couldn't fully sync. You can keep using the app.");
      setLoaded(true);
    }, 10_000);

    // After every await in the boot async work we re-check ownership before
    // mutating React state. If the user signed out or switched accounts
    // mid-await, abandon the work — the new boot run owns the state.
    const stillBooting = (): boolean =>
      !cancelled && ownerRef.current === userId;

    // eslint-disable-next-line no-console
    if (__DEV__) console.log("[atlas] boot start for user", userId);

    void (async () => {
      // 1. Fast paint from per-user cache so the UI doesn't flash empty.
      // We deliberately do NOT setLoaded(true) here — the AuthGate keeps the
      // splash up until the server snapshot is adopted (or boot errors out).
      // This prevents a boot-vs-mutation race where the user could edit
      // cached data before the GET completes, only to have those edits
      // overwritten by adoptServerState(server).
      const cached = await loadUserCache<Goal, AccountPrefs, IntakeDraft>(userId);
      if (!stillBooting()) return;
      if (cached) {
        const cachedGoals = cached.goals.map(ensureGoalShape);
        goalsRef.current = cachedGoals;
        activeIdRef.current = cached.activeGoalId;
        accountRef.current = pickAccountPrefs(cached.accountPrefs);
        pendingDraftRef.current = cached.pendingDraft;
        versionRef.current = cached.version;
        setGoals(cachedGoals);
        setActiveGoalId(cached.activeGoalId);
        setAccount(accountRef.current);
        setPendingDraftState(pendingDraftRef.current);
        setTier(cached.tier);
      }

      // 2. GET /me/state to refresh against the server.
      try {
        const server = await getMeState();
        if (!stillBooting()) return;

        // Defensive: if the response body was empty for any reason (e.g. a
        // stale 304 from an upstream cache, a network proxy stripping the
        // body, etc.) treat it as a soft failure and exit the splash with
        // whatever we already painted from cache. Without this guard, the
        // user is stuck on the index screen spinner forever.
        if (server == null) {
          if (__DEV__) {
            // eslint-disable-next-line no-console
            console.warn(
              "[atlas] /me/state returned an empty body; staying on cached state",
            );
          }
          setSyncStatus("error");
          setSyncMessage("Couldn't reach the cloud. Showing your last sync.");
          setLoaded(true);
          return;
        }

        // 3. First-sign-in migration: if the server is empty for this user
        // and we have legacy local goals on this device that have never
        // been migrated, push them up.
        const migrated = await getMigratedFlag(userId);
        if (!stillBooting()) return;
        if (
          !migrated &&
          server.goals.length === 0 &&
          server.version === 0
        ) {
          const legacy = await loadLegacyV2Goals<Goal>();
          if (!stillBooting()) return;
          if (legacy && legacy.goals.length > 0) {
            const seededGoals = legacy.goals.map(ensureGoalShape);
            goalsRef.current = seededGoals;
            activeIdRef.current =
              legacy.activeGoalId &&
              seededGoals.find((g) => g.id === legacy.activeGoalId)
                ? legacy.activeGoalId
                : (seededGoals[0]?.id ?? null);
            accountRef.current = DEFAULT_ACCOUNT;
            pendingDraftRef.current = null;
            versionRef.current = 0;
            setGoals(seededGoals);
            setActiveGoalId(activeIdRef.current);
            setAccount(DEFAULT_ACCOUNT);
            setPendingDraftState(null);
            setTier(server.tier);
            // Defer setLoaded(true) until the migration PUT resolves so the
            // user can't mutate seeded data before it's been uploaded.

            try {
              const uploaded = await putMeState({
                goals: seededGoals as unknown as MeStateRequest["goals"],
                activeGoalId: activeIdRef.current,
                accountPrefs:
                  DEFAULT_ACCOUNT as unknown as MeStateRequest["accountPrefs"],
                pendingDraft: null,
                expectedVersion: 0,
              });
              if (!stillBooting()) return;
              versionRef.current = uploaded.version;
              setTier(uploaded.tier);
              await setMigratedFlag(userId);
              if (!stillBooting()) return;
              await clearLegacyV2Snapshot();
              if (!stillBooting()) return;
              await writeCacheSnapshot(userId);
              if (!stillBooting()) return;
              setSyncStatus("idle");
              setSyncMessage(
                "We brought your existing goals up to the cloud.",
              );
            } catch (err) {
              if (!stillBooting()) return;
              if (
                err instanceof ApiError &&
                err.status === 409 &&
                (err.data as MeStateConflictResponse | null)?.latest
              ) {
                // Server got data from another device first — adopt it and
                // stop trying to seed.
                const conflict = err.data as MeStateConflictResponse;
                adoptServerState(conflict.latest);
                await setMigratedFlag(userId);
                if (!stillBooting()) return;
                await writeCacheSnapshot(userId);
                if (!stillBooting()) return;
                setSyncStatus("idle");
                setSyncMessage(
                  "Loaded your goals from another device.",
                );
              } else {
                setSyncStatus("error");
                setSyncMessage(
                  "Couldn't upload local goals — we'll retry on your next change.",
                );
              }
            }
            if (!stillBooting()) return;
            setLoaded(true);
            return;
          }

          // No legacy data to migrate; record the flag so we never look again.
          await setMigratedFlag(userId);
          if (!stillBooting()) return;
        }

        // 4. Standard adoption path: trust the server snapshot.
        adoptServerState(server);
        await writeCacheSnapshot(userId);
        if (!stillBooting()) return;
        setLoaded(true);
        setSyncStatus("idle");
      } catch (err) {
        if (!stillBooting()) return;
        // If we already painted from cache, keep that and surface a soft
        // error. Otherwise we have nothing to show, so flip loaded=true
        // anyway so the UI exits its splash state.
        setSyncStatus("error");
        setSyncMessage("Couldn't reach the cloud. Showing your last sync.");
        setLoaded(true);
        // eslint-disable-next-line no-console
        if (__DEV__) console.warn("[atlas] hydrate failed", err);
      } finally {
        // Boot reached a terminal state (success or handled error) — the
        // safety net is no longer needed.
        clearTimeout(safetyTimer);
        // eslint-disable-next-line no-console
        if (__DEV__) console.log("[atlas] boot finished for user", userId);
        // Suppression is gated by ownership in schedulePush() too, but we
        // only lift it for the still-current owner. A stale boot returning
        // late should not re-enable pushes for the new owner.
        if (!cancelled && ownerRef.current === userId) {
          suppressPushRef.current = false;
        }
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(safetyTimer);
    };
  }, [clerkLoaded, isSignedIn, userId, adoptServerState, writeCacheSnapshot]);

  // ----- Local mutators (each schedules a push) ------------------------

  const persistGoals = useCallback(
    (next: Goal[]) => {
      goalsRef.current = next;
      setGoals(next);
      schedulePush();
    },
    [schedulePush],
  );

  const persistActive = useCallback(
    (id: string | null) => {
      activeIdRef.current = id;
      setActiveGoalId(id);
      schedulePush();
    },
    [schedulePush],
  );

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

  const subscription: Subscription = useMemo(
    () => tierToSubscription(tier),
    [tier],
  );

  const goalLimit = tierGoalLimit(subscription.tier);
  // Only count fully-formed goals (with a roadmap) toward the tier limit.
  // Orphan goals — created locally but whose roadmap generation failed
  // (e.g. network outage) — should not block the user from trying again.
  const activeGoalCount = goals.filter((g) => g.roadmap !== null).length;
  const canAddMoreGoals = activeGoalCount < goalLimit;

  const createGoal = useCallback(
    async (profile: UserProfile): Promise<Goal> => {
      // Provider-level limit guard (defense-in-depth on top of UI gating).
      // Mirror the orphan-aware count used by canAddMoreGoals.
      const currentGoals = goalsRef.current;
      const currentLimit = tierGoalLimit(tierToSubscription(tier).tier);
      const completedCount = currentGoals.filter(
        (g) => g.roadmap !== null,
      ).length;
      if (completedCount >= currentLimit) {
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
      persistGoals(next);
      persistActive(goal.id);
      return goal;
    },
    [persistGoals, persistActive, tier],
  );

  const removeGoal = useCallback(
    async (goalId: string) => {
      const next = goalsRef.current.filter((g) => g.id !== goalId);
      persistGoals(next);
      if (activeIdRef.current === goalId) {
        persistActive(next[0]?.id ?? null);
      }
    },
    [persistGoals, persistActive],
  );

  const setActiveGoal = useCallback(
    async (goalId: string) => {
      if (!goalsRef.current.find((g) => g.id === goalId)) return;
      persistActive(goalId);
    },
    [persistActive],
  );

  const updateGoal = useCallback(
    async (goalId: string, updater: GoalUpdater) => {
      const next = goalsRef.current.map((g) => (g.id === goalId ? updater(g) : g));
      persistGoals(next);
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

  const setPendingDraft = useCallback(
    async (draft: IntakeDraft | null) => {
      pendingDraftRef.current = draft;
      setPendingDraftState(draft);
      schedulePush();
    },
    [schedulePush],
  );

  const updatePendingAnswers = useCallback(
    async (answers: IntakeAnswer[]) => {
      const prev = pendingDraftRef.current;
      if (!prev) return;
      const next = { ...prev, answers };
      pendingDraftRef.current = next;
      setPendingDraftState(next);
      schedulePush();
    },
    [schedulePush],
  );

  const attachPendingQuestions = useCallback(
    async (questions: IntakeQuestion[], introMessage: string) => {
      const prev = pendingDraftRef.current;
      if (!prev) return;
      const next: IntakeDraft = {
        ...prev,
        questions,
        introMessage,
        stage: "answering",
      };
      pendingDraftRef.current = next;
      setPendingDraftState(next);
      schedulePush();
    },
    [schedulePush],
  );

  const attachPendingProfile = useCallback(
    async (profile: UserProfile, followUp?: string) => {
      const prev = pendingDraftRef.current;
      if (!prev) return;
      const next: IntakeDraft = {
        ...prev,
        synthesizedProfile: profile,
        followUp,
        stage: "ready_to_generate",
      };
      pendingDraftRef.current = next;
      setPendingDraftState(next);
      schedulePush();
    },
    [schedulePush],
  );

  // Tier is now controlled by the server; local "upgrade" is a no-op so any
  // legacy callers don't crash. Surface a dev-only warning once.
  const updateSubscription = useCallback(async (_tier: SubscriptionTier) => {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.warn(
        "[atlas] updateSubscription is a no-op — tier is server-controlled.",
      );
    }
  }, []);

  const updateAccount = useCallback(
    async (prefs: Partial<AccountPrefs>) => {
      const next = { ...accountRef.current, ...prefs };
      accountRef.current = next;
      setAccount(next);
      schedulePush();
    },
    [schedulePush],
  );

  const resetAll = useCallback(async () => {
    // Clear locally first so the UI updates instantly, then push the empty
    // state up to the server so other devices see the reset.
    goalsRef.current = [];
    activeIdRef.current = null;
    accountRef.current = DEFAULT_ACCOUNT;
    pendingDraftRef.current = null;
    setGoals([]);
    setActiveGoalId(null);
    setAccount(DEFAULT_ACCOUNT);
    setPendingDraftState(null);
    schedulePush();
  }, [schedulePush]);

  const signOut = useCallback(async () => {
    const owner = ownerRef.current;
    // Stop anything queued before we lose the auth token.
    suppressPushRef.current = true;
    pushDirtyRef.current = false;
    if (owner) {
      await clearUserCache(owner);
    }
    try {
      await clerkSignOut();
    } catch (err) {
      // eslint-disable-next-line no-console
      if (__DEV__) console.warn("[atlas] signOut failed", err);
    }
  }, [clerkSignOut]);

  const dismissSyncMessage = useCallback(() => {
    setSyncMessage(null);
    if (syncStatus === "conflict" || syncStatus === "error") {
      setSyncStatus("idle");
    }
  }, [syncStatus]);

  const value: AtlasContextValue = {
    loaded,
    goals,
    activeGoalId,
    subscription,
    account,
    pendingDraft,
    tier,
    syncStatus,
    syncMessage,
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
    signOut,
    dismissSyncMessage,
  };

  return <AtlasContext.Provider value={value}>{children}</AtlasContext.Provider>;
}

export function useAtlas() {
  const ctx = useContext(AtlasContext);
  if (!ctx) throw new Error("useAtlas must be used within AtlasProvider");
  return ctx;
}

// `clearAllAtlas` is still re-exported for any caller that wants a hard
// device-wide wipe (used by the secondary "danger zone" reset path).
export { clearAllAtlas };
