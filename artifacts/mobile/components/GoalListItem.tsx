import { Feather, Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { GOAL_META, profileGoalLabel } from "@/constants/atlas";
import { useColors } from "@/hooks/useColors";
import type { Goal } from "@/types/atlas";

type Props = {
  goal: Goal;
  isActive: boolean;
  weekProgress?: { current: number; total: number };
  onPress: () => void;
  onDelete: () => void;
};

export function GoalListItem({
  goal,
  isActive,
  weekProgress,
  onPress,
  onDelete,
}: Props) {
  const colors = useColors();
  const meta = GOAL_META[goal.profile.goalType];
  const label = profileGoalLabel(goal.profile);
  const headline = goal.roadmap?.headline ?? "Roadmap pending";

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: colors.card,
          borderColor: isActive ? colors.primary : colors.border,
          borderWidth: isActive ? 2 : 1,
          borderRadius: colors.radius,
          opacity: pressed ? 0.92 : 1,
        },
      ]}
    >
      <View
        style={[
          styles.iconWrap,
          {
            backgroundColor: isActive ? colors.primary : meta.accent + "1A",
          },
        ]}
      >
        <Ionicons
          name={meta.icon as React.ComponentProps<typeof Ionicons>["name"]}
          size={22}
          color={isActive ? colors.primaryForeground : meta.accent}
        />
      </View>

      <View style={{ flex: 1, gap: 4 }}>
        <View style={styles.titleRow}>
          <Text
            numberOfLines={1}
            style={[
              styles.title,
              { color: colors.foreground, fontFamily: "Inter_600SemiBold" },
            ]}
          >
            {label}
          </Text>
          {isActive ? (
            <View
              style={[
                styles.activeBadge,
                {
                  backgroundColor: colors.primary + "1A",
                  borderColor: colors.primary,
                },
              ]}
            >
              <Text
                style={[
                  styles.activeText,
                  { color: colors.primary, fontFamily: "Inter_600SemiBold" },
                ]}
              >
                ACTIVE
              </Text>
            </View>
          ) : null}
        </View>
        <Text
          numberOfLines={2}
          style={[
            styles.subtitle,
            { color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
          ]}
        >
          {headline}
        </Text>
        {weekProgress && goal.roadmap ? (
          <Text
            style={[
              styles.progressText,
              { color: colors.mutedForeground, fontFamily: "Inter_500Medium" },
            ]}
          >
            Week {weekProgress.current} of {weekProgress.total}
          </Text>
        ) : null}
      </View>

      <Pressable
        onPress={onDelete}
        hitSlop={10}
        style={[styles.deleteBtn, { backgroundColor: colors.muted }]}
      >
        <Feather name="trash-2" size={15} color={colors.mutedForeground} />
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: {
    fontSize: 15.5,
    flexShrink: 1,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  progressText: {
    fontSize: 11.5,
    letterSpacing: 0.3,
    marginTop: 2,
  },
  activeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderRadius: 999,
  },
  activeText: {
    fontSize: 9.5,
    letterSpacing: 1,
  },
  deleteBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
});
