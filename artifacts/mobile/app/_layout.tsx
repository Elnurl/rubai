import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { Feather, Ionicons, MaterialIcons } from "@expo/vector-icons";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ClerkLoaded, ClerkProvider, useAuth } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
import Constants from "expo-constants";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import React, { useEffect } from "react";
import { Platform, useColorScheme } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import {
  setAuthTokenGetter,
  setBaseUrl,
  useLegalMyAcceptances,
} from "@workspace/api-client-react";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import colors from "@/constants/colors";
import { setAppLanguage } from "@/lib/i18n";
import { AtlasProvider, useAtlas } from "@/providers/AtlasProvider";
import { initializeRevenueCat, SubscriptionProvider } from "@/lib/revenuecat";
import {
  cacheApiBaseUrl,
  cacheSessionToken,
} from "@/lib/backgroundTierSync";
import { Alert } from "react-native";

try {
  initializeRevenueCat();
} catch (err: unknown) {
  Alert.alert("RevenueCat Unavailable", err instanceof Error ? err.message : "Unknown error");
}

function resolveApiBaseUrl(): string | null {
  // 1. Explicit env var baked in at bundle time (set by the dev workflow).
  const envDomain = process.env.EXPO_PUBLIC_DOMAIN;
  if (envDomain && envDomain.length > 0) {
    return `https://${envDomain}`;
  }

  // 2. On web, use the current origin (relative URLs work in browsers).
  if (Platform.OS === "web") {
    if (typeof window !== "undefined" && window.location?.origin) {
      return window.location.origin;
    }
    return null;
  }

  // 3. On native, fall back to deriving the host from the Expo manifest.
  // When loaded via Expo Go / dev client, `hostUri` looks like
  // "<repl-domain>:<port>" — the actual API server is exposed at the same
  // domain over HTTPS without the port.
  const legacyManifest = (Constants as unknown as {
    manifest?: { debuggerHost?: string };
  }).manifest;
  const hostUri =
    Constants.expoConfig?.hostUri ||
    legacyManifest?.debuggerHost ||
    "";
  if (typeof hostUri === "string" && hostUri.length > 0) {
    const host = hostUri.split(":")[0];
    if (host && host.includes(".")) {
      // Strip the leading "<id>.expo." segment (Expo dev proxy domain) so we
      // hit the regular HTTPS app domain instead of the packager.
      const apiHost = host.replace(/\.expo\./, ".");
      return `https://${apiHost}`;
    }
  }

  return null;
}

const API_BASE_URL = resolveApiBaseUrl();
if (API_BASE_URL) {
  setBaseUrl(API_BASE_URL);
  // Cache the base URL in AsyncStorage so background tasks can build
  // absolute URLs without re-running the env-var resolution logic.
  void cacheApiBaseUrl(API_BASE_URL);
}
if (__DEV__) {
  // eslint-disable-next-line no-console
  console.log("[rubai] API base URL:", API_BASE_URL ?? "(none — relative)");
}

const CLERK_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
if (!CLERK_PUBLISHABLE_KEY) {
  // eslint-disable-next-line no-console
  console.warn(
    "[rubai] Missing EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY — auth screens will fail to load.",
  );
}

// Clerk proxy URL — empty in dev (Clerk hits FAPI directly), auto-set in
// the Replit-hosted web build and provided as an EAS secret for native builds.
// Do NOT gate on __DEV__ — the empty value in dev is intentional.
const CLERK_PROXY_URL = process.env.EXPO_PUBLIC_CLERK_PROXY_URL || undefined;

SplashScreen.preventAutoHideAsync();

// Web-only: the `fontfaceobserver` package (transitive dep used by Expo's web
// font loader) raises an "Nms timeout exceeded" Error when a custom font
// hasn't reported as loaded within its 3s window. The font itself loads fine
// — the observer is just impatient — but the throw bubbles up to Expo's web
// LogBox as a full-screen "Uncaught Error" modal that blocks the entire UI
// on slower connections. We swallow only this specific error so it can't hide
// the app behind a modal; everything else still surfaces normally.
if (Platform.OS === "web" && typeof window !== "undefined") {
  const isFontObserverTimeout = (msg: unknown): boolean => {
    if (typeof msg !== "string") return false;
    return /\d+ms timeout exceeded/i.test(msg);
  };
  window.addEventListener("error", (event) => {
    if (isFontObserverTimeout(event.message)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  });
  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    const msg =
      typeof reason === "string"
        ? reason
        : reason instanceof Error
          ? reason.message
          : "";
    if (isFontObserverTimeout(msg)) {
      event.preventDefault();
    }
  });
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});

// Routes a brand-new (no goals) user is allowed to be on. Anything else
// kicks them back to /welcome so the only escape is creating a goal. We
// include the goal-add/replace flows here too — existing users use those,
// and they're harmless for a new user (the flow itself enforces it).
const ONBOARDING_ROUTES = new Set([
  "welcome",
  "intake",
  "generating",
  "new-goal",
  "replace-goal",
]);

