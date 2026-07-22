import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import type { Session, User as SupabaseUser } from "@supabase/supabase-js";

import {
  clearLegacySecureAuthKeys,
  describeAuthToken,
  isCorruptAccessToken,
  isPlausibleAccessToken,
  purgeCorruptAuthStorage,
  sanitizeOversizedAuthStorage,
  supabase,
} from "@/lib/supabase";

WebBrowser.maybeCompleteAuthSession();

type ContactResource = {
  id: string;
  emailAddress?: string;
  phoneNumber?: string;
  destroy: () => Promise<void>;
};

type VerifiableContact = {
  id: string;
  prepareVerification: (o?: { strategy?: string }) => Promise<void>;
  attemptVerification: (o: { code: string }) => Promise<void>;
  verification?: { status?: string };
  isVerified: () => boolean;
  reload: () => Promise<void>;
  destroy: () => Promise<void>;
};

export type AuthUser = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  imageUrl: string | null;
  passwordEnabled: boolean;
  primaryEmailAddress: ContactResource | null;
  primaryPhoneNumber: ContactResource | null;
  emailAddresses: ContactResource[];
  phoneNumbers: ContactResource[];
  update: (data: {
    firstName?: string;
    lastName?: string;
    primaryEmailAddressId?: string;
    primaryPhoneNumberId?: string;
  }) => Promise<void>;
  updatePassword: (data: {
    currentPassword?: string;
    newPassword: string;
    signOutOfOtherSessions?: boolean;
  }) => Promise<void>;
  setProfileImage: (opts: { file: string | null }) => Promise<void>;
  createEmailAddress: (opts: { email: string }) => Promise<VerifiableContact>;
  createPhoneNumber: (opts: {
    phoneNumber: string;
  }) => Promise<VerifiableContact>;
  reload: () => Promise<void>;
};

