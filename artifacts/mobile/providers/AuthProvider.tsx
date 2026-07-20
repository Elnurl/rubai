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
  isPlausibleAccessToken,
  purgeCorruptAuthStorage,
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

  useEffect(() => {
    let mounted = true;
    void (async () => {
      await clearLegacySecureAuthKeys();
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      const token = data.session?.access_token ?? null;
      if (data.session && !isPlausibleAccessToken(token)) {
        // eslint-disable-next-line no-console
        console.warn(
          "[auth] Corrupt access_token length=",
          token?.length ?? 0,
          "— purging auth storage",
        );
        await supabase.auth.signOut({ scope: "local" }).catch(() => {});
        await purgeCorruptAuthStorage();
        setSession(null);
        setRawUser(null);
        setIsLoaded(true);
        return;
      }
      setSession(data.session);
      setRawUser(data.session?.user ?? null);
      setIsLoaded(true);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      const token = next?.access_token ?? null;
      if (next && !isPlausibleAccessToken(token)) {
        void (async () => {
          await supabase.auth.signOut({ scope: "local" }).catch(() => {});
          await purgeCorruptAuthStorage();
        })();
        setSession(null);
        setRawUser(null);
        setIsLoaded(true);
        return;
      }
      setSession(next);
      setRawUser(next?.user ?? null);
      setIsLoaded(true);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const getToken = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token ?? null;
    if (!isPlausibleAccessToken(token)) {
      if (token) {
        // eslint-disable-next-line no-console
        console.warn("[auth] Rejecting oversized/invalid access_token", token.length);
        await supabase.auth.signOut({ scope: "local" }).catch(() => {});
        await purgeCorruptAuthStorage();
      }
      return null;
    }
    return token;
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    await purgeCorruptAuthStorage();
    if (error) throw error;
  }, []);

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
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