function AuthGate({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { loaded: atlasLoaded, goals, pendingDraft } = useAtlas();
  const segments = useSegments();
  const router = useRouter();

  // Wrap the Clerk token getter so every token retrieval also caches the JWT
  // in SecureStore for background-task use (no React context in background).
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

  // Only fetch the legal-acceptance state once we know the user is signed in,
  // and let the AuthGate fall through (i.e. permit any route) until the
  // result is back so we don't bounce them unnecessarily on cold start.
  // The hook only fires its underlying request once an auth token is
  // available (customFetch awaits the registered token getter), so we don't
  // need to gate it manually with `enabled` — and gating with `enabled`
  // would otherwise force us to also supply a queryKey. Once signed-out the
  // token getter returns null and the call short-circuits.
  const { data: legalState, isFetched: legalFetched } = useLegalMyAcceptances();

  useEffect(() => {
    if (!isLoaded) return;
    const inAuthGroup = segments[0] === "(auth)";
    const inLegalGroup = segments[0] === "legal";

    // ---- Auth gate ----
    if (!isSignedIn) {
      if (!inAuthGroup) router.replace("/(auth)/sign-in");
      return;
    }
    if (inAuthGroup) {
      router.replace("/");
      return;
    }

    // ---- Legal gate ----
    // After sign-in but before any other gating, require the user to accept
    // the current Privacy Policy + Terms of Service. We only act once the
    // /legal/me query has resolved, so a slow network never traps users on a
    // blank gate.
    if (legalFetched && legalState && !legalState.allUpToDate) {
      if (!inLegalGroup) {
        router.replace("/legal/consent");
      }
      return;
    }
    // Conversely, if the user *is* up to date but somehow lands on the
    // legal flow (e.g. via deep link), let them out.
    if (
      legalFetched &&
      legalState &&
      legalState.allUpToDate &&
      inLegalGroup &&
      segments[1] === "consent"
    ) {
      router.replace("/");
      return;
    }

    const currentRoute = segments[0];
    const isIndex = currentRoute === undefined;
    const inOnboarding =
      currentRoute !== undefined && ONBOARDING_ROUTES.has(currentRoute);
    const hasGoals = goals.length > 0;

    // Don't apply the goal gate while we're inside the legal flow — the
    // user is already being held there by the block above.
    if (inLegalGroup) return;

    // ---- Pre-hydration holding pattern ----
    // Until AtlasProvider has loaded goals from cache + server we don't yet
    // know whether this user is brand-new or returning. A deep link or a
    // restored web session could otherwise drop them straight onto /(tabs),
    // /plans, /welcome, etc. before the gate below can decide. Force them
    // onto the splash route, which already waits on `loaded` and then routes
    // them to /welcome or /(tabs) correctly.
    if (!atlasLoaded) {
      if (!isIndex) router.replace("/");
      return;
    }

    // ---- Goal gate (post-hydration) ----

    if (!hasGoals && !inOnboarding && !isIndex) {
      // New user trying to reach tabs / plans / anywhere else. Force them
      // back into the goal-creation funnel — if they already started a
      // draft, drop them where /index would have, otherwise welcome.
      if (pendingDraft) {
        router.replace(
          pendingDraft.stage === "ready_to_generate" ? "/generating" : "/intake",
        );
      } else {
        router.replace("/welcome");
      }
      return;
    }

    if (hasGoals && currentRoute === "welcome") {
      // Existing user landed on welcome — they should never see it again.
      // Send them to the daily/today tab.
      router.replace("/(tabs)");
    }
  }, [
    isLoaded,
    isSignedIn,
    segments,
    router,
    atlasLoaded,
    goals.length,
    pendingDraft,
    legalFetched,
    legalState,
  ]);

  return <>{children}</>;
}

function I18nLanguageSync() {
  const { account } = useAtlas();
  useEffect(() => {
    setAppLanguage(account.preferredLanguage);
  }, [account.preferredLanguage]);
  return null;
}

function RootLayoutNav() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "transparent" },
      }}
    >
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="index" />
      <Stack.Screen name="welcome" />
      <Stack.Screen name="new-goal" />
      <Stack.Screen name="intake" />
      <Stack.Screen name="generating" />
      <Stack.Screen name="replace-goal" />
      <Stack.Screen name="plans" />
      <Stack.Screen name="account/profile" />
      <Stack.Screen name="account/settings" />
      <Stack.Screen name="account/privacy" />
      <Stack.Screen name="account/notifications" />
      <Stack.Screen name="legal" />
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}

export default function RootLayout() {
  const scheme = useColorScheme();
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    ...Feather.font,
    ...Ionicons.font,
    ...MaterialIcons.font,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
    if (fontError) {
      // Surface font / icon-font loading failures so we can diagnose the
      // "tofu boxes everywhere" symptom in the field.
      // eslint-disable-next-line no-console
      console.warn("[rubai] Font loading failed:", fontError);
    }
  }, [fontsLoaded, fontError]);

  useEffect(() => {
    const bg = scheme === "dark" ? colors.dark.background : colors.light.background;
    SystemUI.setBackgroundColorAsync(bg).catch(() => {});
  }, [scheme]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        {/* Cream surface in light, charcoal in dark — `style="auto"` flips the
            status bar text color to whichever stays legible. */}
        <StatusBar style="auto" translucent />
        <QueryClientProvider client={queryClient}>
          <ClerkProvider
            publishableKey={CLERK_PUBLISHABLE_KEY ?? ""}
            tokenCache={tokenCache}
            proxyUrl={CLERK_PROXY_URL}
          >
            <ClerkLoaded>
              <GestureHandlerRootView style={{ flex: 1 }}>
                <KeyboardProvider>
                  <AtlasProvider>
                    <I18nLanguageSync />
                    <SubscriptionProvider>
                      <AuthGate>
                        <RootLayoutNav />
                      </AuthGate>
                    </SubscriptionProvider>
                  </AtlasProvider>
                </KeyboardProvider>
              </GestureHandlerRootView>
            </ClerkLoaded>
          </ClerkProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
