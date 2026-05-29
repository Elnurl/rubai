import { Feather } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";
import type { DailyTask } from "@workspace/api-client-react";

type Props = {
  tasks: DailyTask[];
  /** Map of taskId → completed for today. */
  completions: Map<string, boolean>;
  /** Tapping a row opens the coach with this task as context. */
  onPressTask?: (task: DailyTask) => void;
};

/**
 * A compact, read-at-a-glance preview of today's tasks shown at the top of the
 * Roadmap screen. Phases below describe the long arc; this card answers "what am
 * I actually doing today?". Tapping a row jumps to the coach to adjust it.
 */
export function TodayAnchorsCard({ tasks, completions, onPressTask }: Props) {
  const colors = useColors();
  if (tasks.length === 0) return null;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderRadius: colors.radius,
        },
      ]}
    >
      <View style={styles.header}>
        <Feather name="calendar" size={14} color={colors.primary} />
        <Text
          style={[
            styles.headerText,
            { color: colors.foreground, fontFamily: "Inter_600SemiBold" },
          ]}
        >
          Today's anchors
        </Text>
      </View>

      <View>
        {tasks.map((task, i) => {
          const done = completions.get(task.id) === true;
          return (
            <Pressable
              key={task.id}
              onPress={() => onPressTask?.(task)}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.row,
                i > 0 && {
                  borderTopWidth: StyleSheet.hairlineWidth,
                  borderTopColor: colors.border,
                },
                pressed && { opacity: 0.6 },
              ]}
            >
              <View
                style={[
                  styles.ring,
                  done
                    ? { backgroundColor: colors.primary, borderColor: colors.primary }
                    : { borderColor: colors.mutedForeground + "88" },
                ]}
              >
                {done && (
                  <Feather name="check" size={11} color={colors.primaryForeground} />
                )}
              </View>
              <Text
                numberOfLines={1}
                style={[
                  styles.title,
                  {
                    color: done ? colors.mutedForeground : colors.foreground,
                    fontFamily: "Inter_500Medium",
                  },
                  done && styles.struck,
                ]}
              >
                {task.title}
              </Text>
              {task.durationMinutes ? (
                <Text
                  style={[
                    styles.meta,
                    { color: colors.mutedForeground, fontFamily: "Inter_500Medium" },
                  ]}
                >
                  {task.durationMinutes}m
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderWidth: 1,
    gap: 6,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  headerText: {
    fontSize: 13.5,
    letterSpacing: 0.2,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
  },
  ring: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    flex: 1,
    fontSize: 14,
  },
  struck: {
    textDecorationLine: "line-through",
  },
  meta: {
    fontSize: 12,
    letterSpacing: 0.2,
  },
});
