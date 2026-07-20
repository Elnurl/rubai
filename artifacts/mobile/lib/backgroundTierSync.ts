/**
 * Background tier sync — keeps the local cache up-to-date when iOS wakes
 * the app for a content-available push or a periodic background-fetch slot.
 *
 * Two tasks are registered here:
 *
 * 1. TIER_SYNC_TASK — notification-triggered (Notifications.registerTaskAsync)
 *    Runs when the server fires a tier_changed push with content_available:1.
 *    iOS wakes the app briefly; we call GET /api/me with the most-recently
 *    cached Auth session token to get the DB-authoritative tier, then patch
 *    the AsyncStorage snapshot so the next foreground launch paints
 *    immediately with the correct tier.
 *
 * 2. TIER_SYNC_PERIODIC_TASK — periodic (BackgroundFetch.registerTaskAsync)
 *    Belt-and-suspenders catch for missed pushes or delayed delivery.
 *    Runs at most every 15 minutes (iOS decides the actual cadence).
 *
 * Both tasks fall back gracefully when unavailable (Android battery saver,
 * iOS restrictions, or simulators).
 *
 * ## Auth in background context
 *
 * Auth's useAuth / getToken hooks are only available inside a mounted React
 * tree.  When the app is fully terminated and iOS wakes it for background
 * work, the React tree is never mounted.  We work around this by caching the
 * most-recent Auth JWT in SecureStore every time the foreground getter is
 * called (see cacheSessionToken / wrapAuthGetterWithCache exported below).
 * The background task reads that cached token.  Auth JWTs are short-lived
 * (60 s), but getToken() refreshes them automatically in the foreground — the
 * cache therefore contains a recently-minted token that should still be valid
 * for the first seconds after the app is woken.  If the token is expired the
 * API call returns 401 and we skip the cache update; the existing AppState
 * "active" foreground sync corrects the tier the next time the user opens
 * the app.
 *
 * IMPORTANT: TaskManager.defineTask() calls at module level are intentional.
 * expo-task-manager requires tasks to be defined before registerTaskAsync is
 * called AND before the module is evaluated in background-launch contexts
 * where the React tree is never mounted.  Importing this file from _layout.tsx
 * guarantees both conditions are satisfied.
 */

import * as TaskManager from "expo-task-manager";
import * as BackgroundFetch from "expo-background-fetch";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { preferPublicApiBase } from "./apiBaseUrl";
import { loadUserCache, saveUserCache } from "./storage";
import { getNotifications } from "./notifications";
import { supportsRemotePush } from "./expoGo";

// ─── Constants ────────────────────────────────────────────────────────────────

export const TIER_SYNC_TASK = "rubai-tier-sync";
export const TIER_SYNC_PERIODIC_TASK = "rubai-tier-sync-periodic";

/** SecureStore key for the most-recently-seen Auth JWT. */
const SESSION_TOKEN_KEY = "atlas:bg:session_token";
/** AsyncStorage key for the last signed-in Auth user ID. */
const LAST_USER_KEY = "atlas:v2:lastActiveUserId";
/** AsyncStorage key for the API base URL (baked from env at foreground boot). */
const API_BASE_URL_KEY = "atlas:bg:apiBaseUrl";

// ─── Foreground helpers — call these from _layout.tsx and AtlasProvider ──────

/**
 * Cache the most-recently-obtained Auth session token so the background
 * task can attach it as an Authorization header without the React tree.
 * Call this every time the auth token getter is invoked (see _layout.tsx).
 */
export async function cacheSessionToken(token: string): Promise<void> {
  // Never persist corrupt/oversized tokens (seen ~480KB blobs from bad auth storage).
  if (!token || token.length > 8_000 || token.split(".").length !== 3) {
    return;
  }
  try {
    await SecureStore.setItemAsync(SESSION_TOKEN_KEY, token);
  } catch {
    // SecureStore errors are non-fatal; background auth will simply fall back.
  }
}

/**
 * Remove the cached token on sign-out so the background task cannot make
 * API calls on behalf of the signed-out user.
 */
export async function clearCachedSessionToken(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(SESSION_TOKEN_KEY);
  } catch {
    // ignore
  }
}

/**
 * Cache the API base URL so the background task can build absolute URLs
 * even if module-level env-var resolution hasn't run in this JS context.
 */
