import { useRouter } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";

export function AskCoachPill() {
  const colors = useColors();
  const router = useRouter();

  return (
    <Pressable
      onPress={() => router.push("/(tabs)/coach")}
      accessibilityRole="button"
      accessibilityLabel="Ask AI"
      hitSlop={8}
      style={({ pressed }) => [
        styles.pill,
        {
          backgroundColor: colors.background,
          borderColor: colors.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <View
        style={[
          styles.dot,
          { backgroundColor: colors.primary },
        ]}
      />
      <Text
        style={[
          styles.label,
          { color: colors.foreground, fontFamily: "Inter_600SemiBold" },
        ]}
      >
        Ask AI
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  label: {
    fontSize: 12.5,
    letterSpacing: 0.2,
  },
});
