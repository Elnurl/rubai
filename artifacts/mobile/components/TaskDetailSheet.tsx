import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useEffect, useRef, useState } from "react";
import {
  AppState,
  type AppStateStatus,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useColors } from "@/hooks/useColors";
import { todayISO } from "@/lib/storage";
import { useAtlas } from "@/providers/AtlasProvider";
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

type FocusState =
  | { kind: "idle" }
  | { kind: "running"; startedAt: number; baseSeconds: number }
  | { kind: "paused"; baseSeconds: number };

function formatTimer(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const mm = Math.floor(s / 60).toString().padStart(2, "0");
  const ss = (s % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

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
  const { appendActiveFocusMinutes } = useAtlas();

  const [focus, setFocus] = useState<FocusState>({ kind: "idle" });
  const [tick, setTick] = useState(0); // Re-render trigger for the running timer
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Stable refs so the AppState handler always sees the latest values without
  // re-subscribing on every tick.
  const focusRef = useRef<FocusState>(focus);
  focusRef.current = focus;
  const taskRef = useRef<DailyTask | null>(task);
  taskRef.current = task;

  // Drive the visible counter while running. Use a fresh Date.now() each tick
  // so backgrounding/foregrounding doesn't drift the displayed time — the
  // source of truth is `startedAt + baseSeconds`, not a counter we increment.
  useEffect(() => {
    if (focus.kind !== "running") {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }
    intervalRef.current = setInterval(() => setTick((t) => t + 1), 1000);
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [focus.kind]);

  // If the user backgrounds the app while a session is running, persist the
  // accumulated minutes when they return so we never silently lose work.
  useEffect(() => {
    const handleAppState = (state: AppStateStatus) => {
      if (state !== "active") return;
      // Tick once on resume so the visible counter snaps to true elapsed.
      setTick((t) => t + 1);
    };
    const sub = AppState.addEventListener("change", handleAppState);
    return () => sub.remove();
  }, []);

  // Sheet close / task change → flush any in-progress session so minutes
  // never leak. Also resets local state for the next task.
  useEffect(() => {
    if (visible) return;
    const f = focusRef.current;
    const t = taskRef.current;
    if (t && f.kind !== "idle") {
      const elapsedSec = currentElapsedSeconds(f);
      const minutes = elapsedSec / 60;
      if (minutes >= 0.5) {
        void appendActiveFocusMinutes(t.id, t.title, todayISO(), minutes);
      }
    }
    setFocus({ kind: "idle" });
    setTick(0);
  }, [visible, appendActiveFocusMinutes]);

  if (!task) return null;

  const handleToggle = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(
        completed
          ? Haptics.ImpactFeedbackStyle.Light
          : Haptics.ImpactFeedbackStyle.Medium,
      ).catch(() => {});
    }
    // Marking complete should also cash out any in-progress focus session.
    if (focus.kind !== "idle") {
      const elapsedSec = currentElapsedSeconds(focus);
      const minutes = elapsedSec / 60;
      if (minutes >= 0.5) {
        void appendActiveFocusMinutes(task.id, task.title, todayISO(), minutes);
      }
      setFocus({ kind: "idle" });
    }
    onToggle();
  };

  const handleReflect = () => {
    onReflect();
  };

  const handleStart = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
    if (focus.kind === "paused") {
      setFocus({
        kind: "running",
        startedAt: Date.now(),
        baseSeconds: focus.baseSeconds,
      });
    } else {
      setFocus({ kind: "running", startedAt: Date.now(), baseSeconds: 0 });
    }
  };

  const handlePause = () => {
    if (focus.kind !== "running") return;
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    const elapsed = currentElapsedSeconds(focus);
    setFocus({ kind: "paused", baseSeconds: elapsed });
  };

  const handleStop = () => {
    if (focus.kind === "idle") return;
    const elapsedSec = currentElapsedSeconds(focus);
    const minutes = elapsedSec / 60;
    if (minutes >= 0.5) {
      void appendActiveFocusMinutes(task.id, task.title, todayISO(), minutes);
    }
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => {},
      );
    }
    setFocus({ kind: "idle" });
  };

  const elapsedSeconds = currentElapsedSeconds(focus);
  // `tick` participates in the dependency chain so the displayed counter
  // re-renders every second while running.
  void tick;

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

          {/* Focus timer */}
          <View
            style={[
              styles.focusCard,
              {
                backgroundColor:
                  focus.kind === "running"
                    ? colors.primary + "12"
                    : colors.muted,
                borderColor:
                  focus.kind === "running"
                    ? colors.primary + "55"
                    : colors.border,
                borderRadius: colors.radius,
              },
            ]}
          >
            <View style={styles.focusHeader}>
              <View style={styles.focusLabelRow}>
                <Feather
                  name={focus.kind === "running" ? "zap" : "play-circle"}
                  size={14}
                  color={
                    focus.kind === "running"
                      ? colors.primary
                      : colors.mutedForeground
                  }
                />
                <Text
                  style={[
                    styles.focusLabel,
                    {
                      color:
                        focus.kind === "running"
                          ? colors.primary
                          : colors.mutedForeground,
                      fontFamily: "Inter_600SemiBold",
                    },
                  ]}
                >
                  {focus.kind === "running"
                    ? "FOCUSING"
                    : focus.kind === "paused"
                      ? "PAUSED"
                      : "FOCUS TIMER"}
                </Text>
              </View>
              <Text
                style={[
                  styles.focusElapsed,
                  {
                    color:
                      focus.kind === "running"
                        ? colors.primary
                        : colors.foreground,
                    fontFamily: "Inter_700Bold",
                  },
                ]}
              >
                {formatTimer(elapsedSeconds)}
              </Text>
            </View>
            <View style={styles.focusActionRow}>
              {focus.kind === "running" ? (
                <>
                  <Pressable
                    onPress={handlePause}
                    style={({ pressed }) => [
                      styles.focusBtn,
                      {
                        backgroundColor: colors.card,
                        borderColor: colors.border,
                        opacity: pressed ? 0.85 : 1,
                      },
                    ]}
                  >
                    <Feather name="pause" size={13} color={colors.foreground} />
                    <Text
                      style={[
                        styles.focusBtnText,
                        {
                          color: colors.foreground,
                          fontFamily: "Inter_600SemiBold",
                        },
                      ]}
                    >
                      Pause
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={handleStop}
                    style={({ pressed }) => [
                      styles.focusBtn,
                      {
                        backgroundColor: colors.primary,
                        borderColor: colors.primary,
                        opacity: pressed ? 0.85 : 1,
                      },
                    ]}
                  >
                    <Feather
                      name="check"
                      size={13}
                      color={colors.primaryForeground}
                    />
                    <Text
                      style={[
                        styles.focusBtnText,
                        {
                          color: colors.primaryForeground,
                          fontFamily: "Inter_600SemiBold",
                        },
                      ]}
                    >
                      Save session
                    </Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <Pressable
                    onPress={handleStart}
                    style={({ pressed }) => [
                      styles.focusBtn,
                      {
                        backgroundColor: colors.primary,
                        borderColor: colors.primary,
                        opacity: pressed ? 0.85 : 1,
                        flex: 1,
                      },
                    ]}
                  >
                    <Feather
                      name="play"
                      size={13}
                      color={colors.primaryForeground}
                    />
                    <Text
                      style={[
                        styles.focusBtnText,
                        {
                          color: colors.primaryForeground,
                          fontFamily: "Inter_600SemiBold",
                        },
                      ]}
                    >
                      {focus.kind === "paused" ? "Resume" : "Start focus"}
                    </Text>
                  </Pressable>
                  {focus.kind === "paused" && (
                    <Pressable
                      onPress={handleStop}
                      style={({ pressed }) => [
                        styles.focusBtn,
                        {
                          backgroundColor: colors.card,
                          borderColor: colors.border,
                          opacity: pressed ? 0.85 : 1,
                        },
                      ]}
                    >
                      <Feather
                        name="square"
                        size={13}
                        color={colors.foreground}
                      />
                      <Text
                        style={[
                          styles.focusBtnText,
                          {
                            color: colors.foreground,
                            fontFamily: "Inter_600SemiBold",
                          },
                        ]}
                      >
                        Save & stop
                      </Text>
                    </Pressable>
                  )}
                </>
              )}
            </View>
          </View>

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

function currentElapsedSeconds(state: FocusState): number {
  if (state.kind === "idle") return 0;
  if (state.kind === "paused") return state.baseSeconds;
  return state.baseSeconds + (Date.now() - state.startedAt) / 1000;
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
    maxHeight: "90%",
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
    maxHeight: 240,
  },
  descriptionContent: {
    paddingVertical: 4,
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
  },
  focusCard: {
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  focusHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  focusLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  focusLabel: {
    fontSize: 11,
    letterSpacing: 1.2,
  },
  focusElapsed: {
    fontSize: 22,
    letterSpacing: 0.5,
    fontVariant: ["tabular-nums"],
  },
  focusActionRow: {
    flexDirection: "row",
    gap: 8,
  },
  focusBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  focusBtnText: {
    fontSize: 12.5,
    letterSpacing: 0.2,
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
