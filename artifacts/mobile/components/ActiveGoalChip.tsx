import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { GOAL_META, profileGoalLabel } from "@/constants/atlas";
import { useColors } from "@/hooks/useColors";
import { useAtlas } from "@/providers/AtlasProvider";

export function ActiveGoalChip() {
  const colors = useColors();
  const router = useRouter();
  const { goals, activeGoal } = useAtlas();
  if (!activeGoal || goals.length < 2) return null;
  const meta = GOAL_META[activeGoal.profile.goalType];
  const label = profileGoalLabel(activeGoal.profile);

  return (
    <Pressable
      onPress={() => router.navigate("/goals")}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: colors.muted,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
      hitSlop={6}
    >
      <View
        style={[
          styles.dot,
          { backgroundColor: meta.accent },
        ]}
      />
      <Text
        numberOfLines={1}
        style={[
          styles.label,
          { color: colors.foreground, fontFamily: "Inter_600SemiBold" },
        ]}
      >
        {label}
      </Text>
      <Ionicons name="chevron-down" size={14} color={colors.mutedForeground} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    maxWidth: 200,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  label: {
    fontSize: 12,
    letterSpacing: 0.2,
    flexShrink: 1,
  },
});
