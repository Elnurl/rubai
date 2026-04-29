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
