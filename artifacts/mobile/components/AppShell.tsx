import { Stack, useRouter, useSegments } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, useColorScheme, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { useLegalMyAcceptances, setAuthTokenGetter } from "@workspace/api-client-react";

import colors from "@/constants/colors";
import { setAppLanguage } from "@/lib/i18n";
import { cacheSessionToken } from "@/lib/backgroundTierSync";
import { useAuth } from "@/providers/AuthProvider";
import { AtlasProvider, useAtlas } from "@/providers/AtlasProvider";

const ONBOARDING_ROUTES = new Set([
  "welcome",
  "intake",
  "generating",
  "new-goal",
  "replace-goal",
]);

function appBackground(scheme: "light" | "dark" | null | undefined): string {
  return scheme === "dark" ? colors.dark.background : colors.light.background;
}

function RevenueCatBootstrap({ children }: { children: React.ReactNode }) {
  const scheme = useColorScheme();
  const bg = appBackground(scheme);
  const [SubProvider, setSubProvider] = useState<
    React.ComponentType<{ children: React.ReactNode }> | null
  >(null);

  useEffect(() => {
    let cancelled = false;
    void import("@/lib/revenuecat").then((mod) => {
      if (cancelled) return;
      try {
        mod.initializeRevenueCat();
      } catch (err: unknown) {
        if (__DEV__) {
          console.warn(
            "[rubai] RevenueCat init skipped:",
            err instanceof Error ? err.message : err,
          );
        }
      }
      setSubProvider(() => mod.SubscriptionProvider);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!SubProvider) {
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

  return <SubProvider>{children}</SubProvider>;
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { loaded: atlasLoaded, goals, pendingDraft } = useAtlas();
  const segments = useSegments();
  const router = useRouter();

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

  const { data: legalState, isFetched: legalFetched } = useLegalMyAcceptances({
    query: {
      enabled: isLoaded && isSignedIn,
      queryKey: ["/api/legal/me"],
    },
  });

  useEffect(() => {
    if (!isLoaded) return;
    const inAuthGroup = segments[0] === "(auth)";
    const inLegalGroup = segments[0] === "legal";

    if (!isSignedIn) {
      if (!inAuthGroup) router.replace("/(auth)/sign-in");
      return;
    }
    if (inAuthGroup) {
      router.replace("/");
      return;
    }

    if (legalFetched && legalState && !legalState.allUpToDate) {
      if (!inLegalGroup) {
        router.replace("/legal/consent");
      }
      return;
    }
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

    if (inLegalGroup) return;

    if (!atlasLoaded) {
      if (!isIndex) router.replace("/");
      return;
    }

    if (!hasGoals && !inOnboarding && !isIndex) {
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
  const scheme = useColorScheme();
  const bg = appBackground(scheme);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: bg },
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

export default function AppShell() {
  const scheme = useColorScheme();
  const bg = appBackground(scheme);

  return (
    <RevenueCatBootstrap>
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: bg }}>
        <KeyboardProvider statusBarTranslucent>
          <AtlasProvider>
            <I18nLanguageSync />
            <AuthGate>
              <RootLayoutNav />
            </AuthGate>
          </AtlasProvider>
        </KeyboardProvider>
      </GestureHandlerRootView>
    </RevenueCatBootstrap>
  );
}
