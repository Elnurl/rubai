import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, type Session, type User } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.SUPABASE_ANON_KEY ??
  "";

/**
 * Bump this whenever auth storage format / corruption recovery changes.
 * Orphans the old default `sb-<ref>-auth-token` key so a stuck ~480KB blob
 * can never be read again — even if the user doesn't uninstall the app.
 */
export const AUTH_STORAGE_KEY = "rubai-auth-v3";

/**
 * Auth sessions must live in AsyncStorage only.
 *
 * The previous SecureStore→AsyncStorage hybrid corrupted sessions: when a
 * session grew past SecureStore's ~2KB limit it was written to AsyncStorage,
 * but getItem still preferred a stale SecureStore value. That produced a
 * fake "access_token" hundreds of KB long and HTTP 431 on Railway.
 */
const AuthStorageAdapter = {
  getItem: (key: string) => AsyncStorage.getItem(key),
  setItem: (key: string, value: string) => AsyncStorage.setItem(key, value),
  removeItem: (key: string) => AsyncStorage.removeItem(key),
};

/** Delete legacy SecureStore auth keys left by the old hybrid adapter. */
export async function clearLegacySecureAuthKeys(): Promise<void> {
  if (Platform.OS === "web") return;
  const keys = new Set<string>(["atlas:bg:session_token"]);
  try {
    const host = new URL(
      supabaseUrl || "https://placeholder.supabase.co",
    ).hostname;
    const ref = host.split(".")[0];
    if (ref && ref !== "placeholder") {
      keys.add(`sb-${ref}-auth-token`);
      keys.add(`sb-${ref}-auth-token-code-verifier`);
    }
  } catch {
    // ignore bad URL
  }
  for (const key of keys) {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch {
      // ignore missing keys
    }
  }
}

/**
 * Wipe every Supabase / legacy auth key from AsyncStorage + SecureStore.
 * Needed when a corrupt ~hundreds-of-KB "access_token" is stuck on device.
 */
export async function purgeCorruptAuthStorage(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const authKeys = keys.filter(
      (k) =>
        k === AUTH_STORAGE_KEY ||
        k.includes("supabase") ||
        k.includes("auth-token") ||
        k.startsWith("sb-") ||
        k.includes("@supabase") ||
        k.startsWith("rubai-auth"),
    );
    if (authKeys.length > 0) {
      await AsyncStorage.multiRemove(authKeys);
    }
  } catch {
    // ignore
  }
  await clearLegacySecureAuthKeys();
}

/**
 * Delete any auth-related AsyncStorage values that are absurdly large
 * (the ~480KB corruption case) without wiping a healthy small session.
 */
export async function sanitizeOversizedAuthStorage(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const candidates = keys.filter(
      (k) =>
        k === AUTH_STORAGE_KEY ||
        k.includes("supabase") ||
        k.includes("auth-token") ||
        k.startsWith("sb-") ||
        k.includes("@supabase") ||
        k.startsWith("rubai-auth"),
    );
    if (candidates.length === 0) return;
    const pairs = await AsyncStorage.multiGet(candidates);
    const doomed: string[] = [];
    for (const [key, value] of pairs) {
      if (value && value.length > CORRUPT_TOKEN_CHARS) {
        doomed.push(key);
        continue;
      }
      if (!value || value.length < 40) continue;
      try {
        const parsed = JSON.parse(value) as { access_token?: unknown };
        if (
          typeof parsed?.access_token === "string" &&
          parsed.access_token.length > CORRUPT_TOKEN_CHARS
        ) {
          doomed.push(key);
        }
      } catch {
        // not JSON — ignore
      }
    }
    if (doomed.length > 0) {
      await AsyncStorage.multiRemove(doomed);
    }
  } catch {
    // ignore
  }
  await clearLegacySecureAuthKeys();
}

/**
 * Corrupt blob threshold — the SecureStore hybrid bug produced ~480KB
 * "access_token" values. Real JWTs never approach this size.
 */
export const CORRUPT_TOKEN_CHARS = 50_000;

/**
 * Max size we will put in an Authorization header (Railway/Node ~16KB
 * default header limit; leave room for other headers).
 */
export const MAX_USABLE_TOKEN_CHARS = 16_000;

export type AuthTokenDescription = {
  length: number;
  parts: number;
  corrupt: boolean;
  usable: boolean;
};

export function describeAuthToken(
  token: string | null | undefined,
): AuthTokenDescription {
  if (!token || typeof token !== "string") {
    return { length: 0, parts: 0, corrupt: false, usable: false };
  }
  const segments = token.split(".");
  const parts = segments.filter((p) => p.length > 0).length;
  const corrupt = token.length > CORRUPT_TOKEN_CHARS;
  // Regression expectations:
  // - length 480844 → corrupt, not usable
  // - typical JWT ~800–2000, 3 segments → usable
  // - ~10k JWT, 3 segments → usable (custom-fetch caps Authorization at 16k)
  const usable =
    !corrupt &&
    token.length >= 40 &&
    token.length <= MAX_USABLE_TOKEN_CHARS &&
    segments.length === 3 &&
    segments.every((p) => p.length > 0);
  return { length: token.length, parts, corrupt, usable };
}

/** True only for the hundreds-of-KB storage corruption case. */
export function isCorruptAccessToken(
  token: string | null | undefined,
): boolean {
  return describeAuthToken(token).corrupt;
}

/**
 * True when the token is safe to send as Bearer on our API
 * (JWT shape + within header size budget).
 */
export function isPlausibleAccessToken(
  token: string | null | undefined,
): boolean {
  return describeAuthToken(token).usable;
}

if (__DEV__ && (!supabaseUrl || !supabaseAnonKey)) {
  // eslint-disable-next-line no-console
  console.warn(
    "[rubai] Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY",
  );
}

export const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "placeholder",
  {
    auth: {
      storage: AuthStorageAdapter,
      storageKey: AUTH_STORAGE_KEY,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);

export type { Session, User };