export async function cacheApiBaseUrl(url: string): Promise<void> {
  try {
    await AsyncStorage.setItem(API_BASE_URL_KEY, url);
  } catch {
    // ignore
  }
}

/**
 * Persist the signed-in user ID so the background task can locate the
 * correct AsyncStorage cache entry without React or Auth hooks.
 */
export async function setLastActiveUserId(userId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(LAST_USER_KEY, userId);
  } catch {
    // ignore
  }
}

/**
 * Clear the stored user ID on sign-out.
 */
export async function clearLastActiveUserId(): Promise<void> {
  try {
    await AsyncStorage.removeItem(LAST_USER_KEY);
  } catch {
    // ignore
  }
}

// ─── Core background sync logic ───────────────────────────────────────────────

/**
 * Attempt to call GET /api/me with the cached Auth JWT and update the
 * local AsyncStorage cache with the DB-authoritative tier.
 *
 * Uses the same endpoint as the existing foreground push-handler and AppState
 * sync (see AtlasProvider.tsx) so cancellation/downgrade webhooks are
 * reflected correctly — the DB has the correct tier regardless of what
 * RevenueCat's local cache reports.
 *
 * Returns true when the cache was successfully written.
 */
async function runTierSync(): Promise<boolean> {
  try {
    const userId = await AsyncStorage.getItem(LAST_USER_KEY);
    if (!userId) {
      if (__DEV__) console.log("[tier-sync-bg] no stored userId, skipping");
      return false;
    }

    // Read the cached Auth JWT from SecureStore.
    const token = await SecureStore.getItemAsync(SESSION_TOKEN_KEY);
    if (!token) {
      if (__DEV__)
        console.log("[tier-sync-bg] no cached session token, skipping");
      return false;
    }

    // Prefer the HTTPS URL baked into the bundle over a stale LAN cache
    // from an older Metro/dev install (same Android package name).
    const storedBase = await AsyncStorage.getItem(API_BASE_URL_KEY);
    const envBase =
      process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "") ??
      (process.env.EXPO_PUBLIC_DOMAIN
        ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
        : null);
    const baseUrl = preferPublicApiBase(envBase, storedBase);

    if (baseUrl && baseUrl !== storedBase) {
      await AsyncStorage.setItem(API_BASE_URL_KEY, baseUrl);
    }

    if (!baseUrl) {
      if (__DEV__)
        console.log("[tier-sync-bg] no API base URL available, skipping");
      return false;
    }

    // Call GET /api/me — DB-authoritative tier, mirrors the foreground sync
    // in AtlasProvider.tsx (intentionally NOT /me/sync-tier which re-queries
    // RevenueCat and can return stale "active" data for cancelled subs).
    const response = await fetch(`${baseUrl}/api/me`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });

    if (response.status === 401 || response.status === 403) {
      // Token expired or invalid.  The AppState "active" foreground sync will
      // correct the tier the next time the user opens the app.
      if (__DEV__)
        console.log(
          "[tier-sync-bg] auth expired (status",
          response.status,
          "), skipping cache update",
        );
      return false;
    }

    if (!response.ok) {
      if (__DEV__)
        console.log("[tier-sync-bg] /api/me returned", response.status);
      return false;
    }

    const data = (await response.json()) as {
      tier?: string;
      AuthUserId?: string;
    };
    const newTier = data.tier;
    if (!newTier) {
      if (__DEV__)
        console.log("[tier-sync-bg] /api/me response missing tier field");
      return false;
    }

    // Patch the AsyncStorage user-cache snapshot in place.
    const cache = await loadUserCache(userId);
    if (!cache) {
      if (__DEV__) console.log("[tier-sync-bg] no cache snapshot found");
      return false;
    }

    if (cache.tier !== newTier) {
      await saveUserCache(userId, { ...cache, tier: newTier });
      if (__DEV__)
        console.log("[tier-sync-bg] cache updated:", cache.tier, "→", newTier);
    } else {
      if (__DEV__) console.log("[tier-sync-bg] tier unchanged:", newTier);
    }

    return true;
  } catch (err) {
    if (__DEV__) console.warn("[tier-sync-bg] sync error:", err);
    return false;
  }
}

// ─── Task definitions (module-level — required by expo-task-manager) ──────────

