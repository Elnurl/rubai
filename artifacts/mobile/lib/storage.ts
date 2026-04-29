import AsyncStorage from "@react-native-async-storage/async-storage";

const PREFIX = "atlas:v1:";

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
    const ours = all.filter((k) => k.startsWith(PREFIX));
    if (ours.length > 0) {
      await AsyncStorage.multiRemove(ours);
    }
  } catch {
    // ignore
  }
}

export const STORAGE_KEYS = {
  profile: "profile",
  roadmap: "roadmap",
  dailyPlan: "dailyPlan",
  onboardingHistory: "onboardingHistory",
  coachHistory: "coachHistory",
  taskHistory: "taskHistory",
  startDate: "startDate",
  pendingGoalType: "pendingGoalType",
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
