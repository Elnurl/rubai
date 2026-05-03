import AsyncStorage from "@react-native-async-storage/async-storage";

const PREFIX_V1 = "atlas:v1:";
const PREFIX = "atlas:v2:";

export async function loadJson<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(PREFIX + key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function saveJson<T>(key: string, value: T): Promise<void> {
  try {
    await AsyncStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

export async function removeKey(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(PREFIX + key);
  } catch {
    // ignore
  }
}

export async function clearAllAtlas(): Promise<void> {
  try {
    const all = await AsyncStorage.getAllKeys();
    const ours = all.filter((k) => k.startsWith(PREFIX) || k.startsWith(PREFIX_V1));
    if (ours.length > 0) {
      await AsyncStorage.multiRemove(ours);
    }
  } catch {
    // ignore
  }
}

export const STORAGE_KEYS = {
  goals: "goals",
  activeGoalId: "activeGoalId",
  subscription: "subscription",
  account: "account",
  pendingDraft: "pendingDraft",
  migrated: "migrated",
} as const;

// ---------------------------------------------------------------------------
// Cloud-sync helpers (Phase 4)
// ---------------------------------------------------------------------------
//
// `migrated:<clerkUserId>` — once we've uploaded any pre-existing local
// goals on this device for this user, we set the flag so we never re-upload.
// `cache:<clerkUserId>` — fast-paint snapshot of the last server state we
// observed, scoped per user so multiple accounts on the same device don't
// leak data into each other.

const MIGRATED_PREFIX = `${PREFIX}migrated:`;
const USER_CACHE_PREFIX = `${PREFIX}cache:`;

export async function getMigratedFlag(clerkUserId: string): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(MIGRATED_PREFIX + clerkUserId);
    return raw === "1";
  } catch {
    return false;
  }
}

export async function setMigratedFlag(clerkUserId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(MIGRATED_PREFIX + clerkUserId, "1");
  } catch {
    // ignore
  }
}

export type UserCacheSnapshot<G = unknown, AP = unknown, PD = unknown> = {
  goals: G[];
  activeGoalId: string | null;
  accountPrefs: AP;
  pendingDraft: PD | null;
  version: number;
  tier: string;
};

export async function loadUserCache<G = unknown, AP = unknown, PD = unknown>(
  clerkUserId: string,
): Promise<UserCacheSnapshot<G, AP, PD> | null> {
  try {
    const raw = await AsyncStorage.getItem(USER_CACHE_PREFIX + clerkUserId);
    if (!raw) return null;
    return JSON.parse(raw) as UserCacheSnapshot<G, AP, PD>;
  } catch {
    return null;
  }
}

export async function saveUserCache<G = unknown, AP = unknown, PD = unknown>(
  clerkUserId: string,
  snapshot: UserCacheSnapshot<G, AP, PD>,
): Promise<void> {
  try {
    await AsyncStorage.setItem(
      USER_CACHE_PREFIX + clerkUserId,
      JSON.stringify(snapshot),
    );
  } catch {
    // ignore
  }
}

export async function clearUserCache(clerkUserId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(USER_CACHE_PREFIX + clerkUserId);
  } catch {
    // ignore
  }
}

// Read the legacy local-only goals snapshot if one exists on this device.
// Used exactly once, on first sign-in, to seed the cloud copy.
export async function loadLegacyV2Goals<T = unknown>(): Promise<{
  goals: T[];
  activeGoalId: string | null;
} | null> {
  const goals = await loadJson<T[]>(STORAGE_KEYS.goals);
  if (!goals || goals.length === 0) return null;
  const activeGoalId = await loadJson<string>(STORAGE_KEYS.activeGoalId);
  return { goals, activeGoalId: activeGoalId ?? null };
}

// Drop the legacy local snapshot once it has been migrated to the cloud.
export async function clearLegacyV2Snapshot(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([
      PREFIX + STORAGE_KEYS.goals,
      PREFIX + STORAGE_KEYS.activeGoalId,
      PREFIX + STORAGE_KEYS.subscription,
      PREFIX + STORAGE_KEYS.account,
      PREFIX + STORAGE_KEYS.pendingDraft,
    ]);
  } catch {
    // ignore
  }
}

const V1_KEYS = {
  profile: "profile",
  roadmap: "roadmap",
  dailyPlan: "dailyPlan",
  coachHistory: "coachHistory",
  taskHistory: "taskHistory",
  startDate: "startDate",
} as const;

export type TaskHistoryEntry = {
  taskId: string;
  taskTitle: string;
  date: string;
  completed: boolean;
  reasonTag?: string;
  note?: string;
  reflectedAt?: string;
  /**
   * Total focused-work minutes the user accumulated on this task on this
   * date, captured from the in-app focus timer. Optional — older entries and
   * tasks the user never started a focus session on simply omit it.
   */
  focusMinutes?: number;
};

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

async function loadV1<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(PREFIX_V1 + key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export type V1MigrationPayload = {
  // The raw v1 single-goal data, intentionally typed loose so the provider
  // can shape it into a Goal record.
  profile: unknown | null;
  roadmap: unknown | null;
  dailyPlan: unknown | null;
  coachHistory: unknown | null;
  taskHistory: unknown | null;
  startDate: string | null;
};

export async function readV1ForMigration(): Promise<V1MigrationPayload | null> {
  const [profile, roadmap, dailyPlan, coachHistory, taskHistory, startDate] =
    await Promise.all([
      loadV1<unknown>(V1_KEYS.profile),
      loadV1<unknown>(V1_KEYS.roadmap),
      loadV1<unknown>(V1_KEYS.dailyPlan),
      loadV1<unknown>(V1_KEYS.coachHistory),
      loadV1<unknown>(V1_KEYS.taskHistory),
      loadV1<string>(V1_KEYS.startDate),
    ]);
  if (!profile) return null;
  return { profile, roadmap, dailyPlan, coachHistory, taskHistory, startDate };
}

export async function clearV1Storage(): Promise<void> {
  try {
    const all = await AsyncStorage.getAllKeys();
    const v1 = all.filter((k) => k.startsWith(PREFIX_V1));
    if (v1.length > 0) await AsyncStorage.multiRemove(v1);
  } catch {
    // ignore
  }
}

export function makeId(prefix = "id"): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
