import { useRouter } from "expo-router";
import React, { useEffect } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { AtlasLogo } from "@/components/AtlasLogo";
import { useColors } from "@/hooks/useColors";
import { useAtlas } from "@/providers/AtlasProvider";

export default function IndexScreen() {
  const router = useRouter();
  const colors = useColors();
  const { loaded, profile, roadmap } = useAtlas();

  useEffect(() => {
    if (!loaded) return;
    if (profile && roadmap) {
      router.replace("/(tabs)");
    } else {
      router.replace("/welcome");
    }
  }, [loaded, profile, roadmap, router]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AtlasLogo size="lg" />
      <ActivityIndicator color={colors.mutedForeground} style={{ marginTop: 24 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
});