type AuthContextValue = {
  isLoaded: boolean;
  isSignedIn: boolean;
  userId: string | null;
  session: Session | null;
  user: AuthUser | null;
  getToken: () => Promise<string | null>;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  signUpWithPassword: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function mapUser(
  raw: SupabaseUser | null,
  reload: () => Promise<void>,
): AuthUser | null {
  if (!raw) return null;
  const meta = (raw.user_metadata ?? {}) as Record<string, unknown>;
  const firstName =
    (typeof meta.first_name === "string" && meta.first_name) ||
    (typeof meta.firstName === "string" && meta.firstName) ||
    (typeof meta.full_name === "string"
      ? meta.full_name.split(" ")[0]
      : null) ||
    null;
  const lastName =
    (typeof meta.last_name === "string" && meta.last_name) ||
    (typeof meta.lastName === "string" && meta.lastName) ||
    null;
  const imageUrl =
    (typeof meta.avatar_url === "string" && meta.avatar_url) ||
    (typeof meta.picture === "string" && meta.picture) ||
    null;
  const email = raw.email ?? null;
  const phone = raw.phone ?? null;
  const noopDestroy = async () => {};
  const passwordEnabled =
    Array.isArray(raw.identities) &&
    raw.identities.some(
      (i) => i.provider === "email" || i.provider === "phone",
    );

  return {
    id: raw.id,
    firstName,
    lastName,
    username: typeof meta.username === "string" ? meta.username : null,
    imageUrl,
    passwordEnabled,
    primaryEmailAddress: email
      ? { id: raw.id, emailAddress: email, destroy: noopDestroy }
      : null,
    primaryPhoneNumber: phone
      ? { id: raw.id, phoneNumber: phone, destroy: noopDestroy }
      : null,
    emailAddresses: email
      ? [{ id: raw.id, emailAddress: email, destroy: noopDestroy }]
      : [],
    phoneNumbers: phone
      ? [{ id: raw.id, phoneNumber: phone, destroy: noopDestroy }]
      : [],
    update: async ({ firstName: fn, lastName: ln }) => {
      const { error } = await supabase.auth.updateUser({
        data: {
          first_name: fn,
          last_name: ln,
          firstName: fn,
          lastName: ln,
        },
      });
      if (error) throw error;
      await reload();
    },
    updatePassword: async ({ newPassword }) => {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
    },
    setProfileImage: async ({ file }) => {
      const { error } = await supabase.auth.updateUser({
        data: { avatar_url: file },
      });
      if (error) throw error;
      await reload();
    },
    createEmailAddress: async ({ email: nextEmail }) => {
      let verified = false;
      return {
        id: nextEmail,
        prepareVerification: async () => {
          const { error } = await supabase.auth.updateUser({
            email: nextEmail,
          });
          if (error) throw error;
        },
        attemptVerification: async ({ code }) => {
          const { error } = await supabase.auth.verifyOtp({
            email: nextEmail,
            token: code,
            type: "email_change",
          });
          if (error) throw error;
          verified = true;
        },
        get verification() {
          return { status: verified ? "verified" : "pending" };
        },
        isVerified: () => verified,
        reload: async () => {
          await reload();
        },
        destroy: noopDestroy,
      };
    },
    createPhoneNumber: async ({ phoneNumber }) => {
      let verified = false;
      return {
        id: phoneNumber,
        prepareVerification: async () => {
          const { error } = await supabase.auth.updateUser({
            phone: phoneNumber,
          });
          if (error) throw error;
        },
        attemptVerification: async ({ code }) => {
          const { error } = await supabase.auth.verifyOtp({
            phone: phoneNumber,
            token: code,
            type: "phone_change",
          });
          if (error) throw error;
          verified = true;
        },
        get verification() {
          return { status: verified ? "verified" : "pending" };
        },
        isVerified: () => verified,
        reload: async () => {
          await reload();
        },
        destroy: noopDestroy,
      };
    },
    reload,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [rawUser, setRawUser] = useState<SupabaseUser | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  /** Bumps when a valid session lands so deferred corrupt-token purges don't wipe a fresh login. */
  const authEpochRef = React.useRef(0);

  const refreshUser = useCallback(async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.warn("[auth] getUser failed", error.message);
      }
      return;
    }
    setRawUser(data.user);
  }, []);

  const dropCorruptSession = useCallback((reason: string, tokenLen: number) => {
    // Never call supabase.auth.signOut inside onAuthStateChange — it deadlocks
    // the auth mutex and makes the next sign-in hang with no error.
    authEpochRef.current += 1;
    const epoch = authEpochRef.current;
    // eslint-disable-next-line no-console
    console.warn(`[auth] ${reason} length=`, tokenLen, "— scheduling storage purge");
    setSession(null);
    setRawUser(null);
    setIsLoaded(true);
    setTimeout(() => {
      if (epoch !== authEpochRef.current) return;
      void purgeCorruptAuthStorage().catch(() => {});
    }, 0);
  }, []);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      // Orphan old corrupt blobs + wipe any oversized auth values before
      // Supabase reads a session. storageKey is rubai-auth-v3; this also
      // cleans leftover sb-*-auth-token keys from earlier builds.
      try {
        await sanitizeOversizedAuthStorage();
        await clearLegacySecureAuthKeys();
      } catch {
        // ignore
      }
      try {
        const { data } = await supabase.auth.getSession();
        if (!mounted) return;
        const token = data.session?.access_token ?? null;
        // Only purge the ~480KB storage-corruption case — never a normal JWT.
        if (data.session && isCorruptAccessToken(token)) {
          dropCorruptSession(
            "Corrupt access_token on boot",
            token?.length ?? 0,
          );
          return;
        }
        if (data.session) authEpochRef.current += 1;
        setSession(data.session);
        setRawUser(data.session?.user ?? null);
      } catch (err) {
        if (__DEV__) {
          // eslint-disable-next-line no-console
          console.warn("[auth] getSession failed", err);
        }
        if (!mounted) return;
        setSession(null);
        setRawUser(null);
      } finally {
        if (mounted) setIsLoaded(true);
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      const token = next?.access_token ?? null;
      if (next && isCorruptAccessToken(token)) {
        dropCorruptSession(
          "Corrupt access_token from auth event",
          token?.length ?? 0,
        );
        return;
      }
      if (next) authEpochRef.current += 1;
      setSession(next);
      setRawUser(next?.user ?? null);
      setIsLoaded(true);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [dropCorruptSession]);

  const getToken = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token ?? null;
    if (!token) return null;
    if (isCorruptAccessToken(token)) {
      dropCorruptSession("Rejecting corrupt access_token", token.length);
      return null;
    }
    // Prefer JWT-shaped tokens for API headers; if shape check fails but
    // size is fine, still return it — do not sign the user out.
    if (!isPlausibleAccessToken(token)) {
      const info = describeAuthToken(token);
      if (info.length > 0 && info.length <= 16_000) {
        return token;
      }
      // eslint-disable-next-line no-console
      console.warn(
        "[auth] Token not usable for API headers",
        `length=${info.length} parts=${info.parts}`,
      );
      return null;
    }
    return token;
  }, [dropCorruptSession]);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    await purgeCorruptAuthStorage();
    setSession(null);
    setRawUser(null);
    if (error) throw error;
  }, []);

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    if (!data.session) {
      throw new Error(
        "No session returned after sign-in. Confirm your email, then try again.",
      );
    }
    const token = data.session.access_token ?? null;
    const info = describeAuthToken(token);
    if (info.corrupt) {
      await purgeCorruptAuthStorage().catch(() => {});
      throw new Error(
        `Sign-in returned a corrupt token (length=${info.length}, parts=${info.parts}). Try again.`,
      );
    }
    // Accept the Supabase session. Do not purge on strict JWT/shape mismatch —
    // that previously blocked valid logins after a successful password grant.
    authEpochRef.current += 1;
    setSession(data.session);
    setRawUser(data.session.user);
    setIsLoaded(true);
  }, []);

  const signUpWithPassword = useCallback(async (email: string, password: string) => {
    const emailRedirectTo = Linking.createURL("auth/callback");
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo },
    });
    if (error) throw error;
    // If email confirmation is required, session may be null.
    if (!data.session && data.user) {
      throw new Error(
        "Check your email to confirm your account, then sign in.",
      );
    }
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const redirectTo = Linking.createURL("auth/callback");
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        skipBrowserRedirect: true,
      },
    });
    if (error) throw error;
    if (!data.url) throw new Error("No OAuth URL returned from Supabase");

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type !== "success" || !("url" in result) || !result.url) {
      return;
    }

    const url = new URL(result.url);
    // PKCE: ?code=…  |  implicit: #access_token=…
    const code = url.searchParams.get("code");
    if (code) {
      const { error: exchangeError } =
        await supabase.auth.exchangeCodeForSession(code);
      if (exchangeError) throw exchangeError;
      return;
    }

    const hash = url.hash.startsWith("#") ? url.hash.slice(1) : url.hash;
    const params = new URLSearchParams(hash);
    const access_token = params.get("access_token");
    const refresh_token = params.get("refresh_token");
    if (access_token && refresh_token) {
      const { error: setError } = await supabase.auth.setSession({
        access_token,
        refresh_token,
      });
      if (setError) throw setError;
    }
  }, []);

  const requestPasswordReset = useCallback(async (email: string) => {
    const redirectTo = Linking.createURL("auth/callback");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });
    if (error) throw error;
  }, []);

  const user = useMemo(
    () => mapUser(rawUser, refreshUser),
    [rawUser, refreshUser],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      isLoaded,
      isSignedIn: !!session?.user,
      userId: session?.user?.id ?? null,
      session,
      user,
      getToken,
      signInWithPassword,
      signUpWithPassword,
      signInWithGoogle,
      signOut,
      requestPasswordReset,
      refreshUser,
    }),
    [
      isLoaded,
      session,
      user,
      getToken,
      signInWithPassword,
      signUpWithPassword,
      signInWithGoogle,
      signOut,
      requestPasswordReset,
      refreshUser,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function useUser() {
  const { user, isLoaded, refreshUser } = useAuth();
  return { user, isLoaded, refreshUser };
}
