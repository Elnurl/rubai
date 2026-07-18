import { useAuth } from "@/providers/AuthProvider";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppState, type AppStateStatus, Platform } from "react-native";
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
import {
  ApiError,
  atlasRegisterPushToken,
  customFetch,
  getBaseUrl,
  getGetMeStateQueryKey,
  getMeState,
  putMeState,
  setAuthTokenGetter,
  useLegalMyAcceptances,
} from "@workspace/api-client-react";

function formatSyncFailure(err: unknown, offlineFallback: string): string {
  if (err instanceof ApiError) {
    if (err.status === 401 || err.status === 403) {
      return "Session rejected by the server. Sign out and sign in again.";
    }
    if (err.status >= 500) {
      return `Cloud server error (${err.status}). Try again shortly.`;
    }
    return `Couldn't sync (HTTP ${err.status}).`;
  }
  const base = getBaseUrl();
  if (base) {
    return `${offlineFallback} (${base.replace(/^https?:\/\//, "")})`;
  }
  return offlineFallback;
}
import { registerForPushAsync } from "@/lib/push";
import { getNotifications } from "@/lib/notifications";
import { supportsRemotePush } from "@/lib/expoGo";
import {
  clearCachedSessionToken,
  clearLastActiveUserId,
  registerPeriodicTierSyncTask,
  registerTierSyncNotificationTask,
  setLastActiveUserId,
  unregisterTierSyncTasks,
} from "@/lib/backgroundTierSync";
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
  type ChatSession,
  type EarnedAward,
  type Goal,
  type IntakeDraft,
  type RoadmapEvolutionEntry,
  type StoredDailyPlan,
  type Subscription,
  type SubscriptionTier,
  tierGoalLimit,
} from "@/types/atlas";
import { evaluateNewAwards } from "@/lib/awards";
import { AwardToast } from "@/components/AwardToast";
import { TierChangeToast } from "@/components/TierChangeToast";
import { AtlasThemeContext } from "@/providers/AtlasContext";

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
  activeEarnedAwards: EarnedAward[];
  pendingAwardToast: EarnedAward | null;
  dismissAwardToast: () => void;
  pendingTierChangeToast: TierChangeToastPayload | null;
  dismissTierChangeToast: () => void;
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
  /**
   * Add focused-work minutes to the active goal's history entry for the
   * given task on the given date. Creates a stub history entry (completed
   * = false) when none exists yet so the focus session is preserved even if
   * the user stops the timer before checking the task off.
   */
  appendActiveFocusMinutes: (
    taskId: string,
    taskTitle: string,
    date: string,
    minutes: number,
  ) => Promise<void>;
  applyRoadmapEvolution: (
    goalId: string,
    evolvedRoadmap: Roadmap,
    entry: RoadmapEvolutionEntry,
  ) => Promise<void>;
  setActiveCoachHistory: (history: ChatMessage[]) => Promise<void>;
  appendActiveCoachMessage: (msg: ChatMessage) => Promise<void>;
  /** Multi-chat (per-goal sessions). */
  activeCoachSessions: ChatSession[];
  activeCoachSessionId: string | null;
  createCoachSession: () => Promise<string | null>;
  switchCoachSession: (sessionId: string) => Promise<void>;
  deleteCoachSession: (sessionId: string) => Promise<void>;
  /**
   * CAS rename — only updates the title if the session still exists AND its
   * current title is the "New chat" placeholder (or empty). Prevents a
   * late-returning auto-title from overwriting a user-renamed session.
   */
  renameCoachSession: (
    sessionId: string,
    title: string,
    opts?: { goalId?: string; onlyIfPlaceholder?: boolean },
  ) => Promise<void>;
  /**
   * Session-pinned commit — writes to the (goalId, sessionId) pair captured
   * at send-time so a late stream completion can't land in whichever session
   * happens to be active by the time the network call returns. No-ops if the
   * pinned session has been deleted in the meantime.
   */
  appendCoachMessageToSession: (
    goalId: string,
    sessionId: string,
    msg: ChatMessage,
  ) => Promise<void>;
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

export type TierChangeToastPayload = { fromTier: string; toTier: string };