if (Platform.OS !== "web") {
  // Notification-triggered task: fires when a content-available push arrives.
  TaskManager.defineTask(
    TIER_SYNC_TASK,
    async ({
      data,
      error,
    }: TaskManager.TaskManagerTaskBody<{
      notification?: {
        request?: { content?: { data?: Record<string, unknown> } };
      };
    }>) => {
      if (error) {
        if (__DEV__) console.warn("[tier-sync-bg] task error:", error);
        return;
      }

      // Filter to tier_changed pushes only — this task is registered for ALL
      // background notifications, so we must bail out for other types.
      const notifData = data?.notification?.request?.content
        ?.data as Record<string, unknown> | null | undefined;
      if (notifData !== undefined && notifData?.type !== "tier_changed") {
        return;
      }

      await runTierSync();
    },
  );

  // Periodic task: belt-and-suspenders catch for missed or delayed pushes.
  TaskManager.defineTask(
    TIER_SYNC_PERIODIC_TASK,
    async ({ error }: TaskManager.TaskManagerTaskBody<void>) => {
      if (error) {
        if (__DEV__)
          console.warn("[tier-sync-bg] periodic task error:", error);
        return BackgroundFetch.BackgroundFetchResult.Failed;
      }

      const success = await runTierSync();
      return success
        ? BackgroundFetch.BackgroundFetchResult.NewData
        : BackgroundFetch.BackgroundFetchResult.NoData;
    },
  );
}

// ─── Registration helpers (called from React components after sign-in) ────────

/**
 * Register the notification-triggered background task.
 * Safe to call multiple times; no-ops if already registered.
 */
export async function registerTierSyncNotificationTask(): Promise<void> {
  if (Platform.OS === "web") return;
  if (!supportsRemotePush()) return;
  const Notifications = getNotifications();
  if (!Notifications) return;
  try {
    const already = await TaskManager.isTaskRegisteredAsync(TIER_SYNC_TASK);
    if (!already) {
      await Notifications.registerTaskAsync(TIER_SYNC_TASK);
      if (__DEV__) console.log("[tier-sync-bg] notification task registered");
    }
  } catch (err) {
    // Non-fatal — background notification handling is optional.
    if (__DEV__)
      console.warn("[tier-sync-bg] could not register notification task:", err);
  }
}

/**
 * Register the periodic background-fetch task.
 * Skips gracefully when the system has restricted background fetch
 * (iOS low-power mode, Android battery saver, simulator, etc.).
 */
export async function registerPeriodicTierSyncTask(): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    const status = await BackgroundFetch.getStatusAsync();
    if (
      status === BackgroundFetch.BackgroundFetchStatus.Restricted ||
      status === BackgroundFetch.BackgroundFetchStatus.Denied
    ) {
      if (__DEV__)
        console.log(
          "[tier-sync-bg] background fetch unavailable, status:",
          status,
        );
      return;
    }

    const already = await TaskManager.isTaskRegisteredAsync(
      TIER_SYNC_PERIODIC_TASK,
    );
    if (!already) {
      await BackgroundFetch.registerTaskAsync(TIER_SYNC_PERIODIC_TASK, {
        minimumInterval: 15 * 60,
        stopOnTerminate: false,
        startOnBoot: true,
      });
      if (__DEV__) console.log("[tier-sync-bg] periodic task registered");
    }
  } catch (err) {
    if (__DEV__)
      console.warn("[tier-sync-bg] could not register periodic task:", err);
  }
}

/**
 * Unregister both background tasks.  Call on sign-out so tasks don't run
 * for a signed-out user.
 */
export async function unregisterTierSyncTasks(): Promise<void> {
  if (Platform.OS === "web") return;
  const Notifications = getNotifications();
  try {
    if (Notifications && (await TaskManager.isTaskRegisteredAsync(TIER_SYNC_TASK))) {
      await Notifications.unregisterTaskAsync(TIER_SYNC_TASK);
    }
  } catch {
    // ignore
  }
  try {
    if (await TaskManager.isTaskRegisteredAsync(TIER_SYNC_PERIODIC_TASK)) {
      await BackgroundFetch.unregisterTaskAsync(TIER_SYNC_PERIODIC_TASK);
    }
  } catch {
    // ignore
  }
}
