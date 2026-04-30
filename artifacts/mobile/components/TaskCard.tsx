import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

import { useColors } from "@/hooks/useColors";
import type { DailyTask } from "@workspace/api-client-react";

type Props = {
  task: DailyTask;
  completed: boolean;
  onToggle: () => void;
  onReflect?: () => void;
  hasReflection?: boolean;
  index: number;
};

export function TaskCard({
  task,
  completed,
  onToggle,
  onReflect,
  hasReflection,
  index,
}: Props) {
  const colors = useColors();

  const handlePress = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(
        completed ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium,
      ).catch(() => {});
    }
    onToggle();
  };

  const handleLongPress = () => {
    if (!onReflect) return;
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
    onReflect();
  };

  const priorityBadge = (() => {
    if (task.priority === "critical")
      return { text: "Critical", color: colors.destructive };
    if (task.priority === "high")
      return { text: "Priority", color: colors.accent };
    return null;
  })();

  return (
    <Animated.View entering={FadeIn.delay(index * 60).duration(280)}>
      <Pressable
        onPress={handlePress}
        onLongPress={onReflect ? handleLongPress : undefined}
        delayLongPress={350}
        style={({ pressed }) => [
          styles.card,
          {
            backgroundColor: colors.card,
            borderRadius: colors.radius,
            borderColor: completed ? colors.primary + "55" : colors.border,
            opacity: pressed ? 0.92 : 1,
          },
        ]}
      >
        <Pressable
          onPress={handlePress}
          hitSlop={10}
          style={[
            styles.checkbox,
            {
              borderColor: completed ? colors.primary : colors.border,
              backgroundColor: completed ? colors.primary : "transparent",
            },
          ]}
        >
          {completed && (
            <Feather name="check" size={16} color={colors.primaryForeground} />
          )}
        </Pressable>

        <View style={styles.body}>
          <View style={styles.headerRow}>
            <Text
              style={[
                styles.title,
                {
                  color: completed ? colors.mutedForeground : colors.foreground,
                  textDecorationLine: completed ? "line-through" : "none",
                  fontFamily: "Inter_600SemiBold",
                },
              ]}
              numberOfLines={2}
            >
              {task.title}
            </Text>
          </View>
          <Text
            style={[
              styles.description,
              { color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
            ]}
            numberOfLines={3}
          >
            {task.description}
          </Text>
          <View style={styles.metaRow}>
            <View style={styles.metaPill}>
              <Feather name="clock" size={12} color={colors.mutedForeground} />
              <Text
                style={[
                  styles.metaText,
                  { color: colors.mutedForeground, fontFamily: "Inter_500Medium" },
                ]}
              >
                {task.durationMinutes} min
              </Text>
            </View>
            <View style={styles.metaPill}>
              <Feather name="tag" size={12} color={colors.mutedForeground} />
              <Text
                style={[
                  styles.metaText,
                  { color: colors.mutedForeground, fontFamily: "Inter_500Medium" },
                ]}
              >
                {task.category}
              </Text>
            </View>
            {priorityBadge && (
              <View
                style={[
                  styles.metaPill,
                  { backgroundColor: priorityBadge.color + "1A" },
                ]}
              >
                <Text
                  style={[
                    styles.metaText,
                    { color: priorityBadge.color, fontFamily: "Inter_600SemiBold" },
                  ]}
                >
                  {priorityBadge.text}
                </Text>
              </View>
            )}
            {onReflect && (
              <Pressable
                onPress={onReflect}
                hitSlop={6}
                style={[
                  styles.metaPill,
                  {
                    backgroundColor: hasReflection
                      ? colors.primary + "1A"
                      : "transparent",
                    borderWidth: 1,
                    borderColor: hasReflection ? colors.primary + "55" : colors.border,
                  },
                ]}
              >
                <Feather
                  name={hasReflection ? "message-circle" : "edit-3"}
                  size={11}
                  color={hasReflection ? colors.primary : colors.mutedForeground}
                />
                <Text
                  style={[
                    styles.metaText,
                    {
                      color: hasReflection ? colors.primary : colors.mutedForeground,
                      fontFamily: "Inter_600SemiBold",
                    },
                  ]}
                >
                  {hasReflection ? "Reflected" : "Reflect"}
                </Text>
              </Pressable>
            )}
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    padding: 16,
    gap: 14,
    borderWidth: 1,
    alignItems: "flex-start",
  },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  body: {
    flex: 1,
    gap: 6,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    fontSize: 15.5,
    flex: 1,
    lineHeight: 21,
  },
  description: {
    fontSize: 13,
    lineHeight: 19,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },
  metaPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  metaText: {
    fontSize: 11.5,
    letterSpacing: 0.2,
  },
});