type ToastQueueEntry =
  | { kind: "tier-change"; payload: TierChangeToastPayload }
  | { kind: "award"; payload: EarnedAward };

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
  const base: Goal = {
    ...goal,
    reflections: goal.reflections ?? [],
    behavioralProfile: goal.behavioralProfile ?? null,
    roadmapEvolutions: goal.roadmapEvolutions ?? [],
    lastEvolvedAt: goal.lastEvolvedAt ?? null,
    coachMemory: goal.coachMemory ?? null,
    earnedAwards: goal.earnedAwards ?? [],
    coachHistory: goal.coachHistory ?? [],
    coachSessions: goal.coachSessions ?? [],
    activeSessionId: goal.activeSessionId ?? null,
  };

  // One-time migration: if the user has a legacy single coachHistory but no
  // sessions yet, lift it into one default session so the multi-chat UI has
  // something to show. We don't clear the legacy field — older clients on
  // other devices may still read it.
  if (base.coachSessions.length === 0) {
    if (base.coachHistory.length > 0) {
      const now = new Date().toISOString();
      const seeded: ChatSession = {
        id: makeId("session"),
        title: "Earlier conversation",
        createdAt: base.createdAt ?? now,
        lastMessageAt: now,
        messages: base.coachHistory,
      };
      base.coachSessions = [seeded];
      base.activeSessionId = seeded.id;
    }
  } else if (
    base.activeSessionId === null ||
    !base.coachSessions.find((s) => s.id === base.activeSessionId)
  ) {
    // Active id missing or stale — point at the most recently touched.
    const sorted = [...base.coachSessions].sort((a, b) =>
      (b.lastMessageAt ?? "").localeCompare(a.lastMessageAt ?? ""),
    );
    base.activeSessionId = sorted[0]?.id ?? null;
  }

  return base;
}

function getActiveSession(goal: Goal | null): ChatSession | null {
  if (!goal || !goal.activeSessionId) return null;
  return goal.coachSessions.find((s) => s.id === goal.activeSessionId) ?? null;
}

function makeNewSession(): ChatSession {
  const now = new Date().toISOString();
  return {
    id: makeId("session"),
    title: "New chat",
    createdAt: now,
    lastMessageAt: now,
    messages: [],
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
    themeOverride:
      b.themeOverride === "light" ||
      b.themeOverride === "dark" ||
      b.themeOverride === "system"
        ? b.themeOverride
        : DEFAULT_ACCOUNT.themeOverride,
    realtimeSync:
      typeof b.realtimeSync === "boolean"
        ? b.realtimeSync
        : DEFAULT_ACCOUNT.realtimeSync,
    privacyShield:
      typeof b.privacyShield === "boolean"
        ? b.privacyShield
        : DEFAULT_ACCOUNT.privacyShield,
    coachPersona:
      typeof b.coachPersona === "string" && b.coachPersona.length > 0
        ? b.coachPersona
        : DEFAULT_ACCOUNT.coachPersona,
    preferredLanguage:
      typeof b.preferredLanguage === "string" && b.preferredLanguage.length > 0
        ? b.preferredLanguage
        : DEFAULT_ACCOUNT.preferredLanguage,
    calendarSync: pickCalendarSync(b.calendarSync),
  };
}

function pickCalendarSync(blob: unknown): AccountPrefs["calendarSync"] {
  const def = DEFAULT_ACCOUNT.calendarSync;
  if (!blob || typeof blob !== "object") return def;
  const b = blob as Partial<AccountPrefs["calendarSync"]>;
  return {
    enabled: typeof b.enabled === "boolean" ? b.enabled : def.enabled,
    provider: b.provider === "google" ? "google" : "native",
    calendarId:
      typeof b.calendarId === "string" ? b.calendarId : def.calendarId,
    calendarTitle:
      typeof b.calendarTitle === "string" ? b.calendarTitle : def.calendarTitle,
    contextRead:
      typeof b.contextRead === "boolean" ? b.contextRead : def.contextRead,
    autoWrite: typeof b.autoWrite === "boolean" ? b.autoWrite : def.autoWrite,
  };
}

