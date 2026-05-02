import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useColors } from "@/hooks/useColors";
import type { DailyTask } from "@workspace/api-client-react";

type Props = {
  visible: boolean;
  task: DailyTask | null;
  completed: boolean;
  hasReflection: boolean;
  onClose: () => void;
  onToggle: () => void;
  onReflect: () => void;
};

export function TaskDetailSheet({
  visible,
  task,
  completed,
  hasReflection,
  onClose,
  onToggle,
  onReflect,
}: Props) {
  const colors = useColors();

  if (!task) return null;

  const handleToggle = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(
        completed
          ? Haptics.ImpactFeedbackStyle.Light
          : Haptics.ImpactFeedbackStyle.Medium,
      ).catch(() => {});
    }
    onToggle();
  };

  const handleReflect = () => {
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
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={[
            styles.sheet,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderRadius: colors.radius,
            },
          ]}
        >
          <View style={styles.headerRow}>
            <View
              style={[
                styles.statusPill,
                {
                  backgroundColor: completed
                    ? colors.primary + "1A"
                    : colors.muted,
                },
              ]}
            >
              <Feather
                name={completed ? "check-circle" : "circle"}
                size={12}
                color={completed ? colors.primary : colors.mutedForeground}
              />
              <Text
                style={[
                  styles.statusText,
                  {
                    color: completed ? colors.primary : colors.mutedForeground,
                    fontFamily: "Inter_600SemiBold",
                  },
                ]}
              >
                {completed ? "Completed" : "To do"}
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10}>
              <Feather name="x" size={20} color={colors.mutedForeground} />
            </Pressable>
          </View>

          <Text
            style={[
              styles.title,
              { color: colors.foreground, fontFamily: "Inter_700Bold" },
            ]}
          >
            {task.title}
          </Text>

          <View style={styles.metaRow}>
            <View style={[styles.metaPill, { backgroundColor: colors.muted }]}>
              <Feather name="clock" size={12} color={colors.foreground} />
              <Text
                style={[
                  styles.metaText,
                  { color: colors.foreground, fontFamily: "Inter_600SemiBold" },
                ]}
              >
                {task.durationMinutes} min
              </Text>
            </View>
            <View style={[styles.metaPill, { backgroundColor: colors.muted }]}>
              <Feather name="tag" size={12} color={colors.foreground} />
              <Text
                style={[
                  styles.metaText,
                  { color: colors.foreground, fontFamily: "Inter_600SemiBold" },
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
                <Feather
                  name="alert-triangle"
                  size={12}
                  color={priorityBadge.color}
                />
                <Text
                  style={[
                    styles.metaText,
                    {
                      color: priorityBadge.color,
                      fontFamily: "Inter_600SemiBold",
                    },
                  ]}
                >
                  {priorityBadge.text}
                </Text>
              </View>
            )}
          </View>

          <ScrollView
            style={styles.descriptionScroll}
            contentContainerStyle={styles.descriptionContent}
            showsVerticalScrollIndicator
          >
            <Text
              style={[
                styles.description,
                {
                  color: colors.foreground,
                  fontFamily: "Inter_400Regular",
                },
              ]}
            >
              {task.description}
            </Text>
          </ScrollView>

          <View style={styles.actionRow}>
            <Pressable
              onPress={handleReflect}
              style={({ pressed }) => [
                styles.secondaryBtn,
                {
                  borderColor: hasReflection ? colors.primary : colors.border,
                  borderRadius: 8,
                  backgroundColor: hasReflection
                    ? colors.primary + "1A"
                    : "transparent",
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <Feather
                name={hasReflection ? "message-circle" : "edit-3"}
                size={14}
                color={hasReflection ? colors.primary : colors.foreground}
              />
              <Text
                style={[
                  styles.secondaryText,
                  {
                    color: hasReflection ? colors.primary : colors.foreground,
                    fontFamily: "Inter_600SemiBold",
                  },
                ]}
              >
                {hasReflection ? "Reflected" : "Reflect"}
              </Text>
            </Pressable>
            <Pressable
              onPress={handleToggle}
              style={({ pressed }) => [
                styles.primaryBtn,
                {
                  backgroundColor: completed ? colors.muted : colors.primary,
                  borderRadius: 8,
                  opacity: pressed ? 0.9 : 1,
                },
              ]}
            >
              <Feather
                name={completed ? "rotate-ccw" : "check"}
                size={16}
                color={completed ? colors.foreground : colors.primaryForeground}
              />
              <Text
                style={[
                  styles.primaryText,
                  {
                    color: completed
                      ? colors.foreground
                      : colors.primaryForeground,
                    fontFamily: "Inter_700Bold",
                  },
                ]}
              >
                {completed ? "Mark as undone" : "Mark complete"}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    margin: 12,
    padding: 20,
    borderWidth: 1,
    gap: 14,
    maxHeight: "85%",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  statusText: {
    fontSize: 11,
    letterSpacing: 0.4,
  },
  title: {
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.3,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  metaPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  metaText: {
    fontSize: 12,
    letterSpacing: 0.2,
  },
  descriptionScroll: {
    maxHeight: 320,
  },
  descriptionContent: {
    paddingVertical: 4,
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderWidth: 1,
  },
  secondaryText: {
    fontSize: 13.5,
  },
  primaryBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 13,
  },
  primaryText: {
    fontSize: 14.5,
    letterSpacing: 0.2,
  },
});
