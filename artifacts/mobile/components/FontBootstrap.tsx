import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { Feather, Ionicons, MaterialIcons } from "@expo/vector-icons";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, useColorScheme, View } from "react-native";

import colors from "@/constants/colors";

SplashScreen.preventAutoHideAsync();

function appBackground(scheme: "light" | "dark" | null | undefined): string {
  return scheme === "dark" ? colors.dark.background : colors.light.background;
}

/** Loads Inter + icon fonts after auth is ready so font I/O cannot block session hydrate. */
export function FontBootstrap({ children }: { children: React.ReactNode }) {
  const scheme = useColorScheme();
  const bg = appBackground(scheme);
  const [fontTimedOut, setFontTimedOut] = useState(false);
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
    const t = setTimeout(() => setFontTimedOut(true), 4000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (fontsLoaded || fontError || fontTimedOut) {
      SplashScreen.hideAsync();
    }
    if (fontError && __DEV__) {
      // eslint-disable-next-line no-console
      console.warn("[rubai] Font loading failed:", fontError);
    }
  }, [fontsLoaded, fontError, fontTimedOut]);

  const fontsReady = fontsLoaded || fontError || fontTimedOut;

  if (!fontsReady) {
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

  return <>{children}</>;
}