export function AtlasProvider({ children }: { children: React.ReactNode }) {
  const {
    isLoaded: authLoaded,
    isSignedIn,
    userId,
    signOut: authSignOut,
    getToken,
  } = useAuth();

  // Attach bearer token BEFORE any /me/state calls. AuthGate also sets this,
  // but it mounts as a child — parent effects would otherwise race ahead.
  useEffect(() => {
    setAuthTokenGetter(async () => {
      const token = await getToken();
      if (token) {
        void cacheSessionToken(token);
      }
      return token;
    });
    return () => {
      setAuthTokenGetter(null);
    };
  }, [getToken]);

  const [loaded, setLoaded] = useState(false);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [activeGoalId, setActiveGoalId] = useState<string | null>(null);
  // --- Unified toast queue ---------------------------------------------------
  // A single queue ensures AwardToast and TierChangeToast never overlap.
  // Tier-change entries are inserted before any pending award entries (higher
  // priority); award entries always append to the back.
  const [activeToast, setActiveToast] = useState<ToastQueueEntry | null>(null);
  const activeToastRef = useRef<ToastQueueEntry | null>(null);
  const toastQueueRef = useRef<ToastQueueEntry[]>([]);

  const advanceToastQueue = useCallback(() => {
    const next = toastQueueRef.current.shift() ?? null;
    activeToastRef.current = next;
    setActiveToast(next);
  }, []);

  const enqueueToast = useCallback(
    (entry: ToastQueueEntry) => {
      if (!activeToastRef.current) {
        activeToastRef.current = entry;
        setActiveToast(entry);
        return;
      }
      if (entry.kind === "tier-change") {
        // Insert ahead of any already-queued award entries so plan changes
        // are always shown before award toasts.
        const firstAwardIdx = toastQueueRef.current.findIndex(
          (e) => e.kind === "award",
        );
        if (firstAwardIdx === -1) {
          toastQueueRef.current.push(entry);
        } else {
          toastQueueRef.current.splice(firstAwardIdx, 0, entry);
        }
      } else {
        toastQueueRef.current.push(entry);
      }
    },
    [],
  );

  const dismissAwardToast = useCallback(() => {
    advanceToastQueue();
  }, [advanceToastQueue]);

  const dismissTierChangeToast = useCallback(() => {
    advanceToastQueue();
  }, [advanceToastQueue]);

  // Derived values — at most one of these is non-null at any given moment,
  // which guarantees the two toast components never render simultaneously.
  const pendingAwardToast =
    activeToast?.kind === "award" ? activeToast.payload : null;
  const pendingTierChangeToast =
    activeToast?.kind === "tier-change" ? activeToast.payload : null;

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

  // The server's authoritative tier, separate from the displayed tier. This
  // is what gets persisted to cache and rehydrated on next boot. We keep it
  // distinct from `tier` so that the local "Plans" preview (see
  // updateSubscription / localTierOverrideRef below) can flip the displayed
  // tier WITHOUT poisoning the cached snapshot or surviving a reload.
  const serverTierRef = useRef<string>(DEFAULT_SUBSCRIPTION.tier);

  // When non-null, the user has explicitly picked a plan from the in-app
  // Plans screen. This is a UI-only preview — no billing, no server sync.
  // While it's set, server-driven setTier paths are skipped so a background
  // sync response can't clobber the user's pick. It is intentionally NOT
  // persisted, so reloading the app falls back to the server tier.
  const localTierOverrideRef = useRef<SubscriptionTier | null>(null);

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
      serverTierRef.current = state.tier;

      setGoals(nextGoals);
      setActiveGoalId(state.activeGoalId);
      setAccount(accountRef.current);
      setPendingDraftState(pendingDraftRef.current);
      // If the user has a local plan preview active, keep showing it; the
      // server's tier is still recorded above and will be the source of truth
      // on next boot.
      if (localTierOverrideRef.current === null) {
        setTier(state.tier);
      }
    },
    [],
  );

  const writeCacheSnapshot = useCallback(async (authUserId: string) => {
    await saveUserCache(authUserId, {
      goals: goalsRef.current,
      activeGoalId: activeIdRef.current,
      accountPrefs: accountRef.current,
      pendingDraft: pendingDraftRef.current,
      version: versionRef.current,
      // Persist the server's authoritative tier, never the local UI override.
      tier: serverTierRef.current,
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
      serverTierRef.current = res.tier;
      // Background sync: don't clobber an active local Plans preview.
      if (localTierOverrideRef.current === null) {
        setTier(res.tier);
      }
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
      setSyncMessage(
        formatSyncFailure(
          err,
          "Couldn't reach the cloud. Changes will sync when you're back online.",
        ),
      );
      // eslint-disable-next-line no-console
      console.warn("[atlas] push failed", err);
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
    if (!authLoaded) return;

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
      serverTierRef.current = DEFAULT_SUBSCRIPTION.tier;
      localTierOverrideRef.current = null;
      setGoals([]);
      setActiveGoalId(null);
      setAccount(DEFAULT_ACCOUNT);
      setPendingDraftState(null);
      setTier(DEFAULT_SUBSCRIPTION.tier);
      setSyncStatus("idle");
      setSyncMessage(null);
      setLoaded(true);
      // Clear background-task state so tasks don't run for a signed-out user.
      void clearLastActiveUserId();
      void clearCachedSessionToken();
      void unregisterTierSyncTasks();
      return;
    }

    // Signed-in. If the owner already matches we're already booted; nothing
    // to do (this guards against effect re-runs from Clerk re-emitting the
    // same identity).
    if (ownerRef.current === userId) return;

    // Persist the user ID for background-task cache access (no React context
    // available in background execution).
    void setLastActiveUserId(userId);

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
        serverTierRef.current = cached.tier;
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
          setSyncMessage(
            `Couldn't reach the cloud. Showing your last sync.${
              getBaseUrl()
                ? ` (${getBaseUrl()!.replace(/^https?:\/\//, "")})`
                : ""
            }`,
          );
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
            serverTierRef.current = server.tier;
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
              serverTierRef.current = uploaded.tier;
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
        setSyncMessage(
          formatSyncFailure(
            err,
            "Couldn't reach the cloud. Showing your last sync.",
          ),
        );
        setLoaded(true);
        // eslint-disable-next-line no-console
        console.warn("[atlas] hydrate failed", err);
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
  }, [authLoaded, isSignedIn, userId, adoptServerState, writeCacheSnapshot]);

  // Register the device's Expo push token once per signed-in session.
  // Bootstrapped after Clerk is ready so requireAuth sees the token. Web
  // and simulators short-circuit inside registerForPushAsync.
  const pushBootstrappedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!authLoaded || !isSignedIn || !userId) {
      pushBootstrappedFor.current = null;
      return;
    }
    if (pushBootstrappedFor.current === userId) return;
    pushBootstrappedFor.current = userId;
    let cancelled = false;
    (async () => {
      try {
        const reg = await registerForPushAsync();
        if (cancelled || !reg) return;
        await atlasRegisterPushToken({
          token: reg.token,
          tzOffsetMinutes: reg.tzOffsetMinutes,
        });
        if (__DEV__) console.log("[atlas] push token registered");
      } catch (err) {
        if (__DEV__) console.warn("[atlas] push registration failed", err);
        // Allow a retry next sign-in cycle.
        if (pushBootstrappedFor.current === userId) {
          pushBootstrappedFor.current = null;
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authLoaded, isSignedIn, userId]);

  // ----- Background tier sync: task registration -----------------------
  // Register the two background tasks (notification-triggered + periodic)
  // once per signed-in session.  Both helpers are idempotent and fall back
  // gracefully when background execution is unavailable (simulator, Android
  // battery saver, iOS restrictions).
  useEffect(() => {
    if (!isSignedIn || !userId) return;
    void registerTierSyncNotificationTask();
    void registerPeriodicTierSyncTask();
  }, [isSignedIn, userId]);

  // ----- Tier sync: foreground resume ----------------------------------
  // When the app returns to the foreground (e.g. user switches back after
  // completing a purchase flow in another app, or receives a CANCELLATION
  // that arrived while backgrounded), silently re-read the DB-authoritative
  // tier via GET /api/me.
  //
  // We intentionally use GET /me (DB read) and NOT POST /me/sync-tier
  // (RevenueCat API re-query) here. The webhook has already written the
  // correct tier to the DB, so a direct DB read is both faster and
  // authoritative. Using sync-tier would re-query RevenueCat, which may
  // still report an active entitlement for a CANCELLATION (until period
  // end), silently overwriting the correct webhook-written downgrade.
  useEffect(() => {
    if (!isSignedIn || !userId) return;

    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState !== "active") return;
      // Only sync when the session is fully booted and not in a local preview.
      if (!ownerRef.current || suppressPushRef.current) return;
      if (localTierOverrideRef.current !== null) return;

      const owner = ownerRef.current;
      void customFetch<{ tier: string; authUserId: string; email: string }>(
        "/api/me",
      )
        .then((res) => {
          if (ownerRef.current !== owner) return;
          if (localTierOverrideRef.current !== null) return;
          if (res.tier === serverTierRef.current) return;
          const prevTier = tierRef.current;
          serverTierRef.current = res.tier;
          setTier(res.tier);
          void writeCacheSnapshot(owner);
          if (prevTier !== res.tier) {
            enqueueToast({ kind: "tier-change", payload: { fromTier: prevTier, toTier: res.tier } });
          }
          if (__DEV__) console.log("[atlas] tier updated on foreground:", res.tier);
        })
        .catch(() => {
          // Non-fatal — we'll retry next time the app comes to the foreground.
        });
    };

    const sub = AppState.addEventListener("change", handleAppStateChange);
    return () => sub.remove();
  }, [isSignedIn, userId, writeCacheSnapshot]);

  // ----- Tier sync: push notification ----------------------------------
  // When the server fires a tier_changed push (after a RevenueCat webhook),
  // immediately re-read the DB-authoritative tier via GET /api/me so the
  // UI reflects the webhook-written tier without an app restart.
  //
  // Same reasoning as the foreground sync above: we read from the DB (GET
  // /me), not from RevenueCat (/me/sync-tier), so a webhook-written
  // CANCELLATION downgrade is never overwritten by a stale RC entitlement.
  useEffect(() => {
    if (!isSignedIn || !userId) return;
    if (!supportsRemotePush()) return;
    const Notifications = getNotifications();
    if (!Notifications) return;

    const sub = Notifications.addNotificationReceivedListener((notification) => {
      const data = notification.request.content.data as
        | Record<string, unknown>
        | null
        | undefined;
      if (data?.type !== "tier_changed") return;
      if (!ownerRef.current || suppressPushRef.current) return;
      if (localTierOverrideRef.current !== null) return;

      const owner = ownerRef.current;
      void customFetch<{ tier: string; authUserId: string; email: string }>(
        "/api/me",
      )
        .then((res) => {
          if (ownerRef.current !== owner) return;
          if (localTierOverrideRef.current !== null) return;
          if (res.tier === serverTierRef.current) return;
          const prevTier = tierRef.current;
          serverTierRef.current = res.tier;
          setTier(res.tier);
          void writeCacheSnapshot(owner);
          if (prevTier !== res.tier) {
            enqueueToast({ kind: "tier-change", payload: { fromTier: prevTier, toTier: res.tier } });
          }
          if (__DEV__) console.log("[atlas] tier updated via push:", res.tier);
        })
        .catch(() => {
          // Non-fatal — the AppState foreground sync will cover it on next resume.
        });
    });

    return () => sub.remove();
  }, [isSignedIn, userId, writeCacheSnapshot]);

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
      const seedSession = makeNewSession();
      const goal: Goal = {
        id: makeId("goal"),
        createdAt: new Date().toISOString(),
        startDate: todayISO(),
        profile,
        roadmap: null,
        dailyPlan: null,
        coachHistory: [],
        coachSessions: [seedSession],
        activeSessionId: seedSession.id,
        taskHistory: [],
        reflections: [],
        behavioralProfile: null,
        roadmapEvolutions: [],
        lastEvolvedAt: null,
        coachMemory: null,
        earnedAwards: [],
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
      let toQueue: EarnedAward[] = [];
      await updateActiveGoal((g) => {
        // Carry forward fields the toggle path doesn't know about (focus
        // minutes, reflection note/tag) so completing/uncompleting a task
        // never silently wipes accumulated focus sessions or reflections.
        const existing = g.taskHistory.find(
          (e) => e.taskId === entry.taskId && e.date === entry.date,
        );
        const merged: TaskHistoryEntry = existing
          ? {
              ...existing,
              ...entry,
              focusMinutes: entry.focusMinutes ?? existing.focusMinutes,
              reasonTag: entry.reasonTag ?? existing.reasonTag,
              note: entry.note ?? existing.note,
              reflectedAt: entry.reflectedAt ?? existing.reflectedAt,
            }
          : entry;
        const filtered = g.taskHistory.filter(
          (e) => !(e.taskId === entry.taskId && e.date === entry.date),
        );
        const next: Goal = {
          ...g,
          taskHistory: [...filtered, merged].slice(-200),
        };
        // Evaluate after the new history is in place so awards reflect this
        // toggle. Cap stored awards at 50 to keep the snapshot bounded.
        const fresh = evaluateNewAwards(next, merged.date);
        if (fresh.length > 0) {
          toQueue = fresh;
          return {
            ...next,
            earnedAwards: [...next.earnedAwards, ...fresh].slice(-50),
          };
        }
        return next;
      });
      if (toQueue.length > 0) {
        // Enqueue each new award through the shared toast queue so they never
        // overlap a tier-change toast (or each other).
        for (const award of toQueue) {
          enqueueToast({ kind: "award", payload: award });
        }
      }
    },
    [updateActiveGoal, enqueueToast],
  );

  const appendActiveFocusMinutes = useCallback(
    async (taskId: string, taskTitle: string, date: string, minutes: number) => {
      if (minutes <= 0) return;
      const rounded = Math.max(0, Math.round(minutes));
      await updateActiveGoal((g) => {
        const existing = g.taskHistory.find(
          (e) => e.taskId === taskId && e.date === date,
        );
        if (existing) {
          const taskHistory = g.taskHistory.map((e) =>
            e.taskId === taskId && e.date === date
              ? { ...e, focusMinutes: (e.focusMinutes ?? 0) + rounded }
              : e,
          );
          return { ...g, taskHistory };
        }
        // No history entry yet — create one as not-completed so the focus
        // session is still preserved if the user closes the timer before
        // checking the task off.
        const stub: TaskHistoryEntry = {
          taskId,
          taskTitle,
          date,
          completed: false,
          focusMinutes: rounded,
        };
        return {
          ...g,
          taskHistory: [...g.taskHistory, stub].slice(-200),
        };
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

  // Internal helper: ensure the active goal has a non-null active session,
  // creating one if needed. Returns the (possibly mutated) goal.
  const withEnsuredActiveSession = useCallback((g: Goal): Goal => {
    if (g.activeSessionId && g.coachSessions.find((s) => s.id === g.activeSessionId)) {
      return g;
    }
    const session = makeNewSession();
    return {
      ...g,
      coachSessions: [session, ...g.coachSessions],
      activeSessionId: session.id,
    };
  }, []);

  const setActiveCoachHistory = useCallback(
    async (history: ChatMessage[]) => {
      const trimmed = history.slice(-30);
      const now = new Date().toISOString();
      await updateActiveGoal((g) => {
        const ensured = withEnsuredActiveSession(g);
        const sessions = ensured.coachSessions.map((s) =>
          s.id === ensured.activeSessionId
            ? { ...s, messages: trimmed, lastMessageAt: now }
            : s,
        );
        // Keep legacy mirror in sync for older clients reading coachHistory.
        return { ...ensured, coachSessions: sessions, coachHistory: trimmed };
      });
    },
    [updateActiveGoal, withEnsuredActiveSession],
  );

  const appendActiveCoachMessage = useCallback(
    async (msg: ChatMessage) => {
      const now = new Date().toISOString();
      await updateActiveGoal((g) => {
        const ensured = withEnsuredActiveSession(g);
        const sessions = ensured.coachSessions.map((s) => {
          if (s.id !== ensured.activeSessionId) return s;
          const messages = [...s.messages, msg].slice(-30);
          return { ...s, messages, lastMessageAt: now };
        });
        const activeMessages =
          sessions.find((s) => s.id === ensured.activeSessionId)?.messages ?? [];
        return {
          ...ensured,
          coachSessions: sessions,
          coachHistory: activeMessages,
        };
      });
    },
    [updateActiveGoal, withEnsuredActiveSession],
  );

  const createCoachSession = useCallback(async (): Promise<string | null> => {
    const id = activeIdRef.current;
    if (!id) return null;
    const session = makeNewSession();
    await updateGoal(id, (g) => {
      // If the current active session is empty, just reuse it instead of
      // creating a second empty session.
      const current = g.coachSessions.find((s) => s.id === g.activeSessionId);
      if (current && current.messages.length === 0) {
        return { ...g, activeSessionId: current.id };
      }
      return {
        ...g,
        coachSessions: [session, ...g.coachSessions],
        activeSessionId: session.id,
        coachHistory: [],
      };
    });
    // Return whichever id is now active so the caller can focus it.
    const nextGoal = goalsRef.current.find((g) => g.id === id) ?? null;
    return nextGoal?.activeSessionId ?? session.id;
  }, [updateGoal]);

  const switchCoachSession = useCallback(
    async (sessionId: string) => {
      await updateActiveGoal((g) => {
        if (!g.coachSessions.find((s) => s.id === sessionId)) return g;
        const target = g.coachSessions.find((s) => s.id === sessionId);
        return {
          ...g,
          activeSessionId: sessionId,
          coachHistory: target?.messages ?? [],
        };
      });
    },
    [updateActiveGoal],
  );

  const deleteCoachSession = useCallback(
    async (sessionId: string) => {
      await updateActiveGoal((g) => {
        const remaining = g.coachSessions.filter((s) => s.id !== sessionId);
        let nextActive = g.activeSessionId;
        let nextHistory = g.coachHistory;
        if (g.activeSessionId === sessionId) {
          // Pick the most recent remaining session, or seed an empty new one
          // so the coach UI never lands on a null session state.
          if (remaining.length > 0) {
            const sorted = [...remaining].sort((a, b) =>
              (b.lastMessageAt ?? "").localeCompare(a.lastMessageAt ?? ""),
            );
            nextActive = sorted[0]!.id;
            nextHistory = sorted[0]!.messages;
          } else {
            const fresh = makeNewSession();
            return {
              ...g,
              coachSessions: [fresh],
              activeSessionId: fresh.id,
              coachHistory: [],
            };
          }
        }
        return {
          ...g,
          coachSessions: remaining,
          activeSessionId: nextActive,
          coachHistory: nextHistory,
        };
      });
    },
    [updateActiveGoal],
  );

  const renameCoachSession = useCallback(
    async (
      sessionId: string,
      title: string,
      opts?: { goalId?: string; onlyIfPlaceholder?: boolean },
    ) => {
      const trimmed = title.trim().slice(0, 60);
      if (trimmed.length === 0) return;
      // Goal-pin so a late auto-title for goal A can't rename a session in
      // whichever goal happens to be active when the response returns.
      const targetGoalId = opts?.goalId ?? activeIdRef.current;
      if (!targetGoalId) return;
      await updateGoal(targetGoalId, (g) => {
        const target = g.coachSessions.find((s) => s.id === sessionId);
        if (!target) return g;
        if (opts?.onlyIfPlaceholder) {
          // CAS guard: only rename when the title is still untouched. Lets
          // the user pick a custom name without it being clobbered by a
          // late-returning generate-title call.
          const cur = (target.title ?? "").trim();
          if (cur.length > 0 && cur !== "New chat") return g;
        }
        return {
          ...g,
          coachSessions: g.coachSessions.map((s) =>
            s.id === sessionId ? { ...s, title: trimmed } : s,
          ),
        };
      });
    },
    [updateGoal],
  );

  const appendCoachMessageToSession = useCallback(
    async (goalId: string, sessionId: string, msg: ChatMessage) => {
      const now = new Date().toISOString();
      await updateGoal(goalId, (g) => {
        const target = g.coachSessions.find((s) => s.id === sessionId);
        if (!target) return g; // Session was deleted while request in flight.
        const sessions = g.coachSessions.map((s) => {
          if (s.id !== sessionId) return s;
          const messages = [...s.messages, msg].slice(-30);
          return { ...s, messages, lastMessageAt: now };
        });
        // Only mirror to legacy coachHistory if we're writing to the goal's
        // currently-active session — otherwise we'd corrupt the visible
        // history with a message from a backgrounded session.
        const mirror =
          g.activeSessionId === sessionId
            ? sessions.find((s) => s.id === sessionId)?.messages ?? g.coachHistory
            : g.coachHistory;
        return { ...g, coachSessions: sessions, coachHistory: mirror };
      });
    },
    [updateGoal],
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

  // Local-only tier preview for the in-app Plans screen. There is no real
  // billing yet — picking a plan flips the *displayed* tier (and goalLimit)
  // for this session via localTierOverrideRef. The server's authoritative
  // tier (serverTierRef) is left untouched, never sent to the server, and
  // never written to cache, so reloading the app drops the preview and
  // shows the real server tier again.
  const updateSubscription = useCallback(async (newTier: SubscriptionTier) => {
    localTierOverrideRef.current = newTier;
    setTier(newTier);
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

  const flushToastQueue = useCallback(() => {
    toastQueueRef.current = [];
    activeToastRef.current = null;
    setActiveToast(null);
  }, []);

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
    flushToastQueue();
    schedulePush();
  }, [flushToastQueue, schedulePush]);

  const signOut = useCallback(async () => {
    const owner = ownerRef.current;
    // Stop anything queued before we lose the auth token.
    suppressPushRef.current = true;
    pushDirtyRef.current = false;
    flushToastQueue();
    if (owner) {
      await clearUserCache(owner);
    }
    try {
      await authSignOut();
    } catch (err) {
      // eslint-disable-next-line no-console
      if (__DEV__) console.warn("[atlas] signOut failed", err);
    }
  }, [authSignOut, flushToastQueue]);

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
    activeCoachHistory:
      getActiveSession(activeGoal)?.messages ?? activeGoal?.coachHistory ?? [],
    activeCoachSessions: activeGoal?.coachSessions ?? [],
    activeCoachSessionId: activeGoal?.activeSessionId ?? null,
    activeTaskHistory: activeGoal?.taskHistory ?? [],
    activeReflections: activeGoal?.reflections ?? [],
    activeBehavioralProfile: activeGoal?.behavioralProfile ?? null,
    activeRoadmapEvolutions: activeGoal?.roadmapEvolutions ?? [],
    activeLastEvolvedAt: activeGoal?.lastEvolvedAt ?? null,
    activeCoachMemory: activeGoal?.coachMemory ?? null,
    activeEarnedAwards: activeGoal?.earnedAwards ?? [],
    pendingAwardToast,
    dismissAwardToast,
    pendingTierChangeToast,
    dismissTierChangeToast,
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
    appendActiveFocusMinutes,
    applyRoadmapEvolution,
    setActiveCoachHistory,
    appendActiveCoachMessage,
    createCoachSession,
    switchCoachSession,
    deleteCoachSession,
    renameCoachSession,
    appendCoachMessageToSession,
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

  return (
    <AtlasThemeContext.Provider
      value={{ account: { themeOverride: account.themeOverride } }}
    >
      <AtlasContext.Provider value={value}>
        {children}
        <AwardToast />
        <TierChangeToast />
      </AtlasContext.Provider>
    </AtlasThemeContext.Provider>
  );
}

export function useAtlas() {
  const ctx = useContext(AtlasContext);
  if (!ctx) throw new Error("useAtlas must be used within AtlasProvider");
  return ctx;
}

// `clearAllAtlas` is still re-exported for any caller that wants a hard
// device-wide wipe (used by the secondary "danger zone" reset path).
export { clearAllAtlas };
