import { useRouter } from "expo-router";
import React from "react";
import { Pressable, StyleSheet } from "react-native";

import { useColors } from "@/hooks/useColors";
import { AtlasLogo } from "./AtlasLogo";

export function AskCoachPill() {
  const colors = useColors();
  const router = useRouter();

  return (
    <Pressable
      onPress={() => router.push("/(tabs)/coach")}
      accessibilityRole="button"
      accessibilityLabel="Open coach"
      hitSlop={8}
      style={({ pressed }) => [
        styles.box,
        {
          backgroundColor: colors.muted,
          borderColor: colors.border,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <AtlasLogo size="sm" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    alignSelf: "flex-start",
  },
});
