import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Constants from "expo-constants";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import React, { Suspense, lazy, useEffect } from "react";
import {
  ActivityIndicator,
  Platform,
  useColorScheme,
  View,
} from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { setBaseUrl } from "@workspace/api-client-react";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { FontBootstrap } from "@/components/FontBootstrap";
import colors from "@/constants/colors";
import { isPrivateLanApiUrl, isPublicHttpsApiUrl } from "@/lib/apiBaseUrl";
import { cacheApiBaseUrl } from "@/lib/backgroundTierSync";
import { AuthProvider, useAuth } from "@/providers/AuthProvider";

const AppShell = lazy(() => import("@/components/AppShell"));

function resolveApiBaseUrl(): string | null {
  const apiUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "") || "";
  if (apiUrl) {
    // Standalone / release builds must never call a PC LAN address left in env.
    if (!__DEV__ && isPrivateLanApiUrl(apiUrl)) {
      // eslint-disable-next-line no-console
      console.error(
        "[rubai] Refusing private/LAN API URL in release build:",
        apiUrl,
      );
      return null;
    }
    return apiUrl;
  }

  const envDomain = process.env.EXPO_PUBLIC_DOMAIN;
  if (envDomain && envDomain.length > 0) {
    return `https://${envDomain}`;
  }

  if (Platform.OS === "web") {
    if (typeof window !== "undefined" && window.location?.origin) {
      return window.location.origin;
    }
    return null;
  }

  // Metro debugger host is only valid during local development.
  if (!__DEV__) {
    return null;
  }

  const legacyManifest = (
    Constants as unknown as { manifest?: { debuggerHost?: string } }
  ).manifest;
  const hostUri =
    Constants.expoConfig?.hostUri || legacyManifest?.debuggerHost || "";

  if (typeof hostUri === "string" && hostUri.length > 0) {
    const host = hostUri.split(":")[0];
    if (host && host.includes(".")) {
      const apiHost = host.replace(/\.expo\./, ".");
      return `https://${apiHost}`;
    }
  }

  return null;
}

const API_BASE_URL = resolveApiBaseUrl();
if (API_BASE_URL) {
  setBaseUrl(API_BASE_URL);
  // Always overwrite any stale LAN cache from a previous Metro install.
  void cacheApiBaseUrl(API_BASE_URL);
}
// eslint-disable-next-line no-console
console.log(
  "[rubai] API base URL:",
  API_BASE_URL ?? "(none)",
  isPublicHttpsApiUrl(API_BASE_URL) ? "(public https)" : "",
);
if (__DEV__) {
  // eslint-disable-next-line no-console
  console.log(
    "[rubai] Supabase URL:",
    process.env.EXPO_PUBLIC_SUPABASE_URL ?? "(missing)",
  );
}

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

function appBackground(scheme: "light" | "dark" | null | undefined): string {
  return scheme === "dark" ? colors.dark.background : colors.light.background;
}

function AuthBootGate() {
  const { isLoaded } = useAuth();
  const scheme = useColorScheme();
  const bg = appBackground(scheme);

  if (!isLoaded) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: bg,
        }}
      >
        <ActivityIndicator size="large" color="#84CC16" />
      </View>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <FontBootstrap>
        <Suspense
          fallback={
            <View
              style={{
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: bg,
              }}
            >
              <ActivityIndicator size="large" color="#84CC16" />
            </View>
          }
        >
          <AppShell />
        </Suspense>
      </FontBootstrap>
    </QueryClientProvider>
  );
}

export default function RootLayout() {
  const scheme = useColorScheme();

  useEffect(() => {
    const bg = scheme === "dark" ? colors.dark.background : colors.light.background;
    SystemUI.setBackgroundColorAsync(bg).catch(() => {});
  }, [scheme]);

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <StatusBar style="auto" translucent />
        <AuthProvider>
          <AuthBootGate />
        </AuthProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
