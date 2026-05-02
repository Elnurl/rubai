import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
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
import { setAuthTokenGetter, setBaseUrl } from "@workspace/api-client-react";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import colors from "@/constants/colors";
import { AtlasProvider, useAtlas } from "@/providers/AtlasProvider";

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

SplashScreen.preventAutoHideAsync();

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

  useEffect(() => {
    setAuthTokenGetter(() => getToken());
    return () => {
      setAuthTokenGetter(null);
    };
  }, [getToken]);

  useEffect(() => {
    if (!isLoaded) return;
    const inAuthGroup = segments[0] === "(auth)";

    // ---- Auth gate ----
    if (!isSignedIn) {
      if (!inAuthGroup) router.replace("/(auth)/sign-in");
      return;
    }
    if (inAuthGroup) {
      router.replace("/");
      return;
    }

    const currentRoute = segments[0];
    const isIndex = currentRoute === undefined;
    const inOnboarding =
      currentRoute !== undefined && ONBOARDING_ROUTES.has(currentRoute);
    const hasGoals = goals.length > 0;

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
  ]);

  return <>{children}</>;
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
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}

export default function RootLayout() {
  const scheme = useColorScheme();
  // Vector-icon fonts are loaded by direct .ttf require rather than by
  // spreading Feather.font / Ionicons.font. The spread relies on
  // @expo/vector-icons' internal asset paths which Metro on Android
  // (Expo Go + new architecture) sometimes registers without delivering
  // the actual font binary, producing tofu boxes for every icon. Copying
  // the .ttf into our own assets/fonts and requiring it explicitly
  // bypasses that bundling problem.
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Feather: require("../assets/fonts/Feather.ttf"),
    Ionicons: require("../assets/fonts/Ionicons.ttf"),
    MaterialIcons: require("../assets/fonts/MaterialIcons.ttf"),
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
          >
            <ClerkLoaded>
              <GestureHandlerRootView style={{ flex: 1 }}>
                <KeyboardProvider>
                  <AtlasProvider>
                    <AuthGate>
                      <RootLayoutNav />
                    </AuthGate>
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
