import { Feather, Ionicons } from "@expo/vector-icons";
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
import * as SystemUI from "expo-system-ui";
import React, { useEffect } from "react";
import { Platform, useColorScheme } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { setAuthTokenGetter, setBaseUrl } from "@workspace/api-client-react";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import colors from "@/constants/colors";
import { AtlasProvider } from "@/providers/AtlasProvider";

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

function AuthGate({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn, getToken } = useAuth();
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
    if (!isSignedIn && !inAuthGroup) {
      router.replace("/(auth)/sign-in");
    } else if (isSignedIn && inAuthGroup) {
      router.replace("/");
    }
  }, [isLoaded, isSignedIn, segments, router]);

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
      <Stack.Screen name="plans" options={{ presentation: "modal" }} />
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
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
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
